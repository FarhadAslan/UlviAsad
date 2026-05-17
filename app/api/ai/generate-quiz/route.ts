import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60; // Tək batch üçün 60s kifayətdir

// Groq modellər — JSON mode dəstəkləyir
const GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "openai/gpt-oss-120b",
];

// OpenRouter — fallback
const OPENROUTER_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "meta-llama/llama-3.1-8b-instruct:free",
  "mistralai/mistral-7b-instruct:free",
  "openrouter/auto",
];

// JSON mətnindən sualları çıxar
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
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error("no object");
      return JSON.parse(text.slice(start, end + 1));
    },
    () => {
      const start = text.indexOf("[");
      const end = text.lastIndexOf("]");
      if (start === -1 || end === -1) throw new Error("no array");
      return { questions: JSON.parse(text.slice(start, end + 1)) };
    },
  ];

  for (const attempt of attempts) {
    try {
      const parsed = attempt();
      if (Array.isArray(parsed?.questions) && parsed.questions.length > 0) return parsed.questions;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch { /* növbəti */ }
  }
  return null;
}

// Tək AI sorğusu
async function callAI(opts: {
  endpoint: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  extraHeaders?: Record<string, string>;
  useJsonMode?: boolean;
}): Promise<any[] | null> {
  const { endpoint, apiKey, model, systemPrompt, userPrompt,
    extraHeaders = {}, useJsonMode = true } = opts;

  const body: any = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 4000,
  };

  if (useJsonMode) {
    body.response_format = { type: "json_object" };
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    });

    if (res.status === 429) {
      console.warn(`[${model}] rate limit 429`);
      return null;
    }
    if (!res.ok) {
      console.error(`[${model}] HTTP ${res.status}`);
      return null;
    }

    const data = await res.json().catch(() => null);
    if (!data) return null;

    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    return extractQuestions(content);
  } catch (err: any) {
    console.error(`[${model}] fetch error:`, err?.message);
    return null;
  }
}

// Groq ilə sorğu
function callGroq(apiKey: string, model: string, system: string, user: string) {
  return callAI({
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    apiKey, model, systemPrompt: system, userPrompt: user, useJsonMode: true,
  });
}

// OpenRouter ilə sorğu
function callOpenRouter(apiKey: string, model: string, system: string, user: string) {
  return callAI({
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    apiKey, model, systemPrompt: system, userPrompt: user, useJsonMode: false,
    extraHeaders: {
      "HTTP-Referer": "https://ulvi-asad-hnez.vercel.app",
      "X-Title": "Muellim Portal",
    },
  });
}

// Bir batch üçün sual al — bütün modelləri sırayla sına
async function fetchBatch(
  needed: number,
  systemPrompt: string,
  userPrompt: string,
  groqKey: string | undefined,
  orKey: string | undefined,
): Promise<any[]> {
  // Groq modelləri sırayla sına
  if (groqKey) {
    for (const model of GROQ_MODELS) {
      const questions = await callGroq(groqKey, model, systemPrompt, userPrompt);
      if (questions && questions.length > 0) return questions;
    }
  }
  // Groq uğursuz oldu — OpenRouter-ə keç
  if (orKey) {
    for (const model of OPENROUTER_MODELS) {
      const questions = await callOpenRouter(orKey, model, systemPrompt, userPrompt);
      if (questions && questions.length > 0) return questions;
    }
  }
  return [];
}

const LABELS = ["A", "B", "C", "D"];

function normalizeQuestion(q: any, isReview = false): any {
  const rawOptions = Array.isArray(q.options)
    ? q.options.map((o: any) => ({ label: o.label || "A", text: o.text || "" }))
    : [
        { label: "A", text: "" }, { label: "B", text: "" },
        { label: "C", text: "" }, { label: "D", text: "" },
      ];

  const correctLabel = q.correctOption || "A";
  const correctText = rawOptions.find((o: any) => o.label === correctLabel)?.text || rawOptions[0]?.text || "";

  // Fisher-Yates shuffle
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

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    const groqKey = process.env.GROQ_API_KEY;
    const orKey = process.env.OPENROUTER_API_KEY;

    if (!groqKey && !orKey) {
      return NextResponse.json({ error: "AI API açarı konfiqurasiya edilməyib." }, { status: 503 });
    }

    const body = await req.json();
    const {
      title,
      questionCount,
      category,
      language = "az",
      botId,
      // Batch rejimi: batchIndex və batchSize göndərilirsə — tək batch işlə
      batchIndex,
      batchSize,
      avoidTexts = [],  // əvvəlki batch-lərdə yaradılmış sualların mətnləri
    } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Quiz başlığı tələb olunur" }, { status: 400 });
    }

    // Batch rejimi: frontend hər batch üçün ayrıca sorğu göndərir
    const isBatchMode = batchIndex !== undefined && batchSize !== undefined;
    const targetCount = isBatchMode ? batchSize : (questionCount || 10);

    if (targetCount < 1 || targetCount > 20) {
      return NextResponse.json({ error: "Batch ölçüsü 1-20 arasında olmalıdır" }, { status: 400 });
    }

    // Bot məlumatları
    let botSystemPrompt = `Sən yüksək keyfiyyətli quiz sualları yaradan ixtisaslaşmış AI assistentsən.

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

      botSystemPrompt = `${bot.prompt}

