import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic    = "force-dynamic";
export const runtime    = "nodejs";
export const maxDuration = 55;

// ─── Timeout ────────────────────────────────────────────────────────────────
const TOTAL_TIMEOUT_MS  = 27_000; // 27s — frontend 30s limitinə uyğun
const WORKER_TIMEOUT_MS = 25_000; // hər worker üçün max vaxt

// ─── Model konfiqurasiyası ───────────────────────────────────────────────────
interface Worker {
  id: string;
  provider: "groq" | "openrouter";
  jsonMode: boolean;
  maxTokens: number;
}

// Araşdırılmış, aktiv pulsuz modellər
const GROQ_WORKERS: Worker[] = [
  { id: "llama-3.3-70b-versatile", provider: "groq", jsonMode: true,  maxTokens: 8000 },
  { id: "llama-3.1-8b-instant",    provider: "groq", jsonMode: false, maxTokens: 4000 },
  { id: "gemma2-9b-it",            provider: "groq", jsonMode: false, maxTokens: 4000 },
  { id: "mixtral-8x7b-32768",      provider: "groq", jsonMode: false, maxTokens: 4000 },
];

const OR_WORKERS: Worker[] = [
  { id: "openrouter/free",                         provider: "openrouter", jsonMode: false, maxTokens: 8000 },
  { id: "deepseek/deepseek-v4-flash:free",         provider: "openrouter", jsonMode: false, maxTokens: 8000 },
  { id: "google/gemma-4-31b-it:free",              provider: "openrouter", jsonMode: false, maxTokens: 8000 },
  { id: "qwen/qwen3-coder:free",                   provider: "openrouter", jsonMode: false, maxTokens: 8000 },
  { id: "minimax/minimax-m2.5:free",               provider: "openrouter", jsonMode: false, maxTokens: 8000 },
  { id: "meta-llama/llama-3.3-70b-instruct:free",  provider: "openrouter", jsonMode: false, maxTokens: 8000 },
  { id: "meta-llama/llama-3.2-3b-instruct:free",  provider: "openrouter", jsonMode: false, maxTokens: 4000 },
];

