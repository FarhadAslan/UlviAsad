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

// ─── Model konfiqurasiyası ───────────────────────────────────────────────────
interface Worker {
  id: string;
  provider: "groq" | "openrouter";
  jsonMode: boolean;
  maxTokens: number;
}

// Groq — sürətli, yüksək keyfiyyət
// max_tokens artırıldı ki, 30+ sual tam qaytarılsın
const GROQ_WORKERS: Worker[] = [
  { id: "llama-3.3-70b-versatile", provider: "groq", jsonMode: true,  maxTokens: 8000 },
  { id: "llama-3.1-8b-instant",    provider: "groq", jsonMode: false, maxTokens: 7000 },
  { id: "gemma2-9b-it",            provider: "groq", jsonMode: false, maxTokens: 6000 },
  { id: "mixtral-8x7b-32768",      provider: "groq", jsonMode: false, maxTokens: 6000 },
];

// OpenRouter — pulsuz, müstəqil rate limit
const OR_WORKERS: Worker[] = [
  { id: "deepseek/deepseek-r1:free",                 provider: "openrouter", jsonMode: false, maxTokens: 8000 },
  { id: "meta-llama/llama-3.3-70b-instruct:free",    provider: "openrouter", jsonMode: false, maxTokens: 8000 },
  { id: "google/gemma-2-9b-it:free",                 provider: "openrouter", jsonMode: false, maxTokens: 6000 },
  { id: "qwen/qwen-2.5-72b-instruct:free",           provider: "openrouter", jsonMode: false, maxTokens: 6000 },
  { id: "microsoft/phi-3-medium-128k-instruct:free", provider: "openrouter", jsonMode: false, maxTokens: 6000 },
  { id: "meta-llama/llama-3.2-3b-instruct:free",     provider: "openrouter", jsonMode: false, maxTokens: 4000 },
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
      let depth = 0, end = -1;
      const arr = text.slice(s);
      const objs: string[] = [];
      let obj = "";
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

    if (res.status === 429) {
      throw new Error(`[${w.id}] 429 rate-limit`);
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(`[${w.id}] API açarı səhvdir (${res.status})`);
    }
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
// DÜZGÜN STRATEGİYA:
//
//  ❌ KÖHNƏ (yanlış): Hər modelə sual sayını böl (30 / 4 model = 8 sual/model)
//     → Nəticə: Az sual, çox dedup itkisi
//
//  ✅ YENİ (düzgün): Hər model EYNI TAM SAYI generasiya etsin
//     → 4 model × 30 sual = 120 cavab, dedupdan sonra ≥ 30 unikal sual
//     → Rate limit risk azdır: hər model öz müstəqil limitinə malikdir
//     → Groq + OpenRouter — iki fərqli provider, müstəqil limitlər
//
//  MƏRHƏLƏLƏR:
//  1. Mərhələ 1: İlk N modeli EYNI ANDA, hər birindən TAM sual sayı istə
//  2. Mərhələ 2: Hələ az sual varsa, növbəti modellər işə salınır
//  3. Mərhələ 3+: Yenidən cəhd (rate-limit almamış modellərlə)
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
  ];

  if (allWorkers.length === 0) {
    return { questions: [], errors: ["Aktiv AI modeli konfiqurasiya edilməyib"] };
  }

  const hints = [
    "Diqqət: Mövzunun ən məşhur faktlarını yoxlayan aydın suallar yarat.",
    "Diqqət: Rəqəmlər, illər, miqdarlar və tarixlərlə bağlı suallar yarat.",
    "Diqqət: Terminlər, təriflər və elmi anlayışların izahı ilə bağlı suallar yarat.",
    "Diqqət: Məntiqi ardıcıllıq və səbəb-nəticə əlaqəsi tələb edən suallar yarat.",
    "Diqqət: Mövzuya aid şəxsiyyətlər, alimlər, yazıçılar ilə bağlı suallar yarat.",
    "Diqqət: İki fərqli anlayışı müqayisə edən suallar yarat.",
  ];

  const startTime    = Date.now();
  const collected:   any[] = [];
  const seenKeys     = new Set<string>();
  const errors:      string[] = [];
  const rateLimited  = new Set<string>();

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

  // İlk mərhələdə eyni anda işə salınacaq model sayı
  // Çox model = daha çox müxtəlifllik + daha az rate limit riski
  const PARALLEL_COUNT = Math.min(allWorkers.length, 4);

  // Hər model neçə sual yaratmalı?
  // TAM sual sayını istəyirik — dedup itkisini kompensasiya etmək üçün bir az artıq
  // Məsələn: 30 sual lazımdırsa → hər model 33-35 sual yaradır
  const overshoot = (n: number) => Math.min(n + Math.ceil(n * 0.15), n + 8);

  let round = 0;

  while (collected.length < totalNeeded && timeLeft() > 8_000) {
    round++;
    const remaining = totalNeeded - collected.length;

    // Bu mərhələdə aktiv modellər (rate-limit almamışlar)
    const available = allWorkers.filter(w => !rateLimited.has(w.id));
    if (available.length === 0) {
      console.warn("[gen] Bütün modellər rate-limitdədir.");
      break;
    }

    // Mərhələyə görə model sırası: hər dəfə fərqli modellər öndə olsun
    const offset  = (round - 1) * PARALLEL_COUNT;
    const workers = available.slice(offset % available.length)
      .concat(available.slice(0, offset % available.length))
      .slice(0, PARALLEL_COUNT);

    // Hər model tam lazım olan sual sayı + buffer qədər generasiya edir
    const askCount = overshoot(remaining);

    console.log(
      `[gen] Mərhələ ${round}: ${workers.map(w => w.id.split("/").pop()).join(", ")} | ` +
      `Hər biri ${askCount} sual | Lazım: ${remaining} | Vaxt: ${Math.round(timeLeft() / 1000)}s`
    );

    // Bütün seçilmiş modellərə EYNI ANDA sorğu göndər
    const tasks = workers.map((w, idx) => {
      const hint   = hints[(idx + round * 3) % hints.length];
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
        if (msg.includes("429") || msg.toLowerCase().includes("rate-limit")) {
          rateLimited.add(r.w.id);
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
      // Kiçik fasilə ver ki, rate-limitlər azalsın (yalnız çox qısa vaxt qaldıqda deyil)
      if (timeLeft() > 15_000 && round <= 2) {
        console.log("[gen] Qısa fasilə (3s)...");
        await new Promise(r => setTimeout(r, 3_000));
      }
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

    let systemPrompt = `Sən yüksək keyfiyyətli quiz sualları yaradan ixtisaslaşmış AI assistentsən.

ƏSAS QAYDALAR:
1. Verilən mövzu üzrə dəqiq, aydın test sualları yarat.
2. Bütün suallar və cavablar Azərbaycan dilində olmalıdır.
3. Hər sualın yalnız 1 dəqiq düzgün cavabı olsun.
4. Yanlış variantlar (distraktorlar) inandırıcı olsun — oxşar, amma yanlış.
5. Rəqəm/tarix/ad suallarında yaxın dəyərlər istifadə et.
6. "Hamısı doğrudur" / "Heç biri" tipli variantlardan çəkin.
7. Variantların uzunluğu bir-birinə yaxın olsun.
8. Yalnız JSON formatında cavab ver — başqa heç nə yazma.

JSON FORMATI (dəqiq bu struktur):
{"questions":[{"text":"Sual mətni","options":[{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],"correctOption":"A"}]}`;

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

JSON FORMATI (dəqiq bu struktur, başqa heç nə yazma):
{"questions":[{"text":"Sual mətni","options":[{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],"correctOption":"A"}]}`;
      botContent = (bot.content || "").slice(0, 5000);
    }

    const langLabel = language === "az" ? "Azərbaycan dilində"
                    : language === "ru" ? "Rus dilində"
                    : "İngilis dilində";
    const catLabel  = category || "ümumi bilik";

    const buildPrompt = (count: number, hint: string): string => {
      const ctxPart = botContent
        ? `\n\nBilik bazası (YALNIZ buradan istifadə et):\n---\n${botContent}\n---\n`
        : "";
      const botRule = botId ? "\n- Yalnız verilmiş bilik bazasındakı məlumatlardan istifadə et." : "";

      return `${langLabel} "${title}" mövzusu üzrə DƏQIQ ${count} ədəd test sualı yarat. ${hint}
Kateqoriya: ${catLabel}${ctxPart}
Tələblər:
- Hər sualın 4 variant cavabı olsun (A, B, C, D)
- Yalnız 1 düzgün cavab olsun
- Suallar mövzuya uyğun, aydın və dəqiq olsun
- Yanlış variantlar düzgün cavaba oxşar, amma yanlış olsun${botRule}
- Düzgün cavabları müxtəlif hərflərə (A, B, C, D) paylat

Cavabı YALNIZ JSON formatında ver, DƏQIQ ${count} sual ilə:
{"questions":[{"text":"Sual mətni","options":[{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],"correctOption":"A"}]}`;
    };

    const genResult = await generateQuestions(
      safeCount, systemPrompt, buildPrompt, groqKey, orKey
    );

    if (genResult.questions.length === 0) {
      const isRateLimit = genResult.errors.some(e => e.includes("429") || e.includes("rate-limit"));
      return NextResponse.json(
        {
          error: isRateLimit
            ? "AI API limiti dolub. Bir neçə saniyə gözləyib yenidən cəhd edin."
            : "AI sual yarada bilmədi. Mövzunu dəqiqləşdirərək yenidən cəhd edin.",
          details: genResult.errors.slice(0, 3),
        },
        { status: 502 }
      );
    }

    const normalized = genResult.questions.map(normalizeQuestion);
    const isPartial  = normalized.length < safeCount;

    return NextResponse.json({
      questions: normalized,
      meta: {
        requested: safeCount,
        generated: normalized.length,
        complete:  !isPartial,
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