ƏLAVƏ QAYDALAR:
- "ARTIQ YARADILIB" bölməsindəki sualları YARATMA.
- Yanlış variantlar düzgün cavaba çox oxşar olsun.
- Rəqəm/tarix/ad suallarında yaxın dəyərlər istifadə et.
- "Hamısı doğrudur" tipli variantlardan çəkin.

Cavabı YALNIZ JSON formatında ver:
{"questions":[{"text":"...","options":[{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],"correctOption":"A"}]}`;

      botContent = bot.content || "";

      // Yalnız ilk batch-də əvvəlki sualları və səhv sualları yüklə
      if (!isBatchMode || batchIndex === 0) {
        const userId = (session?.user as any)?.id;
        if (userId) {
          try {
            const quizRows = await prisma.$queryRaw<{ quiz_id: string }[]>`
              SELECT id as quiz_id FROM "Quiz"
              WHERE "createdById" = ${userId} AND "sourceBotId" = ${botId}
              ORDER BY "createdAt" DESC LIMIT 20
            `;
            if (quizRows.length > 0) {
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
                const limited = allPrevTexts.slice(0, 60);
                previousQuestionsSummary = limited.map((t, i) => `${i + 1}. ${t.slice(0, 100)}`).join("\n");
              }
            }
          } catch (dbErr: any) {
            console.warn("[generate-quiz] DB sorğusu uğursuz:", dbErr?.message);
          }
        }
      }
    }

    const langLabel =
      language === "az" ? "Azərbaycan dilində" :
      language === "ru" ? "Rus dilində" : "İngilis dilində";
    const categoryLabel = category || "ümumi bilik";

    // Avoid list: əvvəlki batch-lərdən + DB-dən gələn suallar
    const allAvoidTexts = [
      ...avoidTexts,
      ...(previousQuestionsSummary ? previousQuestionsSummary.split("\n") : []),
    ].filter(Boolean);

    const avoidPart = allAvoidTexts.length > 0
      ? `\n\nAŞAĞIDAKI SUALLAR ARTIQ YARADILIB — BUNLARI VƏ BUNLARA OXŞAR SUALLAR YARATMA:\n---\n${allAvoidTexts.slice(0, 50).join("\n")}\n---\n`
      : "";

    // Bot content-i varsa prompt-a əlavə et
    const contextPart = botContent
      ? `\n\nBilik bazası:\n---\n${botContent.slice(0, 3000)}\n---\n`
      : "";

    const batchLabel = isBatchMode ? ` (batch ${batchIndex + 1})` : "";
    const userPrompt = `${langLabel} "${title}" mövzusu üzrə DƏQIQ ${targetCount} ədəd test sualı yarat${batchLabel}. Nə az, nə çox — məhz ${targetCount} sual.
Kateqoriya: ${categoryLabel}${contextPart}${avoidPart}
Tələblər:
- Hər sualın 4 variant cavabı olsun (A, B, C, D)
- Yalnız 1 düzgün cavab olsun
- Suallar mövzuya uyğun, aydın və dəqiq olsun
- Yanlış variantlar düzgün cavaba çox oxşar olsun
- Rəqəm/tarix/ad suallarında yaxın dəyərlər istifadə et
- Variantların uzunluğu bir-birinə yaxın olsun
${botId ? "- Yalnız verilmiş bilik bazasından istifadə et" : ""}

Cavabı YALNIZ JSON formatında ver, ${targetCount} sual ilə:
{"questions":[{"text":"Sual mətni","options":[{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],"correctOption":"A"}]}`;

    const rawQuestions = await fetchBatch(targetCount, botSystemPrompt, userPrompt, groqKey, orKey);

    if (rawQuestions.length === 0) {
      return NextResponse.json(
        { error: "AI sual yarada bilmədi. Groq rate limit dolmuş ola bilər — bir neçə saniyə gözləyib yenidən cəhd edin." },
        { status: 502 }
      );
    }

    const normalized = rawQuestions.slice(0, targetCount).map((q) => normalizeQuestion(q, false));
    const normalizedWrong = wrongAnsweredQuestions.map((q) => normalizeQuestion(q, true));

    return NextResponse.json({
      questions: normalized,
      reviewQuestions: normalizedWrong,
    });
  } catch (err: any) {
    console.error("AI generate-quiz error:", err?.message ?? err);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}
