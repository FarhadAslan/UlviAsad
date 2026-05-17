import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// ─── Model konfiqurasiyası ────────────────────────────────────────────────────
interface ModelConfig {
  id: string;
  provider: "groq" | "openrouter";
  jsonMode: boolean;
}

const GROQ_MODELS: ModelConfig[] = [
  { id: "llama-3.3-70b-versatile",                   provider: "groq", jsonMode: true  },
  { id: "llama-3.1-8b-instant",                      provider: "groq", jsonMode: true  },
  { id: "meta-llama/llama-4-scout-17b-16e-instruct", provider: "groq", jsonMode: false },
  { id: "openai/gpt-oss-120b",                       provider: "groq", jsonMode: true  },
];

const OR_MODELS: ModelConfig[] = [
  { id: "meta-llama/llama-3.3-70b-instruct:free",    provider: "openrouter", jsonMode: false },
  { id: "meta-llama/llama-3.1-8b-instruct:free",     provider: "openrouter", jsonMode: false },
  { id: "mistralai/mistral-7b-instruct:free",        provider: "openrouter", jsonMode: false },
];

// ─── JSON parser ──────────────────────────────────────────────────────────────
function extractQuestions(raw: string): any[] | null {
  if (!raw) return null;

  let text = raw
    .replace(/^```json\s*/im, "")
    .replace(/^```\s*/im, "")
    .replace(/\s*```\s*$/im, "")
    .trim();

  const attempts = [
    () => JSON.parse(text),
    () => {
      const s = text.indexOf("{"), e = text.lastIndexOf("}");
      if (s === -1 || e === -1) throw new Error();
      return JSON.parse(text.slice(s, e + 1));
    },
    () => {
      const s = text.indexOf("["), e = text.lastIndexOf("]");
      if (s === -1 || e === -1) throw new Error();
      return { questions: JSON.parse(text.slice(s, e + 1)) };
    },
  ];

  for (const fn of attempts) {
    try {
      const p = fn();
      if (Array.isArray(p?.questions) && p.questions.length > 0) return p.questions;
      if (Array.isArray(p) && p.length > 0) return p;
    } catch { /* next */ }
  }
  return null;
}

// ─── Tək model sorğusu ────────────────────────────────────────────────────────
async function callModel(
  cfg: ModelConfig,
  groqKey: string | undefined,
  orKey: string | undefined,
  systemPrompt: string,
  userPrompt: string,
): Promise<any[] | null> {
  const apiKey = cfg.provider === "groq" ? groqKey : orKey;
  if (!apiKey) return null;

  const endpoint =
    cfg.provider === "groq"
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://openrouter.ai/api/v1/chat/completions";

  const extraHeaders: Record<string, string> =
    cfg.provider === "openrouter"
      ? { "HTTP-Referer": "https://ulvi-asad-hnez.vercel.app", "X-Title": "Muellim Portal" }
      : {};

  const body: any = {
    model: cfg.id,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: userPrompt   },
    ],
    temperature: 0.7,
    max_tokens: 4000,
  };
  if (cfg.jsonMode) body.response_format = { type: "json_object" };

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    });

    if (res.status === 429) { console.warn(`[${cfg.id}] rate limit`); return null; }
    if (!res.ok)            { console.warn(`[${cfg.id}] HTTP ${res.status}`); return null; }

    const data = await res.json().catch(() => null);
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;

    return extractQuestions(content);
  } catch (err: any) {
    console.warn(`[${cfg.id}] error: ${err?.message}`);
    return null;
  }
}

// ─── Worker: öz payını toplayana qədər retry ─────────────────────────────────
// Hər worker müstəqil işləyir — lazım olan sayı toplayana qədər
// fərqli modelləri sırayla sınayır.
async function worker(
  needed: number,
  systemPrompt: string,
  buildPrompt: (count: number, attempt: number) => string,
  groqKey: string | undefined,
  orKey: string | undefined,
  maxAttempts = 6,
): Promise<any[]> {
  const collected: any[] = [];
  const seenTexts = new Set<string>();

  // Mövcud modellərin siyahısı (groq + openrouter)
  const allModels: ModelConfig[] = [
    ...(groqKey ? GROQ_MODELS : []),
    ...(orKey   ? OR_MODELS   : []),
  ];

  if (allModels.length === 0) return [];

  let attempt = 0;

  while (collected.length < needed && attempt < maxAttempts) {
    const stillNeed = needed - collected.length;
    // Bir az artıq istə — bəzən az gəlir
    const askFor = stillNeed + Math.max(2, Math.ceil(stillNeed * 0.3));

    // Bu cəhddə hansı modeli istifadə et (rotation)
    const model = allModels[attempt % allModels.length];
    const userPrompt = buildPrompt(askFor, attempt);

    const questions = await callModel(model, groqKey, orKey, systemPrompt, userPrompt);

    if (Array.isArray(questions) && questions.length > 0) {
      for (const q of questions) {
        const key = q.text?.trim().toLowerCase();
        if (key && !seenTexts.has(key)) {
          seenTexts.add(key);
          collected.push(q);
        }
        if (collected.length >= needed) break;
      }
    }

    attempt++;

    // Hələ çatmırsa qısa gözlə
    if (collected.length < needed && attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return collected.slice(0, needed);
}

// ─── Paralel worker strategiyası ─────────────────────────────────────────────
// totalCount sualı bir neçə worker-ə böl, hamısı eyni anda işləsin.
// Hər worker öz payını toplayana qədər retry edir.
async function generateParallel(
  totalCount: number,
  systemPrompt: string,
  buildPrompt: (count: number, workerIdx: number, attempt: number) => string,
  groqKey: string | undefined,
  orKey: string | undefined,
): Promise<any[]> {
  // Worker sayını müəyyən et — çox worker = daha sürətli, amma rate limit riski
  // Optimal: 3-4 worker
  const WORKER_COUNT = Math.min(4, Math.ceil(totalCount / 10));
  const baseShare = Math.floor(totalCount / WORKER_COUNT);
  const remainder = totalCount % WORKER_COUNT;

  // Hər worker-ə pay ver
  const workerTasks = Array.from({ length: WORKER_COUNT }, (_, i) => {
    const share = baseShare + (i < remainder ? 1 : 0);
    if (share === 0) return Promise.resolve([] as any[]);

    return worker(
      share,
      systemPrompt,
      (count, attempt) => buildPrompt(count, i, attempt),
      groqKey,
      orKey,
    );
  });

  // Hamısını paralel işlət
  const results = await Promise.all(workerTasks);

  // Nəticələri birləşdir, dublikatları sil
  const allQuestions: any[] = [];
  const seenTexts = new Set<string>();

  for (const qs of results) {
    for (const q of qs) {
      const key = q.text?.trim().toLowerCase();
      if (key && !seenTexts.has(key)) {
        seenTexts.add(key);
        allQuestions.push(q);
      }
    }
  }

  // Hələ çatmırsa — əlavə tək worker ilə tamamla
  if (allQuestions.length < totalCount) {
    const deficit = totalCount - allQuestions.length;
    console.log(`[parallel] ${deficit} sual çatmır, fill-up worker işə salınır...`);

    const avoidList = allQuestions.slice(0, 40).map((q: any) => q.text?.slice(0, 80)).filter(Boolean);
    const avoidNote = avoidList.length > 0
      ? `\n\nBU SUALLAR ARTIQ VAR — BUNLARA OXŞAR YARATMA:\n${avoidList.join("\n")}\n`
      : "";

    const extra = await worker(
      deficit,
      systemPrompt,
      (count, attempt) => buildPrompt(count, 99, attempt) + avoidNote,
      groqKey,
      orKey,
    );

    for (const q of extra) {
      const key = q.text?.trim().toLowerCase();
      if (key && !seenTexts.has(key)) {
        seenTexts.add(key);
        allQuestions.push(q);
        if (allQuestions.length >= totalCount) break;
      }
    }
  }

  return allQuestions.slice(0, totalCount);
}

// ─── Normalize ────────────────────────────────────────────────────────────────
const LABELS = ["A", "B", "C", "D"];

function normalizeQuestion(q: any, isReview = false): any {
  const rawOptions = Array.isArray(q.options)
    ? q.options.map((o: any) => ({ label: o.label || "A", text: o.text || "" }))
    : [
        { label: "A", text: "" }, { label: "B", text: "" },
        { label: "C", text: "" }, { label: "D", text: "" },
      ];

  const correctLabel = q.correctOption || "A";
  const correctText  = rawOptions.find((o: any) => o.label === correctLabel)?.text || rawOptions[0]?.text || "";

  const shuffled = [...rawOptions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  let newCorrectLabel = "A";
  const newOptions = shuffled.map((o: any, idx: number) => {
    const label = LABELS[idx] || String.fromCharCode(65 + idx);
    if (o.text === correctText) newCorrectLabel = label;
    return { label, text: o.text };
  });

  return {
    text: q.text || "",
    imageUrl: q.imageUrl || "",
    questionType: q.questionType || "CHOICE",
    openAnswerExample: q.openAnswerExample || "",
    options: newOptions,
    correctOption: newCorrectLabel,
    points: q.points ?? 1,
    ...(isReview ? { isReview: true } : {}),
  };
}

// ─── DB: əvvəlki suallar + səhv suallar ──────────────────────────────────────
async function loadBotHistory(userId: string, botId: string) {
  let previousQuestionsSummary = "";
  let wrongAnsweredQuestions: any[] = [];

  try {
    const quizRows = await prisma.$queryRaw<{ quiz_id: string }[]>`
      SELECT id as quiz_id FROM "Quiz"
      WHERE "createdById" = ${userId} AND "sourceBotId" = ${botId}
      ORDER BY "createdAt" DESC LIMIT 20
    `;

    if (quizRows.length === 0) return { previousQuestionsSummary, wrongAnsweredQuestions };

    const ids = quizRows.map((r) => r.quiz_id);
    const previousQuizzes = await prisma.quiz.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        questions: {
          select: { id: true, text: true, options: true, correctOption: true, points: true, questionType: true },
        },
        results: {
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { answers: true },
        },
      },
    });

    const allPrevTexts: string[] = [];
    const questionStatusMap = new Map<string, boolean>();

    for (const pq of previousQuizzes) {
      const lastResult = pq.results[0];
      let answersArr: any[] = [];
      if (lastResult?.answers) {
        try { answersArr = JSON.parse(lastResult.answers); } catch { answersArr = []; }
      }
      const answerMap = new Map<string, boolean>();
      for (const ans of answersArr) {
        if (ans.questionId) answerMap.set(ans.questionId, !!ans.isCorrect);
      }

      for (const q of pq.questions) {
        const cleanText = q.text.replace(/<[^>]+>/g, "").trim();
        if (cleanText.length > 5) allPrevTexts.push(cleanText);
        const isCorrect = answerMap.get(q.id);
        const norm = cleanText.toLowerCase();
        if (isCorrect === true) {
          questionStatusMap.set(norm, true);
        } else if (isCorrect === false && questionStatusMap.get(norm) !== true) {
          questionStatusMap.set(norm, false);
        }
      }
    }

    const wrongTextSet = new Set<string>();
    questionStatusMap.forEach((correct, text) => { if (!correct) wrongTextSet.add(text); });

    if (wrongTextSet.size > 0) {
      const seenTexts = new Set<string>();
      for (const pq of previousQuizzes) {
        if (wrongAnsweredQuestions.length >= 10) break;
        for (const q of pq.questions) {
          if (wrongAnsweredQuestions.length >= 10) break;
          const cleanText = q.text.replace(/<[^>]+>/g, "").trim();
          const norm = cleanText.toLowerCase();
          if (wrongTextSet.has(norm) && !seenTexts.has(norm)) {
            seenTexts.add(norm);
            try {
              wrongAnsweredQuestions.push({
                text: q.text,
                options: typeof q.options === "string" ? JSON.parse(q.options) : q.options,
                correctOption: q.correctOption,
                points: q.points ?? 1,
                questionType: q.questionType || "CHOICE",
                imageUrl: "",
                openAnswerExample: "",
              });
            } catch { /* skip */ }
          }
        }
      }
    }

    if (allPrevTexts.length > 0) {
      previousQuestionsSummary = allPrevTexts
        .slice(0, 60)
        .map((t, i) => `${i + 1}. ${t.slice(0, 100)}`)
        .join("\n");
    }
  } catch (err: any) {
    console.warn("[loadBotHistory] DB xətası:", err?.message);
  }

  return { previousQuestionsSummary, wrongAnsweredQuestions };
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
      return NextResponse.json({ error: "AI API açarı konfiqurasiya edilməyib." }, { status: 503 });
    }

    const body = await req.json();
    const {
      title,
      questionCount = 10,
      category,
      language = "az",
      botId,
      avoidTexts = [],
    } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Quiz başlığı tələb olunur" }, { status: 400 });
    }
    if (questionCount < 1 || questionCount > 50) {
      return NextResponse.json({ error: "Sual sayı 1-50 arasında olmalıdır" }, { status: 400 });
    }

    // ── Bot məlumatları ──
    let systemPrompt = `Sən yüksək keyfiyyətli quiz sualları yaradan ixtisaslaşmış AI assistentsən.

ƏSAS QAYDALAR:
1. Verilən mövzu üzrə dəqiq, aydın test sualları yarat.
2. Bütün suallar və cavablar Azərbaycan dilində olmalıdır.
3. "ARTIQ YARADILIB" bölməsindəki sualları və oxşarlarını YARATMA.

CAVAB VARİANTLARI:
- Yanlış variantlar düzgün cavaba çox oxşar olsun.
- Rəqəm/tarix/ad suallarında yaxın dəyərlər istifadə et (1918 → 1917, 1919, 1920).
- "Hamısı doğrudur" tipli variantlardan çəkin.
- Variantların uzunluğu bir-birinə yaxın olsun.

Cavabı YALNIZ JSON formatında ver:
{"questions":[{"text":"...","options":[{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],"correctOption":"A"}]}`;

    let botContent = "";
    let previousQuestionsSummary = "";
    let wrongAnsweredQuestions: any[] = [];

    if (botId) {
      const bot = await prisma.aiBot.findUnique({
        where: { id: botId, active: true },
        select: { name: true, prompt: true, content: true },
      });

      if (!bot) {
        return NextResponse.json({ error: "Seçilmiş AI bot tapılmadı" }, { status: 404 });
      }

      systemPrompt = `${bot.prompt}

ƏLAVƏ QAYDALAR:
- "ARTIQ YARADILIB" bölməsindəki sualları YARATMA.
- Yanlış variantlar düzgün cavaba çox oxşar olsun.
- Rəqəm/tarix/ad suallarında yaxın dəyərlər istifadə et.
- "Hamısı doğrudur" tipli variantlardan çəkin.

Cavabı YALNIZ JSON formatında ver:
{"questions":[{"text":"...","options":[{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],"correctOption":"A"}]}`;

      botContent = bot.content || "";

      const userId = (session?.user as any)?.id;
      if (userId) {
        const history = await loadBotHistory(userId, botId);
        previousQuestionsSummary = history.previousQuestionsSummary;
        wrongAnsweredQuestions   = history.wrongAnsweredQuestions;
      }
    }

    // ── Prompt builder ──
    const langLabel     = language === "az" ? "Azərbaycan dilində" : language === "ru" ? "Rus dilində" : "İngilis dilində";
    const categoryLabel = category || "ümumi bilik";
    const contextPart   = botContent ? `\n\nBilik bazası:\n---\n${botContent.slice(0, 3000)}\n---\n` : "";

    const allAvoidTexts = [
      ...avoidTexts.slice(0, 30),
      ...(previousQuestionsSummary ? previousQuestionsSummary.split("\n").slice(0, 30) : []),
    ].filter(Boolean);

    const avoidPart = allAvoidTexts.length > 0
      ? `\n\nAŞAĞIDAKI SUALLAR ARTIQ YARADILIB — BUNLARI VƏ BUNLARA OXŞAR SUALLAR YARATMA:\n---\n${allAvoidTexts.join("\n")}\n---\n`
      : "";

    const aspectHints = [
      "",
      " Fərqli aspektlərə fokuslan.",
      " Praktiki tətbiq sualları yarat.",
      " Tarixi və nəzəri suallar yarat.",
      " Müqayisəli suallar yarat.",
    ];

    // buildPrompt: workerIdx fərqli aspektlər üçün, attempt retry sayı
    const buildPrompt = (count: number, workerIdx: number, attempt: number): string => {
      const hint = aspectHints[workerIdx % aspectHints.length] || "";
      const retryNote = attempt > 0 ? ` (cəhd ${attempt + 1} — əvvəlkindən tamamilə fərqli suallar yarat)` : "";
      return `${langLabel} "${title}" mövzusu üzrə DƏQIQ ${count} ədəd test sualı yarat.${hint}${retryNote} Nə az, nə çox — məhz ${count} sual.
Kateqoriya: ${categoryLabel}${contextPart}${avoidPart}
Tələblər:
- Hər sualın 4 variant cavabı olsun (A, B, C, D)
- Yalnız 1 düzgün cavab olsun
- Suallar mövzuya uyğun, aydın və dəqiq olsun
- Yanlış variantlar düzgün cavaba çox oxşar olsun
- Rəqəm/tarix/ad suallarında yaxın dəyərlər istifadə et
- Variantların uzunluğu bir-birinə yaxın olsun
${botId ? "- Yalnız verilmiş bilik bazasından istifadə et" : ""}

Cavabı YALNIZ JSON formatında ver, ${count} sual ilə:
{"questions":[{"text":"Sual mətni","options":[{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],"correctOption":"A"}]}`;
    };

    // ── Paralel generasiya ──
    const rawQuestions = await generateParallel(
      questionCount,
      systemPrompt,
      buildPrompt,
      groqKey,
      orKey,
    );

    if (rawQuestions.length === 0) {
      return NextResponse.json(
        { error: "AI sual yarada bilmədi. Groq/OpenRouter limiti dolmuş ola bilər — bir neçə saniyə gözləyib yenidən cəhd edin." },
        { status: 502 }
      );
    }

    const normalized      = rawQuestions.map((q) => normalizeQuestion(q, false));
    const normalizedWrong = wrongAnsweredQuestions.map((q) => normalizeQuestion(q, true));

    return NextResponse.json({
      questions:       normalized,
      reviewQuestions: normalizedWrong,
      meta: {
        requested: questionCount,
        generated: normalized.length,
      },
    });
  } catch (err: any) {
    console.error("AI generate-quiz error:", err?.message ?? err);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}
