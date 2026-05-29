import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic    = "force-dynamic";
export const runtime    = "nodejs";
export const maxDuration = 55;

// ─── Worker konfiqurasiyası ───────────────────────────────────────────────────
interface Worker {
  id: string;
  provider: "groq" | "openrouter";
  jsonMode: boolean;
  maxTokens: number; // TPM limitinə görə
}

const ALL_WORKERS: Worker[] = [
  // llama-3.3-70b: TPM=12000 → prompt ~1500t, cavab max 8000t
  { id: "llama-3.3-70b-versatile",                provider: "groq",       jsonMode: true,  maxTokens: 8000 },
  // llama-3.1-8b: TPM=6000 → prompt ~1500t, cavab max 4000t
  { id: "llama-3.1-8b-instant",                   provider: "groq",       jsonMode: false, maxTokens: 4000 },
  // OpenRouter — rate limit aşağı olanlar əvvəl
  { id: "openai/gpt-oss-20b:free",                provider: "openrouter", jsonMode: false, maxTokens: 8000 },
  { id: "openai/gpt-oss-120b:free",               provider: "openrouter", jsonMode: false, maxTokens: 8000 },
  { id: "qwen/qwen3-coder:free",                  provider: "openrouter", jsonMode: false, maxTokens: 8000 },
  { id: "z-ai/glm-4.5-air:free",                  provider: "openrouter", jsonMode: false, maxTokens: 8000 },
  { id: "meta-llama/llama-3.3-70b-instruct:free", provider: "openrouter", jsonMode: false, maxTokens: 8000 },
];

// ─── JSON parser ──────────────────────────────────────────────────────────────
function extractQuestions(raw: string): any[] | null {
  if (!raw) return null;
  const text = raw
    .replace(/^```json\s*/im, "")
    .replace(/^```\s*/im, "")
    .replace(/\s*```\s*$/im, "")
    .trim();

  const tries: Array<() => any> = [
    () => JSON.parse(text),
    () => {
      const s = text.indexOf("{"), e = text.lastIndexOf("}");
      if (s < 0 || e < 0) throw 0;
      return JSON.parse(text.slice(s, e + 1));
    },
    () => {
      const s = text.indexOf("["), e = text.lastIndexOf("]");
      if (s < 0 || e < 0) throw 0;
      return { questions: JSON.parse(text.slice(s, e + 1)) };
    },
  ];

  for (const fn of tries) {
    try {
      const p = fn();
      if (Array.isArray(p?.questions) && p.questions.length > 0) return p.questions;
      if (Array.isArray(p) && p.length > 0) return p;
    } catch { /* next */ }
  }
  return null;
}

// ─── Tək model çağırışı ───────────────────────────────────────────────────────
async function callWorker(
  w: Worker,
  groqKey: string | undefined,
  orKey: string | undefined,
  system: string,
  user: string,
  timeoutMs: number = 6000
): Promise<any[] | null> {
  const key = w.provider === "groq" ? groqKey : orKey;
  if (!key) return null;

  const endpoint = w.provider === "groq"
    ? "https://api.groq.com/openai/v1/chat/completions"
    : "https://openrouter.ai/api/v1/chat/completions";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${key}`,
  };
  if (w.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://ulvi-asad-hnez.vercel.app";
    headers["X-Title"]      = "Muellim Portal";
  }

  const body: any = {
    model: w.id,
    messages: [
      { role: "system", content: system },
      { role: "user",   content: user   },
    ],
    temperature: 0.7,
    max_tokens: w.maxTokens,
  };
  if (w.jsonMode) body.response_format = { type: "json_object" };

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(endpoint, { 
      method: "POST", 
      headers, 
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(id);

    if (res.status === 429) {
      // Rate limit — gözlətmə, null qaytar ki caller OpenRouter-ə keçsin
      const errData = await res.json().catch(() => null);
      const errMsg: string = errData?.error?.message || "";
      console.warn(`[${w.id}] 429 rate limit: ${errMsg.slice(0, 100)}`);
      return null;
    }

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(`[${w.id}] HTTP ${res.status}: ${errBody.slice(0, 300)}`);
      return null;
    }

    const data = await res.json().catch(() => null);
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      console.error(`[${w.id}] empty content`);
      return null;
    }

    const qs = extractQuestions(content);
    console.log(`[${w.id}] parsed ${qs?.length ?? 0} questions`);
    if (!qs) console.error(`[${w.id}] parse failed, content=${content.slice(0, 200)}`);
    return qs;
  } catch (e: any) {
    if (e.name === "AbortError") {
      console.warn(`[${w.id}] fetch timeout after ${timeoutMs}ms`);
    } else {
      console.error(`[${w.id}] fetch error: ${e?.message}`);
    }
    return null;
  }
}

