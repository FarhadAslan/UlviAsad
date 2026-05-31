import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic    = "force-dynamic";
export const runtime    = "nodejs";
export const maxDuration = 55;

// ─── Timeout konfiqurasiyası ──────────────────────────────────────────────────
// Backend-də 55s var, amma biz 48s-ə kimi işləyirik (Vercel overhead üçün pay)
const TOTAL_TIMEOUT_MS  = 48_000;
// Hər tək model çağırışı üçün max vaxt
const WORKER_TIMEOUT_MS = 22_000;

// ─── Model konfiqurasiyası ───────────────────────────────────────────────────
interface Worker {
  id: string;
  provider: "groq" | "openrouter";
  jsonMode: boolean;
  maxTokens: number;
  priority: number; // az dəyər = yüksək prioritet
}

// Groq modellər — yüksək sürət, lakin rate limit var
const GROQ_WORKERS: Worker[] = [
  { id: "llama-3.3-70b-versatile",  provider: "groq", jsonMode: true,  maxTokens: 6000, priority: 1 },
  { id: "llama-3.1-8b-instant",     provider: "groq", jsonMode: false, maxTokens: 4000, priority: 3 },
  { id: "gemma2-9b-it",             provider: "groq", jsonMode: false, maxTokens: 4000, priority: 4 },
  { id: "mixtral-8x7b-32768",       provider: "groq", jsonMode: false, maxTokens: 4000, priority: 5 },
];

// OpenRouter pulsuz modellər
const OR_WORKERS: Worker[] = [
  { id: "deepseek/deepseek-r1:free",              provider: "openrouter", jsonMode: false, maxTokens: 6000, priority: 2 },
  { id: "meta-llama/llama-3.3-70b-instruct:free", provider: "openrouter", jsonMode: false, maxTokens: 6000, priority: 2 },
  { id: "google/gemma-2-9b-it:free",              provider: "openrouter", jsonMode: false, maxTokens: 4000, priority: 3 },
  { id: "qwen/qwen-2.5-72b-instruct:free",        provider: "openrouter", jsonMode: false, maxTokens: 4000, priority: 3 },
  { id: "microsoft/phi-3-medium-128k-instruct:free", provider: "openrouter", jsonMode: false, maxTokens: 4000, priority: 4 },
  { id: "meta-llama/llama-3.2-3b-instruct:free",  provider: "openrouter", jsonMode: false, maxTokens: 3000, priority: 5 },
];

// ─── JSON parser ──────────────────────────────────────────────────────────────
function extractQuestions(raw: string): any[] | null {
  if (!raw || !raw.trim()) return null;

  // Markdown code block-larını sil
  let text = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();

  // 4 fərqli JSON parse strategiyası
  const parsers: Array<() => any> = [
    // 1. Düz parse
    () => JSON.parse(text),
    // 2. İlk [ ... ] bloku — massiv formatı
    () => {
      const s = text.indexOf("[");
      const e = text.lastIndexOf("]");
      if (s < 0 || e < 0) throw new Error("no brackets");
      return { questions: JSON.parse(text.slice(s, e + 1)) };
    },
    // 3. İlk { ... } bloku — obyekt formatı
    () => {
      const s = text.indexOf("{");
      const e = text.lastIndexOf("}");
      if (s < 0 || e < 0) throw new Error("no braces");
      return JSON.parse(text.slice(s, e + 1));
    },
    // 4. Birdən çox JSON obyektini birləşdirmə cəhdi
    () => {
      const matches = text.match(/\{[^{}]*"text"[^{}]*\}/g);
      if (!matches || matches.length === 0) throw new Error("no question objects");
      return { questions: matches.map(m => JSON.parse(m)) };
    },
  ];

  for (const parse of parsers) {
    try {
      const parsed = parse();
      // { questions: [...] } formatı
      if (Array.isArray(parsed?.questions) && parsed.questions.length > 0) {
        return parsed.questions;
      }
      // [...] formatı
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // növbəti strategiyaya keç
    }
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
    if (typeof o === "string" && o.trim().length > 0) return true;
    if (typeof o === "object" && typeof o.text === "string" && o.text.trim().length > 0) return true;
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
    temperature: 0.65,
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
      const errData = await res.json().catch(() => null);
      const retryAfter = errData?.error?.message?.match(/try again in (\d+\.?\d*)s/i)?.[1];
      throw new Error(`[${w.id}] 429 rate-limit${retryAfter ? ` (retry in ${retryAfter}s)` : ""}`);
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(`[${w.id}] API açarı səhvdir (${res.status})`);
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`[${w.id}] HTTP ${res.status}: ${errText.slice(0, 100)}`);
    }

    const data    = await res.json().catch(() => null);
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(`[${w.id}] boş cavab`);
    }

    const qs = extractQuestions(content);
    if (!qs) {
      throw new Error(`[${w.id}] JSON parse xətası`);
    }

    const valid = qs.filter(isValidQuestion);
    if (valid.length === 0) {
      throw new Error(`[${w.id}] ${qs.length} sualdan heç biri valid deyil`);
    }

    console.log(`[${w.id}] ✓ ${valid.length}/${qs.length} etibarlı sual`);
    return valid;

  } catch (e: any) {
    clearTimeout(timer);
    if (e?.name === "AbortError") {
      throw new Error(`[${w.id}] timeout (${WORKER_TIMEOUT_MS}ms)`);
    }
    throw e;
  }
}

