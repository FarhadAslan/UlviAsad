import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic    = "force-dynamic";
export const runtime    = "nodejs";
export const maxDuration = 55;

// ─── Timeout ──────────────────────────────────────────────────────────────────
const TOTAL_TIMEOUT_MS  = 46_000;
const WORKER_TIMEOUT_MS = 22_000;

// ─── Per-user throttle (DB-based) ─────────────────────────────────────────────
// Saatda bir istifadəçi max 10 dəfə quiz generasiya edə bilər.
// DB-based olduğu üçün serverless-də də işləyir.
const USER_WINDOW_MS  = 60 * 60 * 1000; // 1 saat
const USER_MAX_CALLS  = 10;

async function checkUserThrottle(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - USER_WINDOW_MS);
  
  // Son 1 saatdakı quiz generasiya sayını yoxla
  const recentCount = await prisma.quiz.count({
    where: {
      createdById: userId,
      createdAt: { gte: windowStart },
    },
  });
  
  const remaining = Math.max(0, USER_MAX_CALLS - recentCount);
  return { allowed: recentCount < USER_MAX_CALLS, remaining };
}

// ─── Response cache (in-memory, 30 dəq TTL) ──────────────────────────────────
// Eyni mövzu + sual sayı üçün cache-dən cavab göndərilir.
const CACHE_TTL = 30 * 60 * 1000; // 30 dəqiqə
interface CacheEntry { questions: any[]; ts: number }
const responseCache = new Map<string, CacheEntry>();

function getCacheKey(title: string, count: number, language: string, botId?: string): string {
  return `${title.trim().toLowerCase()}|${count}|${language}|${botId ?? ""}`;
}

function getCached(key: string): any[] | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { responseCache.delete(key); return null; }
  return entry.questions;
}

function setCache(key: string, questions: any[]): void {
  responseCache.set(key, { questions, ts: Date.now() });
  // Cache-i 200 elementdən böyük tutma — yaddaş sızmasının qarşısını al
  if (responseCache.size > 200) {
    // Map insertion order qorunur, ilk element ən köhnədir
    const firstKey = responseCache.keys().next().value;
    if (firstKey) {
      responseCache.delete(firstKey);
    }
  }
}

// ─── Model konfiqurasiyası ───────────────────────────────────────────────────
interface Worker {
  id: string;
  provider: "groq" | "openrouter";
  jsonMode: boolean;
  maxTokens: number;
  priority: number; // aşağı = daha əvvəl cəhd et
}

// Groq — sürətli, az gecikmə. llama-3.3-70b əsas, qalanları fallback.
// NOT: mixtral-8x7b-32768 Groq-da deprecated edildi → llama3-70b-8192 ilə əvəzləndi.
const GROQ_WORKERS: Worker[] = [
  { id: "llama-3.3-70b-versatile", provider: "groq", jsonMode: true,  maxTokens: 6000, priority: 1 },
  { id: "llama-3.1-8b-instant",    provider: "groq", jsonMode: false, maxTokens: 4000, priority: 2 },
  { id: "gemma2-9b-it",            provider: "groq", jsonMode: false, maxTokens: 4000, priority: 3 },
  { id: "llama3-70b-8192",         provider: "groq", jsonMode: false, maxTokens: 5000, priority: 4 },
];