async function generateQuestions(
  totalNeeded: number,
  system: string,
  buildPrompt: (count: number, workerIdx: number, attempt: number) => string,
  groqKey: string | undefined,
  orKey: string | undefined,
): Promise<any[]> {
  const startTime = Date.now();
  const MAX_EXECUTION_TIME = 8000; // 8 saniyə limit (Vercel 10s limitinə düşməmək üçün)

  const groqModels  = ALL_WORKERS.filter(w => w.provider === "groq"       && !!groqKey);
  const orModels    = ALL_WORKERS.filter(w => w.provider === "openrouter" && !!orKey);
  if (groqModels.length === 0 && orModels.length === 0) return [];

  const collected: any[] = [];
  const seen = new Set<string>();
  const addAll = (qs: any[]) => {
    for (const q of qs) {
      const k = q.text?.trim().toLowerCase();
      if (k && !seen.has(k)) { seen.add(k); collected.push(q); }
    }
  };

  const getRemainingTime = () => MAX_EXECUTION_TIME - (Date.now() - startTime);

  // 1. Əvvəlcə ən sürətli Groq modelini tək sınayırıq (Dərhal tamamlamaq üçün)
  if (groqModels.length > 0 && getRemainingTime() > 2000) {
    const fastWorker = groqModels[0];
    const ask = Math.min(totalNeeded, 25) + 5; // buffer
    console.log(`[gen] Fast path: using ${fastWorker.id} for ${ask} questions...`);
    const qs = await callWorker(fastWorker, groqKey, orKey, system, buildPrompt(ask, 0, 0), getRemainingTime());
    if (qs && qs.length > 0) {
      addAll(qs);
      console.log(`[gen] Fast path returned ${qs.length} questions. Have: ${collected.length}/${totalNeeded}`);
      // Əgər kifayət qədər varsa, dərhal qayıt
      if (collected.length >= totalNeeded) {
        return collected.slice(0, totalNeeded);
      }
    }
  }

  // 2. Çatışmırsa və vaxt varsa, digər modellərlə paralel davam et
  const MAX_ROUNDS = 2;
  
  for (let round = 0; round < MAX_ROUNDS && collected.length < totalNeeded; round++) {
    const timeRemaining = getRemainingTime();
    if (timeRemaining < 1500) {
      console.warn(`[gen] Time limit reached (${timeRemaining}ms left). Returning partial results.`);
      break; 
    }

    const stillNeed = totalNeeded - collected.length;
    if (stillNeed <= 0) break;

    const roundWorkers: Worker[] = [];
    // Növbəti Groq modeli (əgər birinci uğursuz oldusa)
    if (groqModels.length > 1 && round === 0) {
      roundWorkers.push(groqModels[1]);
    }
    
    // OpenRouter modelləri (rate limitinə görə paralel)
    const orCount = Math.min(3, orModels.length);
    for (let i = 0; i < orCount; i++) {
      const idx = (round * orCount + i) % orModels.length;
      const m = orModels[idx];
      if (!roundWorkers.some(w => w.id === m.id)) roundWorkers.push(m);
    }

    if (roundWorkers.length === 0) break;

    const askEach = Math.min(stillNeed + 5, 25);
    // Timeout hər bir çağırış üçün qalan vaxtdan çox olmamalıdır
    const workerTimeout = Math.min(timeRemaining, 6000);
    console.log(`[gen] Fallback round=${round + 1}, workers=${roundWorkers.length}, askEach=${askEach}, timeout=${workerTimeout}ms`);

    const promises = roundWorkers.map((w, i) =>
      callWorker(w, groqKey, orKey, system, buildPrompt(askEach, i + 1, round), workerTimeout)
    );
    const results = await Promise.allSettled(promises);

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === "fulfilled" && r.value && r.value.length > 0) {
        addAll(r.value);
        if (collected.length >= totalNeeded) break; // Kifayət qədərsə, digərlərini emal etmə
      }
    }

    if (collected.length < totalNeeded && getRemainingTime() > 1000 && round < MAX_ROUNDS - 1) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  console.log(`[gen] final: ${collected.length}/${totalNeeded}`);
  return collected.slice(0, totalNeeded);
}

// ─── Normalize ────────────────────────────────────────────────────────────────
const LABELS = ["A", "B", "C", "D"];