// ─── Normalize ────────────────────────────────────────────────────────────────
const LABELS = ["A", "B", "C", "D"];

function normalizeQuestion(q: any): any {
  const rawOptions: { label: string; text: string }[] = Array.isArray(q.options)
    ? q.options.map((o: any, i: number) => {
        let textVal = "";
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
  const correctText  = rawOptions.find(o => o.label === correctLabel)?.text
                    || rawOptions[0]?.text
                    || "";

  // Cavabları qarışdır
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

// ─── Əsas generasiya — PARALEL + FALLBACK ─────────────────────────────────────
// Strategiya:
//  1. Prioritet 1 modelləri eyni anda başladır (həqiqi paralel)
//  2. Hansı uğurlu olursa onun cavablarını götürür
//  3. Kifayət etmirsə, növbəti qrup paralel işə salınır
//  4. TOTAL_TIMEOUT_MS yaxınlaşanda dayanır, əldəkini qaytarır
async function generateWithParallelFallback(
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
    "Diqqət: Mövzunun ən məşhur faktlarını yoxlayan aydın suallar yarat.",
    "Diqqət: Rəqəmlər, illər, miqdarlar və tarixlərlə bağlı suallar yarat.",
    "Diqqət: Terminlər, təriflər və elmi anlayışların izahı ilə bağlı suallar yarat.",
    "Diqqət: Məntiqi ardıcıllıq və səbəb-nəticə əlaqəsi tələb edən suallar yarat.",
    "Diqqət: Mövzuya aid şəxsiyyətlər, alimlər, yazıçılar ilə bağlı suallar yarat.",
    "Diqqət: İki fərqli anlayışı müqayisə edən suallar yarat.",
  ];

  const startTime = Date.now();
  const collected: any[] = [];
  const seenKeys  = new Set<string>();
  const errors:    string[] = [];

  const addQuestions = (qs: any[]) => {
    for (const q of qs) {
      if (collected.length >= totalNeeded) break;
      const key = (q.text || "").trim().toLowerCase().slice(0, 60);
      if (key.length > 5 && !seenKeys.has(key)) {
        seenKeys.add(key);
        collected.push(q);
      }
    }
  };

  const timeLeft = () => TOTAL_TIMEOUT_MS - (Date.now() - startTime);

  // Modellər prioritetə görə qruplaşdırılır
  const groups = new Map<number, Worker[]>();
  for (const w of allWorkers) {
    if (!groups.has(w.priority)) groups.set(w.priority, []);
    groups.get(w.priority)!.push(w);
  }
  const priorityLevels = Array.from(groups.keys()).sort((a, b) => a - b);

  for (const priority of priorityLevels) {
    if (collected.length >= totalNeeded) break;
    if (timeLeft() < 5000) {
      console.warn(`[gen] Vaxt limitinə yaxınlaşdıq (${Date.now() - startTime}ms). Dayandırılır.`);
      break;
    }

    const group = groups.get(priority)!;
    const remaining = totalNeeded - collected.length;
    // Hər model öz istəyini göndərir — işin bölüşdürülməsi
    const countPerModel = Math.ceil((remaining + group.length - 1) / group.length);
    const askCount = Math.max(countPerModel, Math.min(remaining + 5, 20));
    const hint = hints[Math.floor(Math.random() * hints.length)];
    const prompt = buildPrompt(askCount, hint);

    console.log(`[gen] Prioritet ${priority}: ${group.length} model paralel başladılır. Lazım: ${remaining}, hər model üçün: ${askCount}`);

    // BU QRUPDAKİ MODELLƏR EYNI ANDA ÇAĞIRILIR
    const results = await Promise.allSettled(
      group.map(w => callWorker(w, groqKey, orKey, system, prompt))
    );

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const w = group[i];
      if (r.status === "fulfilled" && r.value.length > 0) {
        addQuestions(r.value);
        console.log(`[gen] ${w.id}: ${r.value.length} sual. Cəmi: ${collected.length}/${totalNeeded}`);
      } else if (r.status === "rejected") {
        const errMsg = r.reason?.message || `${w.id} uğursuz`;
        console.error(`[gen] ${w.id} xəta:`, errMsg);
        errors.push(errMsg);
      }
    }

    if (collected.length >= totalNeeded) break;
  }

  // Hələ də az sual varsa — ilk uğurlu modeli yenidən çağır (bir dəfə)
  if (collected.length > 0 && collected.length < totalNeeded && timeLeft() > 8000) {
    const remaining = totalNeeded - collected.length;
    const hint = hints[Math.floor(Math.random() * hints.length)];
    const prompt = buildPrompt(remaining + 3, hint);
    
    // En yüksək prioritetli uğurlu modeli tap
    const retryWorker = allWorkers[0];
    console.log(`[gen] Əlavə sual üçün yenidən cəhd: ${retryWorker.id}, lazım: ${remaining}`);
    try {
      const extra = await callWorker(retryWorker, groqKey, orKey, system, prompt);
      addQuestions(extra);
    } catch (e: any) {
      console.warn(`[gen] Əlavə cəhd uğursuz:`, e?.message);
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(`[gen] Tamamlandı. ${collected.length}/${totalNeeded} sual, ${elapsed}ms`);

  return {
    questions: collected.slice(0, totalNeeded),
    errors,
  };
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

    // Groq açarı "gsk_" ilə başlamalıdır. "xai-" prefiksi xAI (Grok) açarıdır, Groq deyil.
    const groqKey = groqKeyRaw?.startsWith("gsk_") ? groqKeyRaw : undefined;
    if (groqKeyRaw && !groqKey) {
      console.warn("[generate-quiz] GROQ_API_KEY formatı səhvdir (gsk_ ilə başlamalıdır). Groq atlanılır.");
    }

    if (!groqKey && !orKey) {
      return NextResponse.json(
        { error: "AI API açarı konfiqurasiya edilməyib." },
        { status: 503 }
      );
    }

    const body = await req.json();
    const {
      title,
      questionCount = 10,
      category,
      language = "az",
      botId,
    } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Quiz başlığı tələb olunur" }, { status: 400 });
    }

    // Sual sayını validasiya et və məhdudlaşdır
    const safeCount = Math.min(50, Math.max(1, parseInt(questionCount) || 10));

    // ── Sistem promptu ──
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

      // Bot content — max 5000 simvol
      botContent = (bot.content || "").slice(0, 5000);
    }

    // ── Prompt builder ──
    const langLabel = language === "az" ? "Azərbaycan dilində"
                    : language === "ru" ? "Rus dilində"
                    : "İngilis dilində";
    const catLabel  = category || "ümumi bilik";

    const buildPrompt = (count: number, hint: string): string => {
      const ctxPart  = botContent
        ? `\n\nBilik bazası (YALNIZ buradan istifadə et):\n---\n${botContent}\n---\n`
        : "";
      const botRule  = botId ? "\n- Yalnız verilmiş bilik bazasındakı məlumatlardan istifadə et." : "";

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

    // ── Paralel generasiya ──
    const genResult = await generateWithParallelFallback(
      safeCount,
      systemPrompt,
      buildPrompt,
      groqKey,
      orKey,
    );

    const rawQuestions = genResult.questions;

    if (rawQuestions.length === 0) {
      // Bütün modellər rate-limit ilə üzləşibsə, açıq mesaj qaytar
      const isRateLimit = genResult.errors.some(e => e.includes("429") || e.includes("rate-limit"));
      const errorMsg = isRateLimit
        ? "AI API limiti dolub. Bir neçə saniyə gözləyib yenidən cəhd edin."
        : "AI sual yarada bilmədi. Mövzunu dəqiqləşdirərək yenidən cəhd edin.";
      
      return NextResponse.json(
        { 
          error: errorMsg,
          details: genResult.errors.slice(0, 3),
        },
        { status: 502 }
      );
    }

    const normalized = rawQuestions.map(normalizeQuestion);
    const isPartial  = normalized.length < safeCount;

    return NextResponse.json({
      questions: normalized,
      meta: {
        requested:  safeCount,
        generated:  normalized.length,
        complete:   !isPartial,
        // partial olduqda frontend-ə xəbər ver
        warning: isPartial
          ? `${safeCount} sual istənildi, ${normalized.length} sual yaradıldı. API limiti ilə bağlı ola bilər.`
          : undefined,
      },
    });

  } catch (err: any) {
    console.error("generate-quiz POST xəta:", err?.message ?? err);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}