// OpenRouter — müstəqil rate limit. Groq exhausted olduqda işə düşür.
// 2026 aktiv pulsuz modellər (prioritet sırasında):
const OR_WORKERS: Worker[] = [
  { id: "meta-llama/llama-4-scout:free",              provider: "openrouter", jsonMode: false, maxTokens: 6000, priority: 1 },
  { id: "meta-llama/llama-4-maverick:free",           provider: "openrouter", jsonMode: false, maxTokens: 6000, priority: 2 },
  { id: "qwen/qwen3-8b:free",                         provider: "openrouter", jsonMode: false, maxTokens: 5000, priority: 3 },
  { id: "meta-llama/llama-3.3-70b-instruct:free",     provider: "openrouter", jsonMode: false, maxTokens: 6000, priority: 4 },
  { id: "google/gemma-2-9b-it:free",                  provider: "openrouter", jsonMode: false, maxTokens: 4000, priority: 5 },
  { id: "qwen/qwen-2.5-72b-instruct:free",            provider: "openrouter", jsonMode: false, maxTokens: 5000, priority: 6 },
  { id: "meta-llama/llama-3.2-3b-instruct:free",      provider: "openrouter", jsonMode: false, maxTokens: 3000, priority: 7 },
  // DeepSeek-R1 keyfiyyətlidir, amma yavaş + çox məşhur → son fallback
  { id: "deepseek/deepseek-r1:free",                  provider: "openrouter", jsonMode: false, maxTokens: 6000, priority: 8 },
];

