import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic    = "force-dynamic";
export const runtime    = "nodejs";
export const maxDuration = 55;

// ─── Timeout konfiqurasiyası ──────────────────────────────────────────────────
const TOTAL_TIMEOUT_MS  = 48_000; // 48s (Vercel overhead üçün pay)
const WORKER_TIMEOUT_MS = 20_000; // hər tək model çağırışı üçün max vaxt

// ─── Model konfiqurasiyası ───────────────────────────────────────────────────
interface Worker {
  id: string;
  provider: "groq" | "openrouter";
  jsonMode: boolean;
  maxTokens: number;
  priority: number;
}

const GROQ_WORKERS: Worker[] = [
  { id: "llama-3.3-70b-versatile",  provider: "groq", jsonMode: true,  maxTokens: 6000, priority: 1 },
  { id: "llama-3.1-8b-instant",     provider: "groq", jsonMode: false, maxTokens: 4000, priority: 2 },
  { id: "gemma2-9b-it",             provider: "groq", jsonMode: false, maxTokens: 4000, priority: 3 },
  { id: "mixtral-8x7b-32768",       provider: "groq", jsonMode: false, maxTokens: 4000, priority: 4 },
];

const OR_WORKERS: Worker[] = [
  { id: "deepseek/deepseek-r1:free",                 provider: "openrouter", jsonMode: false, maxTokens: 6000, priority: 1 },
  { id: "meta-llama/llama-3.3-70b-instruct:free",    provider: "openrouter", jsonMode: false, maxTokens: 6000, priority: 2 },
  { id: "google/gemma-2-9b-it:free",                 provider: "openrouter", jsonMode: false, maxTokens: 4000, priority: 3 },
  { id: "qwen/qwen-2.5-72b-instruct:free",           provider: "openrouter", jsonMode: false, maxTokens: 4000, priority: 3 },
  { id: "microsoft/phi-3-medium-128k-instruct:free", provider: "openrouter", jsonMode: false, maxTokens: 4000, priority: 4 },
  { id: "meta-llama/llama-3.2-3b-instruct:free",     provider: "openrouter", jsonMode: false, maxTokens: 3000, priority: 5 },
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
    () => {
      const matches = text.match(/\{[^{}]*"text"[^{}]*\}/g);
      if (!matches?.length) throw new Error("no question objects");
      return { questions: matches.map(m => JSON.parse(m)) };
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
    if (!content) throw new Error(`[${w.id}] boş cavab`);

    const qs = extractQuestions(content);
    if (!qs) throw new Error(`[${w.id}] JSON parse xətası`);

    const valid = qs.filter(isValidQuestion);
    if (valid.length === 0) throw new Error(`[${w.id}] ${qs.length} sualdan heç biri valid deyil`);

    console.log(`[${w.id}] ✓ ${valid.length}/${qs.length} etibarlı sual`);
    return valid;

  } catch (e: any) {
    clearTimeout(timer);
    if (e?.name === "AbortError") throw new Error(`[${w.id}] timeout (${WORKER_TIMEOUT_MS}ms)`);
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

// ─── CHUNK-BASED PARALEL DİSTRİBUTİON ────────────────────────────────────────
//
// PROBLEM: 30 sual istəyəndə tək modelə "30 sual ver" desək — model rate-limit
//          alır, az sual (bəzən heç) qaytarır.
//
// HƏLL: "Divide and Conquer" — sual sayını kiçik CHUNK-lara böl, hər chunk-u
//       ayrı bir modelə ver. Belə etdikdə:
//       • Hər model az sual yaratdığı üçün rate-limitə düşmür
//       • 6 model * 5 sual = 30 sual → tam sayda sual
//       • Biri limitə düşsə, digərləri davam edir
//       • Hər mərhələdə çatışmayan suallar yenidən paylaşdırılır
//
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

  const startTime     = Date.now();
  const collected: any[] = [];
  const seenKeys      = new Set<string>();
  const errors: string[] = [];
  const rateLimited   = new Set<string>(); // Rate limit alan modelləri izlə

  const timeLeft = () => TOTAL_TIMEOUT_MS - (Date.now() - startTime);

  // Unikal sualları əlavə et, qaytarılan sayı ver
  const addQuestions = (qs: any[]): number => {
    let added = 0;
    for (const q of qs) {
      const key = (q.text || "").trim().toLowerCase().slice(0, 60);
      if (key.length > 5 && !seenKeys.has(key)) {
        seenKeys.add(key);
        collected.push(q);
        added++;
      }
    }
    return added;
  };

  // ── MAX CHUNK ölçüsü ─────────────────────────────────────────────────────────
  // Bir model bir sorğuda bu qədər sual yarada bilər — rate limit həddi
  // Groq: RPM (requests per minute) və TPD (tokens per day) limitləri var
  // Bu dəyər artıq olarsa rate-limit artır; azsa daha çox model lazım olur
  const MAX_CHUNK = 8;

  let round = 0;
  const MAX_ROUNDS = 5;

  while (collected.length < totalNeeded && timeLeft() > 8_000 && round < MAX_ROUNDS) {
    round++;
    const remaining = totalNeeded - collected.length;

    // Bu mərhələdə aktiv (rate-limitə düşməmiş) modelləri seç
    const active = allWorkers.filter(w => !rateLimited.has(w.id));
    if (active.length === 0) {
      console.warn("[gen] Bütün modellər rate-limitdədir. Dayanılır.");
      break;
    }

    // Neçə model lazım olduğunu hesabla — lazımdan çox model istifadə etmə
    const workersNeeded = Math.min(active.length, Math.ceil(remaining / MAX_CHUNK));
    const workers = active.slice(0, workersNeeded);

    // Hər model neçə sual yaratmalı
    // +3 deduplikasiya payı (bəzən modellər eyni sual verə bilər)
    const askEach = Math.min(Math.ceil(remaining / workers.length) + 3, MAX_CHUNK);

    console.log(
      `[gen] Mərhələ ${round}: ${workers.length} model paralel, ` +
      `hər biri ${askEach} sual, lazım: ${remaining}, vaxt: ${Math.round(timeLeft() / 1000)}s`
    );

    // Bütün seçilmiş modellərə EYNI ANDA fərqli hint ilə sorğu göndər
    const tasks = workers.map((w, idx) => {
      // Hər model fərqli hint alsın ki, fərqli tip suallar gəlsin
      const hint   = hints[(idx + round * 2) % hints.length];
      const prompt = buildPrompt(askEach, hint);
      return callWorker(w, groqKey, orKey, system, prompt)
        .then(qs  => ({ w, qs, ok: true  as const }))
        .catch(err => ({ w, err, ok: false as const }));
    });

    const results = await Promise.all(tasks);
    let gotNewThisRound = false;

    for (const r of results) {
      if (r.ok) {
        const added = addQuestions(r.qs);
        if (added > 0) gotNewThisRound = true;
        console.log(
          `[gen] ✓ ${r.w.id}: ${r.qs.length} sual aldı, ${added} yeni əlavə edildi. ` +
          `Cəmi: ${collected.length}/${totalNeeded}`
        );
      } else {
        const msg: string = (r as any).err?.message || `${r.w.id} uğursuz`;
        console.warn(`[gen] ✗ ${r.w.id}:`, msg);

        // Rate-limit alan modeli növbəti mərhələdən çıxar
        if (msg.includes("429") || msg.toLowerCase().includes("rate-limit")) {
          rateLimited.add(r.w.id);
          console.warn(`[gen] ${r.w.id} rate-limitə düşdü, növbəti mərhələdə istifadə edilməyəcək.`);
        }

        if (!errors.includes(msg)) errors.push(msg);
      }
    }

    // Bu mərhələdə heç yeni sual gəlmədisə — daha gözləməyin mənası yoxdur
    if (!gotNewThisRound) {
      console.warn(`[gen] Mərhələ ${round}-də heç yeni sual əldə edilmədi. Dayandırılır.`);
      break;
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(
    `[gen] Tamamlandı. ${collected.length}/${totalNeeded} sual, ` +
    `${elapsed}ms, ${round} mərhələ. Rate-limitə düşən: ${rateLimited.size} model.`
  );

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

    // Groq açarı "gsk_" ilə başlamalıdır — "xai-" xAI (Grok) açarıdır, Groq deyil
    const groqKey = groqKeyRaw?.startsWith("gsk_") ? groqKeyRaw : undefined;
    if (groqKeyRaw && !groqKey) {
      console.warn("[generate-quiz] GROQ_API_KEY formatı səhvdir (gsk_ ilə başlamalıdır). Groq atlanılır.");
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

      botContent = (bot.content || "").slice(0, 5000);
    }

    // ── Prompt builder ──
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

    // ── Generasiya ──
    const genResult = await generateWithParallelFallback(
      safeCount,
      systemPrompt,
      buildPrompt,
      groqKey,
      orKey,
    );

    const rawQuestions = genResult.questions;

    if (rawQuestions.length === 0) {
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

    const normalized = rawQuestions.map(normalizeQuestion);
    const isPartial  = normalized.length < safeCount;

    return NextResponse.json({
      questions: normalized,
      meta: {
        requested: safeCount,
        generated: normalized.length,
        complete:  !isPartial,
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