// ─── JSON parser ──────────────────────────────────────────────────────────────
function extractQuestions(raw: string): any[] | null {
  if (!raw || !raw.trim()) return null;

  // Markdown code block-larını sil
  const text = raw
    .replace(/^```json\s*/im, "")
    .replace(/^```\s*/im, "")
    .replace(/\s*```\s*$/im, "")
    .trim();

  // 3 fərqli JSON parse strategiyası
  const parsers: Array<() => any> = [
    // 1. Düz parse
    () => JSON.parse(text),
    // 2. İlk { ... } bloku
    () => {
      const s = text.indexOf("{");
      const e = text.lastIndexOf("}");
      if (s < 0 || e < 0) throw new Error("no braces");
      return JSON.parse(text.slice(s, e + 1));
    },
    // 3. İlk [ ... ] bloku
    () => {
      const s = text.indexOf("[");
      const e = text.lastIndexOf("]");
      if (s < 0 || e < 0) throw new Error("no brackets");
      return { questions: JSON.parse(text.slice(s, e + 1)) };
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
  // Hər option ya sətir olmalıdır ya da obyekt və text sahəsi olmalıdır
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
  retryCount: number = 0
): Promise<any[]> {
  const key = w.provider === "groq" ? groqKey : orKey;
  if (!key) throw new Error(`[${w.id}] API açarı tapılmadı (missing key)`);

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
      const errData = await res.json().catch(() => null);
      const limitMsg = String(errData?.error?.message || "Rate limit").slice(0, 80);
      
      // Auto-retry one time after 2.5 seconds
      if (retryCount === 0) {
        console.log(`[${w.id}] rate limit retry in 2.5s...`);
        await new Promise(r => setTimeout(r, 2500));
        return callWorker(w, groqKey, orKey, system, userPrompt, 1);
      }
      throw new Error(`[${w.id}] 429 limit: ${limitMsg}`);
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`[${w.id}] HTTP ${res.status}: ${errText.slice(0, 100)}`);
    }

    const data    = await res.json().catch(() => null);
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(`[${w.id}] boş cavab (empty response)`);
    }

    const qs = extractQuestions(content);
    if (!qs) {
      throw new Error(`[${w.id}] JSON parse xətası (content: ${content.slice(0, 50)}...)`);
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
    } else {
      throw e;
    }
  }
}

// ─── Normalize ────────────────────────────────────────────────────────────────
const LABELS = ["A", "B", "C", "D"];

function normalizeQuestion(q: any): any {
  // Options normallaşdır
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
        return {
          label: labelVal,
          text: textVal,
        };
      })
    : LABELS.map(l => ({ label: l, text: "" }));

  // Düzgün cavabın mətni
  const correctLabel = String(q.correctOption || "A").toUpperCase();
  const correctText  = rawOptions.find(o => o.label === correctLabel)?.text
                    || rawOptions[0]?.text
                    || "";

  // Options-ları qarışdır (A-nın hər zaman düzgün olmaması üçün)
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

// ─── Əsas generasiya funksiyası — TAM PARALEL ─────────────────────────────────
async function generateAllParallel(
  totalNeeded: number,
  system:      string,
  buildPrompt: (count: number, hint: string) => string,
  groqKey:     string | undefined,
  orKey:       string | undefined,
): Promise<{ questions: any[]; errors: string[] }> {

  const availableGroq = groqKey ? GROQ_WORKERS : [];
  const availableOR   = orKey   ? OR_WORKERS   : [];
  const allWorkers    = [...availableGroq, ...availableOR];

  if (allWorkers.length === 0) return { questions: [], errors: ["API açarları tapılmadı"] };

  // Fərqlı aspekt göstəriciləri — hər model fərqli suallar yaratması üçün
  const hints = [
    "Diqqət: Çox xırda və az bilinən detallardan (niş) çətin suallar yarat.",
    "Diqqət: Yalnız rəqəmlər, illər, miqdarlar və tarixlərlə bağlı suallar yarat.",
    "Diqqət: Mövzunun ən məşhur faktlarını yoxlayan təməl/ümumi suallar yarat.",
    "Diqqət: Məntiqi ardıcıllıq və səbəb-nəticə əlaqəsi tələb edən analitik suallar yarat.",
    "Diqqət: Təriflər, terminlər və elmi anlayışların izahı ilə bağlı suallar yarat.",
    "Diqqət: Mövzuya aid şəxsiyyətlər, alimlər, yazıçılar və ya liderlərlə bağlı suallar yarat.",
    "Diqqət: İki fərqli anlayışı müqayisə edən və fərqlərini soruşan suallar yarat.",
    "Diqqət: Mövzunun istisnaları, qayda pozuntuları və nadir halları ilə bağlı suallar yarat."
  ];

  // Bütün worker-lər EYNİ ANDA başlayır
  const startTime = Date.now();
  console.log(`[gen] ${allWorkers.length} worker paralel başladı, ${totalNeeded} sual lazımdır`);

  const collected: any[] = [];
  const seen = new Set<string>();
  const errors: string[] = [];

  const addQuestions = (qs: any[]) => {
    for (const q of qs) {
      if (collected.length >= totalNeeded) break;
      const key = (q.text || "").trim().toLowerCase();
      if (key.length > 5 && !seen.has(key)) {
        seen.add(key);
        collected.push(q);
      }
    }
  };

  // Worker-ları işə sal və bitdikcə dərhal addQuestions çağır
  const workerPromises = allWorkers.map(async (w, i) => {
    // 429 xətasına düşməmək üçün API sorğularına kiçik (stagger) gecikmə veririk
    if (i > 0) {
      await new Promise(r => setTimeout(r, i * 400));
    }

    // Hər modeldən tam sayı (və ya azı 30) istəyirik ki, 50 suala tez çataq
    const count  = Math.max(totalNeeded, 30); 
    const hint   = hints[i % hints.length];
    const prompt = buildPrompt(count, hint);
    try {
      const qs = await callWorker(w, groqKey, orKey, system, prompt);
      if (qs && Array.isArray(qs)) {
        addQuestions(qs);
      }
    } catch (e: any) {
      console.error(`[gen] worker ${w.id} failed:`, e?.message);
      errors.push(e?.message || `[${w.id}] Bilinməyən xəta`);
    }
  });

  // Hər 500ms yoxlayırıq ki, ehtiyac olan sayda sual yığılıbmı
  const earlyExitChecker = new Promise<void>(resolve => {
    const interval = setInterval(() => {
      if (collected.length >= totalNeeded) {
        clearInterval(interval);
        resolve();
      }
    }, 500);
    setTimeout(() => {
      clearInterval(interval);
      resolve();
    }, TOTAL_TIMEOUT_MS);
  });

  const safetyTimeout = new Promise<void>(resolve => setTimeout(resolve, TOTAL_TIMEOUT_MS));

  // 3 şərtdən hansı tez bitsə: 
  // 1. Bütün workerlər işini bitirdi
  // 2. Kifayət qədər sual yığıldı (earlyExitChecker)
  // 3. 27s vaxt bitdi (safetyTimeout)
  await Promise.race([
    Promise.all(workerPromises),
    earlyExitChecker,
    safetyTimeout
  ]);

  const elapsed = Date.now() - startTime;
  console.log(`[gen] tamamlandı: ${collected.length}/${totalNeeded} sual, ${elapsed}ms`);

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

    const groqKey = process.env.GROQ_API_KEY;
    const orKey   = process.env.OPENROUTER_API_KEY;
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
    if (questionCount < 1 || questionCount > 50) {
      return NextResponse.json({ error: "Sual sayı 1-50 arasında olmalıdır" }, { status: 400 });
    }

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

      // Bot content — max 3000 simvol (token limitinə görə)
      botContent = (bot.content || "").slice(0, 3000);
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

      return `${langLabel} "${title}" mövzusu üzrə DƏQIQ ${count} ədəd test sualı yarat.${hint}
Kateqoriya: ${catLabel}${ctxPart}
Tələblər:
- Hər sualın 4 variant cavabı olsun (A, B, C, D)
- Yalnız 1 düzgün cavab olsun
- Suallar mövzuya uyğun, aydın və dəqiq olsun
- Yanlış variantlar düzgün cavaba oxşar, amma yanlış olsun${botRule}
- Düzgün cavabları müxtəlif hərflərə (A, B, C, D) paylat — həmişə A olmasın

Cavabı YALNIZ JSON formatında ver, DƏQIQ ${count} sual ilə:
{"questions":[{"text":"Sual mətni","options":[{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],"correctOption":"A"}]}`;
    };

    // ── Paralel generasiya ──
    const genResult = await generateAllParallel(
      questionCount,
      systemPrompt,
      buildPrompt,
      groqKey,
      orKey,
    );

    const rawQuestions = genResult.questions;

    if (rawQuestions.length === 0) {
      const errorDetails = genResult.errors.length > 0
        ? "\n\nƏtraflı xətalar:\n" + genResult.errors.join("\n")
        : "";
      return NextResponse.json(
        { error: `AI sual yarada bilmədi. API limitləri dolmuş ola bilər — bir neçə saniyə gözləyib yenidən cəhd edin.${errorDetails}` },
        { status: 502 }
      );
    }

    const normalized = rawQuestions.map(normalizeQuestion);

    return NextResponse.json({
      questions: normalized,
      meta: {
        requested:  questionCount,
        generated:  normalized.length,
        complete:   normalized.length >= questionCount,
      },
    });

  } catch (err: any) {
    console.error("generate-quiz POST xəta:", err?.message ?? err);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}