// ─── JSON parser ──────────────────────────────────────────────────────────────
function extractQuestions(raw: string): any[] | null {
  if (!raw?.trim()) return null;

  const text = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();

  const parsers: Array<() => any> = [
    () => JSON.parse(text),
    () => {
      const s = text.indexOf("[");
      const e = text.lastIndexOf("]");
      if (s < 0 || e < 0) throw new Error("no brackets");
      return { questions: JSON.parse(text.slice(s, e + 1)) };
    },
    () => {
      const s = text.indexOf("{");
      const e = text.lastIndexOf("}");
      if (s < 0 || e < 0) throw new Error("no braces");
      return JSON.parse(text.slice(s, e + 1));
    },
    // Kəsilmiş JSON-u bərpa etmək üçün — token limiti səbəbindən bitməmiş ola bilər
    () => {
      const s = text.indexOf("[");
      if (s < 0) throw new Error("no array start");
      const arr  = text.slice(s);
      const objs: string[] = [];
      let obj = "", depth = 0;
      for (let i = 0; i < arr.length; i++) {
        const ch = arr[i];
        if (ch === "{") { depth++; obj += ch; }
        else if (ch === "}") {
          depth--;
          obj += ch;
          if (depth === 0) { objs.push(obj); obj = ""; }
        } else if (depth > 0) {
          obj += ch;
        }
      }
      if (objs.length === 0) throw new Error("no objects");
      return { questions: objs.map(o => JSON.parse(o)) };
    },
  ];

  for (const parse of parsers) {
    try {
      const parsed = parse();
      if (Array.isArray(parsed?.questions) && parsed.questions.length > 0) return parsed.questions;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch { /* növbəti */ }
  }
  return null;
}

// ─── Sual validasiyası ───────────────────────────────────────────────────────
function isValidQuestion(q: any): boolean {
  if (!q || typeof q !== "object") return false;
  if (!q.text || typeof q.text !== "string" || q.text.trim().length < 5) return false;
  if (!Array.isArray(q.options) || q.options.length < 2) return false;
  if (!q.correctOption) return false;
  return q.options.every((o: any) => {
    if (!o) return false;
    if (typeof o === "string") return o.trim().length > 0;
    if (typeof o === "object") return typeof o.text === "string" && o.text.trim().length > 0;
    return false;
  });
}

// ─── Tək model çağırışı ───────────────────────────────────────────────────────
async function callWorker(
  w:          Worker,
  groqKey:    string | undefined,
  orKey:      string | undefined,
  system:     string,
  userPrompt: string,
): Promise<any[]> {
  const key = w.provider === "groq" ? groqKey : orKey;
  if (!key) throw new Error(`[${w.id}] API açarı tapılmadı`);

  const endpoint = w.provider === "groq"
    ? "https://api.groq.com/openai/v1/chat/completions"
    : "https://openrouter.ai/api/v1/chat/completions";

  const headers: Record<string, string> = {
    "Content-Type":  "application/json",
    "Authorization": `Bearer ${key}`,
  };
  if (w.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://ulvi-asad-hnez.vercel.app";
    headers["X-Title"]      = "Muellim Portal";
  }

  const body: any = {
    model:       w.id,
    messages:    [
      { role: "system", content: system },
      { role: "user",   content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens:  w.maxTokens,
  };
  if (w.jsonMode) body.response_format = { type: "json_object" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WORKER_TIMEOUT_MS);

  try {
    const res = await fetch(endpoint, {
      method:  "POST",
      headers,
      body:    JSON.stringify(body),
      signal:  controller.signal,
    });
    clearTimeout(timer);

    if (res.status === 429) throw new Error(`[${w.id}] 429 rate-limit`);
    if (res.status === 401 || res.status === 403) throw new Error(`[${w.id}] API açarı səhvdir (${res.status})`);
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`[${w.id}] HTTP ${res.status}: ${errText.slice(0, 80)}`);
    }

    const data    = await res.json().catch(() => null);
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error(`[${w.id}] boş cavab`);

    const qs = extractQuestions(content);
    if (!qs) throw new Error(`[${w.id}] JSON parse xətası`);

    const valid = qs.filter(isValidQuestion);
    if (valid.length === 0) throw new Error(`[${w.id}] ${qs.length} sualdan heç biri valid deyil`);

    console.log(`[${w.id}] ✓ ${valid.length}/${qs.length} etibarlı sual`);
    return valid;

  } catch (e: any) {
    clearTimeout(timer);
    if (e?.name === "AbortError") throw new Error(`[${w.id}] timeout`);
    throw e;
  }
}

// ─── Normalize ────────────────────────────────────────────────────────────────
const LABELS = ["A", "B", "C", "D"];

function normalizeQuestion(q: any): any {
  const rawOptions: { label: string; text: string }[] = Array.isArray(q.options)
    ? q.options.map((o: any, i: number) => {
        let textVal  = "";
        let labelVal = LABELS[i] || String.fromCharCode(65 + i);
        if (o && typeof o === "object") {
          textVal = String(o.text || "").trim();
          if (o.label) labelVal = String(o.label).toUpperCase();
        } else if (typeof o === "string") {
          textVal = o.trim();
        }
        return { label: labelVal, text: textVal };
      })
    : LABELS.map(l => ({ label: l, text: "" }));

  const correctLabel = String(q.correctOption || "A").toUpperCase();
  const correctText  = rawOptions.find(o => o.label === correctLabel)?.text || rawOptions[0]?.text || "";

  const shuffled = [...rawOptions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  let newCorrect = "A";
  const newOptions = shuffled.map((o, idx) => {
    const label = LABELS[idx] || String.fromCharCode(65 + idx);
    if (o.text === correctText) newCorrect = label;
    return { label, text: o.text };
  });

  return {
    text:              String(q.text || "").trim(),
    imageUrl:          "",
    questionType:      q.questionType || "CHOICE",
    openAnswerExample: q.openAnswerExample || "",
    options:           newOptions,
    correctOption:     newCorrect,
    points:            typeof q.points === "number" ? q.points : 1,
  };
}

// ─── Əsas generasiya ─────────────────────────────────────────────────────────
//
//  STRATEGİYA — Sequential-First (Rate Limit'i minimuma endir):
//
//  ❌ KÖHNƏ: Hər round-da 4 model paralel → 4 API sorğusu/round → limiti çox sürətli tükədir
//
//  ✅ YENİ: Əvvəlcə TƏK ən yaxşı model cəhd edir
//     → Uğurlu olsa: 1 sorğu ilə bitir (4x qənaət!)
//     → Uğursuz olsa: növbəti 1-2 model əlavə edilir
//     → Hamısı uğursuz olsa: tam paralel (son çarə)
//
//  MODEL PRİORİTETİ:
//    Mərhələ 1: priority=1 model (llama-3.3-70b)
//    Mərhələ 2: priority=1,2 modellər
//    Mərhələ 3+: bütün aktiv modellər (max 3 paralel)
//
async function generateQuestions(
  totalNeeded: number,
  system:      string,
  buildPrompt: (count: number, hint: string) => string,
  groqKey:     string | undefined,
  orKey:       string | undefined,
): Promise<{ questions: any[]; errors: string[] }> {

  const allWorkers: Worker[] = [
    ...(groqKey ? GROQ_WORKERS : []),
    ...(orKey   ? OR_WORKERS   : []),
  ].sort((a, b) => a.priority - b.priority);

  if (allWorkers.length === 0) {
    return { questions: [], errors: ["Aktiv AI modeli konfiqurasiya edilməyib"] };
  }

  const hints = [
    "Mövzunun ən məşhur faktlarını yoxlayan aydın suallar yarat.",
    "Rəqəmlər, illər, miqdarlar ilə bağlı suallar yarat.",
    "Terminlər, təriflər və elmi anlayışların izahı ilə bağlı suallar yarat.",
    "Məntiqi ardıcıllıq tələb edən suallar yarat.",
    "Mövzuya aid şəxsiyyətlər ilə bağlı suallar yarat.",
    "İki anlayışı müqayisə edən suallar yarat.",
  ];

  const startTime   = Date.now();
  const collected:  any[] = [];
  const seenKeys    = new Set<string>();
  const errors:     string[] = [];
  const rateLimited = new Set<string>();

  const timeLeft = () => TOTAL_TIMEOUT_MS - (Date.now() - startTime);

  const addQuestions = (qs: any[]): number => {
    let added = 0;
    for (const q of qs) {
      const key = (q.text || "").trim().toLowerCase().slice(0, 80);
      if (key.length > 5 && !seenKeys.has(key)) {
        seenKeys.add(key);
        collected.push(q);
        added++;
      }
    }
    return added;
  };

  // Overshoot: dedup itkisini kompensasiya etmək üçün az miqdarda artıq istə
  // Azaldılmış overshoot — API limitə daha az təsir edir
  const overshoot = (n: number) => Math.min(n + Math.ceil(n * 0.08), n + 3);

  // Eyni anda işə salınacaq model sayı (paralel) — 4-dən 2-yə endirildi
  const PARALLEL_COUNT = Math.min(allWorkers.length, 2);

  let round = 0;

  while (collected.length < totalNeeded && timeLeft() > 8_000) {
    round++;
    const remaining = totalNeeded - collected.length;

    const available = allWorkers.filter(w => !rateLimited.has(w.id));
    if (available.length === 0) {
      console.warn("[gen] Bütün modellər rate-limitdədir.");
      break;
    }

    // Paralel: Hər dəfə 4 fərqli model seçilir, növbəti raundda sürüşdürülür
    const offset  = (round - 1) * PARALLEL_COUNT;
    const workers = available.slice(offset % available.length)
      .concat(available.slice(0, offset % available.length))
      .slice(0, PARALLEL_COUNT);

    const askCount = overshoot(remaining);

    console.log(
      `[gen] Mərhələ ${round}: ${workers.map(w => w.id.split("/").pop()).join(", ")} | ` +
      `Hər biri ${askCount} sual | Lazım: ${remaining} | Vaxt: ${Math.round(timeLeft() / 1000)}s`
    );

    // Seçilmiş modellərə sorğu göndər
    const tasks = workers.map((w, idx) => {
      const hint   = hints[(idx + round * 2) % hints.length];
      const prompt = buildPrompt(askCount, hint);
      return callWorker(w, groqKey, orKey, system, prompt)
        .then(qs  => ({ w, qs, ok: true  as const }))
        .catch(err => ({ w, err, ok: false as const }));
    });

    const results = await Promise.all(tasks);
    let newThisRound = 0;

    for (const r of results) {
      if (r.ok) {
        const added = addQuestions(r.qs);
        newThisRound += added;
        console.log(
          `[gen] ✓ ${r.w.id}: ${r.qs.length} aldı → ${added} yeni. Cəmi: ${collected.length}/${totalNeeded}`
        );
      } else {
        const msg: string = (r as any).err?.message || `${r.w.id} uğursuz`;
        console.warn(`[gen] ✗ ${r.w.id}:`, msg);
        
        // Rate limit yalnız 3 dəqiqəlik müvəqqəti blok
        if (msg.includes("429") || msg.toLowerCase().includes("rate-limit")) {
          console.log(`[gen] ${r.w.id} rate-limited, 3 dəqiqə sonra yenidən cəhd ediləcək`);
          rateLimited.add(r.w.id);
          // 3 dəqiqə sonra rate limit-i sil
          setTimeout(() => rateLimited.delete(r.w.id), 3 * 60 * 1000);
        }
        if (!errors.includes(msg)) errors.push(msg);
      }
    }

    if (collected.length >= totalNeeded) break;

    // Yeni sual gəlmədisə dövrü bitir — sonsuz loop riski
    if (newThisRound === 0) {
      console.warn(`[gen] Mərhələ ${round}: Yeni sual əldə edilmədi. Dayandırılır.`);
      break;
    }

    // Bütün modellər tükəndisə növbəti dövrə keç (offset artıq bütün modelləri əhatə edir)
    if (available.length <= PARALLEL_COUNT) {
      if (timeLeft() > 15_000 && round <= 2) {
        console.log("[gen] Qısa fasilə (5s) — rate limit recovery...");
        await new Promise(r => setTimeout(r, 5_000));
      }
    } else if (newThisRound > 0 && collected.length < totalNeeded && timeLeft() > 10_000) {
      // Modellər arasında 2 saniyə fasilə — rate limit riski azalır
      console.log("[gen] Model rotasiyası fasiləsi (2s)...");
      await new Promise(r => setTimeout(r, 2_000));
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(
    `[gen] Tamamlandı: ${collected.length}/${totalNeeded} sual | ` +
    `${elapsed}ms | ${round} mərhələ | Rate-limited: ${rateLimited.size}`
  );

  return { questions: collected.slice(0, totalNeeded), errors };
}

// ─── POST handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    // ── Per-user throttle yoxlaması ──────────────────────────────────────────
    const userId = (session.user as any)?.id ?? (session.user as any)?.email ?? "unknown";
    const throttle = await checkUserThrottle(userId);
    
    if (!throttle.allowed) {
      return NextResponse.json(
        {
          error: `Saatda ${USER_MAX_CALLS} quiz generasiyası limitinə çatdınız. Bir saat sonra yenidən cəhd edin.`,
          retryAfter: USER_WINDOW_MS / 1000,
          remaining: 0,
        },
        { status: 429 }
      );
    }

    const groqKeyRaw = process.env.GROQ_API_KEY;
    const orKey      = process.env.OPENROUTER_API_KEY;

    // Groq açarı "gsk_" ilə başlamalıdır
    const groqKey = groqKeyRaw?.startsWith("gsk_") ? groqKeyRaw : undefined;
    if (groqKeyRaw && !groqKey) {
      console.warn("[generate-quiz] GROQ_API_KEY formatı səhvdir. Groq atlanılır.");
    }

    if (!groqKey && !orKey) {
      return NextResponse.json({ error: "AI API açarı konfiqurasiya edilməyib." }, { status: 503 });
    }

    const body = await req.json();
    const { title, questionCount = 10, category, language = "az", botId } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Quiz başlığı tələb olunur" }, { status: 400 });
    }

    const safeCount = Math.min(50, Math.max(1, parseInt(questionCount) || 10));

    // ── Cache yoxlaması ──────────────────────────────────────────────────────
    // Bot əsaslı quizlər cache-lənmir (fərdi bilik bazasına görə dəyişir)
    const cacheKey = getCacheKey(title, safeCount, language, botId);
    if (!botId) {
      const cached = getCached(cacheKey);
      if (cached) {
        console.log(`[generate-quiz] Cache HIT: "${title}" (${safeCount} sual)`);
        return NextResponse.json({
          questions: cached,
          meta: {
            requested: safeCount,
            generated: cached.length,
            complete:  cached.length >= safeCount,
            fromCache: true,
          },
        });
      }
    }

    // ── System prompt (optimallaşdırılmış — daha az token) ───────────────────
    let systemPrompt = `Sən quiz sualları yaradan AI assistentsən.
QAYDALAR:
- Mövzu üzrə dəqiq test sualları yarat
- Bütün mətn Azərbaycan dilində olsun
- Hər sualın 1 düzgün cavabı olsun
- Yanlış variantlar inandırıcı, amma yanlış olsun
- "Hamısı doğrudur"/"Heç biri" tipli variantlardan çəkin
- YALNIZ JSON formatında cavab ver

FORMAT:
{"questions":[{"text":"Sual","options":[{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],"correctOption":"A"}]}`;

    let botContent = "";

    if (botId) {
      const bot = await prisma.aiBot.findUnique({
        where:  { id: botId, active: true },
        select: { prompt: true, content: true },
      });
      if (!bot) {
        return NextResponse.json({ error: "Seçilmiş AI bot tapılmadı" }, { status: 404 });
      }
      systemPrompt = `${bot.prompt}

FORMAT (yalnız JSON):
{"questions":[{"text":"Sual","options":[{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],"correctOption":"A"}]}`;
      botContent = (bot.content || "").slice(0, 5000);
    }

    const langLabel = language === "az" ? "Azərbaycan dilində"
                    : language === "ru" ? "Rus dilində"
                    : "İngilis dilində";
    const catLabel  = category || "ümumi bilik";

    // User prompt — sistem promptda JSON nümunəsi artıq var, burada təkrarlanmır
    const buildPrompt = (count: number, hint: string): string => {
      const ctxPart = botContent
        ? `\nBilik bazası (YALNIZ buradan istifadə et):\n---\n${botContent}\n---\n`
        : "";
      const botRule = botId ? "\n- Yalnız verilmiş bilik bazasındakı məlumatlardan istifadə et." : "";

      return `${langLabel} "${title}" mövzusu üzrə DƏQIQ ${count} sual yarat. ${hint}
Kateqoriya: ${catLabel}${ctxPart}
Tələblər:
- Hər sualın 4 variant cavabı olsun (A, B, C, D)
- Düzgün cavabları A, B, C, D arasında müxtəlif paylat${botRule}

YALNIZ JSON, DƏQIQ ${count} sual:`;
    };

    const genResult = await generateQuestions(
      safeCount, systemPrompt, buildPrompt, groqKey, orKey
    );

    if (genResult.questions.length === 0) {
      const isRateLimit = genResult.errors.some(e => e.includes("429") || e.includes("rate-limit"));
      return NextResponse.json(
        {
          error: isRateLimit
            ? "AI API limiti dolub. Bir neçə dəqiqə gözləyib yenidən cəhd edin."
            : "AI sual yarada bilmədi. Mövzunu dəqiqləşdirərək yenidən cəhd edin.",
          details: genResult.errors.slice(0, 3),
        },
        { status: 502 }
      );
    }

    const normalized = genResult.questions.map(normalizeQuestion);
    const isPartial  = normalized.length < safeCount;

    // ── Nəticəni cache-ə yaz ─────────────────────────────────────────────────
    // Qismən nəticələr də cache-lənir (növbəti dəfə tamamlanması üçün)
    if (!botId) {
      setCache(cacheKey, normalized);
      console.log(`[generate-quiz] Cache WRITE: "${title}" (${normalized.length} sual, partial=${isPartial})`);
    }

    return NextResponse.json({
      questions: normalized,
      meta: {
        requested: safeCount,
        generated: normalized.length,
        complete:  !isPartial,
        fromCache: false,
        remaining: throttle.remaining - 1, // Bu request-dən sonra qalan
        warning: isPartial
          ? `${safeCount} sual istənildi, ${normalized.length} sual yaradıldı. Yenidən cəhd edin.`
          : undefined,
      },
    });

  } catch (err: any) {
    console.error("generate-quiz POST xəta:", err?.message ?? err);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}