function normalizeQ(q: any, isReview = false): any {
  const raw = Array.isArray(q.options)
    ? q.options.map((o: any) => ({ label: o.label || "A", text: o.text || "" }))
    : [{ label: "A", text: "" }, { label: "B", text: "" }, { label: "C", text: "" }, { label: "D", text: "" }];

  const correctLabel = q.correctOption || "A";
  const correctText  = raw.find((o: any) => o.label === correctLabel)?.text || raw[0]?.text || "";

  const shuffled = [...raw];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  let newCorrect = "A";
  const newOptions = shuffled.map((o: any, idx: number) => {
    const label = LABELS[idx] || String.fromCharCode(65 + idx);
    if (o.text === correctText) newCorrect = label;
    return { label, text: o.text };
  });

  return {
    text: q.text || "",
    imageUrl: q.imageUrl || "",
    questionType: q.questionType || "CHOICE",
    openAnswerExample: q.openAnswerExample || "",
    options: newOptions,
    correctOption: newCorrect,
    points: q.points ?? 1,
    ...(isReview ? { isReview: true } : {}),
  };
}

// ─── DB: bot tarixi ───────────────────────────────────────────────────────────
async function loadBotHistory(userId: string, botId: string) {
  let prevSummary = "";
  let wrongQs: any[] = [];

  try {
    const quizRows = await prisma.$queryRaw<{ quiz_id: string }[]>`
      SELECT id as quiz_id FROM "Quiz"
      WHERE "createdById" = ${userId} AND "sourceBotId" = ${botId}
      ORDER BY "createdAt" DESC LIMIT 20
    `;
    if (!quizRows.length) return { prevSummary, wrongQs };

    const ids = quizRows.map(r => r.quiz_id);
    const quizzes = await prisma.quiz.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        questions: { select: { id: true, text: true, options: true, correctOption: true, points: true, questionType: true } },
        results: { where: { userId }, orderBy: { createdAt: "desc" }, take: 1, select: { answers: true } },
      },
    });

    const prevTexts: string[] = [];
    const statusMap = new Map<string, boolean>();

    for (const quiz of quizzes) {
      let answers: any[] = [];
      try { answers = JSON.parse(quiz.results[0]?.answers || "[]"); } catch { answers = []; }
      const ansMap = new Map(answers.map((a: any) => [a.questionId, !!a.isCorrect]));

      for (const q of quiz.questions) {
        const clean = q.text.replace(/<[^>]+>/g, "").trim();
        if (clean.length > 5) prevTexts.push(clean);
        const norm = clean.toLowerCase();
        const correct = ansMap.get(q.id);
        if (correct === true)  statusMap.set(norm, true);
        else if (correct === false && statusMap.get(norm) !== true) statusMap.set(norm, false);
      }
    }

    const wrongSet = new Set<string>();
    statusMap.forEach((ok, t) => { if (!ok) wrongSet.add(t); });

    if (wrongSet.size > 0) {
      const seenT = new Set<string>();
      outer: for (const quiz of quizzes) {
        for (const q of quiz.questions) {
          if (wrongQs.length >= 10) break outer;
          const norm = q.text.replace(/<[^>]+>/g, "").trim().toLowerCase();
          if (wrongSet.has(norm) && !seenT.has(norm)) {
            seenT.add(norm);
            try {
              wrongQs.push({
                text: q.text,
                options: typeof q.options === "string" ? JSON.parse(q.options) : q.options,
                correctOption: q.correctOption,
                points: q.points ?? 1,
                questionType: q.questionType || "CHOICE",
                imageUrl: "", openAnswerExample: "",
              });
            } catch { /* skip */ }
          }
        }
      }
    }

    if (prevTexts.length > 0) {
      prevSummary = prevTexts.slice(0, 40).map((t, i) => `${i + 1}. ${t.slice(0, 80)}`).join("\n");
    }
  } catch (e: any) {
    console.warn("[loadBotHistory]", e?.message);
  }

  return { prevSummary, wrongQs };
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });

    const groqKey = process.env.GROQ_API_KEY;
    const orKey   = process.env.OPENROUTER_API_KEY;
    if (!groqKey && !orKey) {
      return NextResponse.json({ error: "AI API açarı konfiqurasiya edilməyib." }, { status: 503 });
    }

    const body = await req.json();
    const { title, questionCount = 10, category, language = "az", botId, avoidTexts = [] } = body;

    if (!title?.trim()) return NextResponse.json({ error: "Quiz başlığı tələb olunur" }, { status: 400 });
    if (questionCount < 1 || questionCount > 50) return NextResponse.json({ error: "Sual sayı 1-50 arasında olmalıdır" }, { status: 400 });

    // ── Bot məlumatları ──
    let systemPrompt = `Sən yüksək keyfiyyətli quiz sualları yaradan ixtisaslaşmış AI assistentsən.

ƏSAS QAYDALAR:
1. Verilən mövzu üzrə dəqiq, aydın test sualları yarat.
2. Bütün suallar və cavablar Azərbaycan dilində olmalıdır.
3. "ARTIQ YARADILIB" bölməsindəki sualları YARATMA.

CAVAB VARİANTLARI:
- Yanlış variantlar düzgün cavaba çox oxşar olsun.
- Rəqəm/tarix/ad suallarında yaxın dəyərlər istifadə et (1918 → 1917, 1919, 1920).
- "Hamısı doğrudur" tipli variantlardan çəkin.
- Variantların uzunluğu bir-birinə yaxın olsun.

Cavabı YALNIZ JSON formatında ver:
{"questions":[{"text":"...","options":[{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],"correctOption":"A"}]}`;

    let safeContent = "";
    let prevSummary = "";
    let wrongQs: any[] = [];

    if (botId) {
      const bot = await prisma.aiBot.findUnique({
        where: { id: botId, active: true },
        select: { prompt: true, content: true },
      });
      if (!bot) return NextResponse.json({ error: "Seçilmiş AI bot tapılmadı" }, { status: 404 });

      systemPrompt = `${bot.prompt}

ƏLAVƏ QAYDALAR:
- "ARTIQ YARADILIB" bölməsindəki sualları YARATMA.
- Yanlış variantlar düzgün cavaba çox oxşar olsun.
- Rəqəm/tarix/ad suallarında yaxın dəyərlər istifadə et.
- "Hamısı doğrudur" tipli variantlardan çəkin.

Cavabı YALNIZ JSON formatında ver:
{"questions":[{"text":"...","options":[{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],"correctOption":"A"}]}`;

      // Bot content — max 2000 simvol (token limitinə görə)
      safeContent = (bot.content || "").slice(0, 2000);

      const userId = (session?.user as any)?.id;
      if (userId) {
        const hist = await loadBotHistory(userId, botId);
        prevSummary = hist.prevSummary;
        wrongQs     = hist.wrongQs;
      }
    }

    // ── Prompt builder ──
    const lang     = language === "az" ? "Azərbaycan dilində" : language === "ru" ? "Rus dilində" : "İngilis dilində";
    const catLabel = category || "ümumi bilik";

    const allAvoid = [
      ...avoidTexts.slice(0, 10),
      ...(prevSummary ? prevSummary.split("\n").slice(0, 10) : []),
    ].filter(Boolean);

    const avoidPart = allAvoid.length > 0
      ? `\n\nAŞAĞIDAKI SUALLAR ARTIQ YARADILIB — BUNLARI YARATMA:\n${allAvoid.join("\n")}\n`
      : "";

    const aspects = ["", " Fərqli aspektlərə fokuslan.", " Praktiki suallar yarat.", " Nəzəri suallar yarat.", " Müqayisəli suallar yarat."];

    const buildPrompt = (count: number, workerIdx: number, attempt: number): string => {
      const ctx   = safeContent ? `\n\nBilik bazası:\n---\n${safeContent}\n---\n` : "";
      const hint  = aspects[workerIdx % aspects.length] || "";
      const retry = attempt > 0 ? ` (cəhd ${attempt + 1} — tamamilə fərqli suallar yarat)` : "";

      return `${lang} "${title}" mövzusu üzrə DƏQIQ ${count} ədəd test sualı yarat.${hint}${retry}
Kateqoriya: ${catLabel}${ctx}${avoidPart}
Tələblər:
- Hər sualın 4 variant cavabı olsun (A, B, C, D)
- Yalnız 1 düzgün cavab olsun
- Suallar mövzuya uyğun, aydın və dəqiq olsun
- Yanlış variantlar düzgün cavaba çox oxşar olsun
- Rəqəm/tarix/ad suallarında yaxın dəyərlər istifadə et
${botId ? "- Yalnız verilmiş bilik bazasından istifadə et" : ""}

Cavabı YALNIZ JSON formatında ver, ${count} sual ilə:
{"questions":[{"text":"Sual mətni","options":[{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],"correctOption":"A"}]}`;
    };

    // ── Sual generasiyası ──
    const rawQs = await generateQuestions(questionCount, systemPrompt, buildPrompt, groqKey, orKey);

    if (rawQs.length === 0) {
      return NextResponse.json(
        { error: "AI sual yarada bilmədi. API limitləri dolmuş ola bilər — bir neçə saniyə gözləyib yenidən cəhd edin." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      questions:       rawQs.map(q => normalizeQ(q, false)),
      reviewQuestions: wrongQs.map(q => normalizeQ(q, true)),
      meta: { requested: questionCount, generated: rawQs.length },
    });

  } catch (err: any) {
    console.error("generate-quiz error:", err?.message ?? err);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}
