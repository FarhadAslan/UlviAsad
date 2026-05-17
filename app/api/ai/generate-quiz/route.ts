import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// ─── Model konfiqurasiyası ────────────────────────────────────────────────────
// GROQ PULSUZ PLAN LİMİTLƏRİ (2026):
// llama-3.1-8b-instant : 30 RPM, 6,000 TPM (← 131K deyil, 6K!)
// llama-3.3-70b-versatile: 30 RPM, 6,000 TPM
//
// OPENROUTER PULSUZ PLAN:
// meta-llama/llama-3.1-8b-instruct:free: daha liberal limitlər
// Bunları ÖN CƏRGƏYƏ qoyuruq!

interface ModelConfig {
  id: string;
  provider: "groq" | "openrouter";
  jsonMode: boolean;
  maxTokens: number;
  delayAfterMs: number; // Bu modeldən sonra gözləmə (rate limit üçün)
}

// OpenRouter ÖNCƏ, Groq sonra — çünki OR-un TPM limiti daha liberal
const ALL_MODELS: ModelConfig[] = [
  // OpenRouter — pulsuz, daha liberal limitlər
  { id: "meta-llama/llama-3.1-8b-instruct:free",  provider: "openrouter", jsonMode: false, maxTokens: 2000, delayAfterMs: 500  },
  { id: "meta-llama/llama-3.3-70b-instruct:free", provider: "openrouter", jsonMode: false, maxTokens: 2000, delayAfterMs: 500  },
  { id: "mistralai/mistral-7b-instruct:free",     provider: "openrouter", jsonMode: false, maxTokens: 2000, delayAfterMs: 500  },
  // Groq — 6K TPM limiti var, ehtiyatlı istifadə
  { id: "llama-3.1-8b-instant",                   provider: "groq",       jsonMode: true,  maxTokens: 1500, delayAfterMs: 1000 },
  { id: "llama-3.3-70b-versatile",               provider: "groq",       jsonMode: true,  maxTokens: 1500, delayAfterMs: 1000 },
];

// CHUNK_SIZE: 5 sual per request
// 5 sual × ~300 token = 1,500 token (Groq 6K TPM-ə sığır, OR üçün rahatdır)
const CHUNK_SIZE = 5;

// ─── JSON parser ──────────────────────────────────────────────────────────────
function extractQuestions(raw: string): any[] | null {
  if (!raw) return null;

  let text = raw
    .replace(/^```json\s*/im, "")
    .replace(/^```\s*/im, "")
    .replace(/\s*```\s*$/im, "")
    .trim();

  // 1. Tam JSON parse
  try {
    const p = JSON.parse(text);
    if (Array.isArray(p?.questions) && p.questions.length > 0) return p.questions;
    if (Array.isArray(p) && p.length > 0) return p;
  } catch { /* next */ }

  // 2. { ... } arasından parse
  try {
    const s = text.indexOf("{"), e = text.lastIndexOf("}");
    if (s !== -1 && e !== -1 && e > s) {
      const p = JSON.parse(text.slice(s, e + 1));
      if (Array.isArray(p?.questions) && p.questions.length > 0) return p.questions;
    }
  } catch { /* next */ }

  // 3. [ ... ] arasından parse
  try {
    const s = text.indexOf("["), e = text.lastIndexOf("]");
    if (s !== -1 && e !== -1 && e > s) {
      const arr = JSON.parse(text.slice(s, e + 1));
      if (Array.isArray(arr) && arr.length > 0) return arr;
    }
  } catch { /* next */ }

  // 4. Regex xilasetmə
  try {
    const matches = text.match(/\{\s*"text"\s*:\s*"[\s\S]+?"correctOption"\s*:\s*"[A-D]"\s*\}/g);
    if (matches) {
      const parsed = matches.map((m) => { try { return JSON.parse(m); } catch { return null; } }).filter(Boolean);
      if (parsed.length > 0) return parsed;
    }
  } catch { /* next */ }

  return null;
}

// ─── Tək model sorğusu (Timeout + Retry-li) ──────────────────────────────────
async function callModel(
  cfg: ModelConfig,
  groqKey: string | undefined,
  orKey: string | undefined,
  systemPrompt: string,
  userPrompt: string,
): Promise<{ questions: any[] | null; error?: string }> {
  const apiKey = cfg.provider === "groq" ? groqKey : orKey;
  if (!apiKey) return { questions: null, error: `${cfg.provider} API açarı yoxdur` };

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
    temperature: 0.8,
    max_tokens: cfg.maxTokens,
  };
  if (cfg.jsonMode) body.response_format = { type: "json_object" };

  let attempt = 0;
  const maxAttempts = 3;

  while (attempt < maxAttempts) {
    const controller = new AbortController();
    // Groq üçün 4s, OpenRouter üçün 6s timeout (asılı qalmaması üçün)
    const timeoutMs = cfg.provider === "groq" ? 4000 : 6000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          ...extraHeaders,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 429 Rate Limit idarə edilməsi (Self-Healing)
      if (res.status === 429) {
        const retryAfter = res.headers.get("retry-after");
        const waitMs = retryAfter ? parseFloat(retryAfter) * 1000 : (attempt + 1) * 2000;
        console.warn(`[${cfg.id}] 429 Rate Limit. Attempt ${attempt + 1}/${maxAttempts}. Gözlənilir: ${waitMs}ms...`);
        await new Promise(r => setTimeout(r, Math.min(waitMs, 8000)));
        attempt++;
        continue;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = errData?.error?.message || `HTTP ${res.status}`;
        console.warn(`[${cfg.id}] Xəta: ${msg}`);
        return { questions: null, error: msg };
      }

      const data = await res.json().catch(() => null);
      const content = data?.choices?.[0]?.message?.content;
      if (!content) return { questions: null, error: "boş cavab" };

      const questions = extractQuestions(content);
      if (!questions || questions.length === 0) {
        console.warn(`[${cfg.id}] Parse uğursuz. Cavab:`, content.slice(0, 150));
        return { questions: null, error: "json_parse_failed" };
      }

      console.log(`[${cfg.id}] ✓ ${questions.length} sual`);
      return { questions };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isTimeout = err?.name === "AbortError";
      console.warn(`[${cfg.id}] Cəhd ${attempt + 1}/${maxAttempts} uğursuz: ${isTimeout ? "Timeout" : err?.message}`);
      
      if (isTimeout || err?.message?.includes("fetch")) {
        await new Promise(r => setTimeout(r, 1500));
        attempt++;
        continue;
      }
      return { questions: null, error: err?.message };
    }
  }

  return { questions: null, error: `[${cfg.id}] 3 cəhdin hamısı uğursuz oldu` };
}

// ─── Bir chunk üçün sorğu ─────────────────────────────────────────────────────
// Bütün modelləri sıra ilə denəyir, birinci uğurlu olanı qaytarır
async function fetchChunk(
  systemPrompt: string,
  userPrompt: string,
  groqKey: string | undefined,
  orKey: string | undefined,
): Promise<{ questions: any[]; error?: string }> {
  const availableModels = ALL_MODELS.filter(m =>
    m.provider === "groq" ? !!groqKey : !!orKey
  );

  if (availableModels.length === 0) return { questions: [], error: "Heç bir API açarı yoxdur" };

  let lastError = "";

  for (const model of availableModels) {
    const result = await callModel(model, groqKey, orKey, systemPrompt, userPrompt);

    if (result.questions && result.questions.length > 0) {
      // Model uğurlu oldu — məcburi gözləmə (bu modeli qorumaq üçün)
      if (model.delayAfterMs > 0) {
        await new Promise(r => setTimeout(r, model.delayAfterMs));
      }
      return { questions: result.questions };
    }

    if (result.error) lastError = result.error;
  }

  return { questions: [], error: lastError };
}

// ─── Ardıcıl sual generasiyası ────────────────────────────────────────────────
async function generateSequential(
  totalCount: number,
  systemPrompt: string,
  buildPrompt: (count: number, chunkIdx: number, alreadyCollected: string[]) => string,
  groqKey: string | undefined,
  orKey: string | undefined,
): Promise<{ questions: any[]; lastError: string }> {
  const allQuestions: any[] = [];
  const seenTexts = new Set<string>();
  let lastError = "";
  let consecutiveEmpty = 0;

  // Maksimum chunk sayı: lazım olanın 3 qatı (dedup-dan itkiyə görə ehtiyat)
  const maxChunks = Math.ceil(totalCount / CHUNK_SIZE) * 3;

  for (let chunkIdx = 0; chunkIdx < maxChunks && allQuestions.length < totalCount; chunkIdx++) {
    const remaining = totalCount - allQuestions.length;
    const chunkCount = Math.min(remaining, CHUNK_SIZE);

    // Son 8 sualı ötür ki model təkrarlamasın (çox uzun list modeli çaşdırır)
    const alreadyCollected = allQuestions
      .slice(-8)
      .map((q: any) => `- ${q.text?.slice(0, 60)}`)
      .filter(Boolean);

    const userPrompt = buildPrompt(chunkCount, chunkIdx, alreadyCollected);

    console.log(`[chunk ${chunkIdx + 1}/${maxChunks}] ${chunkCount} sual istəyirəm (var: ${allQuestions.length}/${totalCount})`);

    const result = await fetchChunk(systemPrompt, userPrompt, groqKey, orKey);
    if (result.error) lastError = result.error;

    let added = 0;
    for (const q of result.questions) {
      if (allQuestions.length >= totalCount) break;
      const key = q.text?.trim().toLowerCase();
      if (key && key.length > 5 && !seenTexts.has(key)) {
        seenTexts.add(key);
        allQuestions.push(q);
        added++;
      }
    }

    console.log(`[chunk ${chunkIdx + 1}] +${added} sual əlavə edildi. Cəmi: ${allQuestions.length}/${totalCount}`);

    if (added === 0) {
      consecutiveEmpty++;
      console.warn(`[chunk ${chunkIdx + 1}] Boş nəticə (ard-arda: ${consecutiveEmpty})`);
      if (consecutiveEmpty >= 4) {
        console.warn("4 ard-arda boş chunk. Dayanıram.");
        break;
      }
      // Boş chunk-dan sonra 3 saniyə gözlə (rate limit-ə görə)
      await new Promise(r => setTimeout(r, 3000));
    } else {
      consecutiveEmpty = 0;
      // Uğurlu chunk-dan sonra 1.5 saniyə gözlə
      if (allQuestions.length < totalCount) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  }

  return { questions: allQuestions.slice(0, totalCount), lastError };
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
      ORDER BY "createdAt" DESC LIMIT 10
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

    // Yalnız ən son 5 sualı avoid üçün saxlayırıq (çox uzun list modeli çaşdırır)
    if (allPrevTexts.length > 0) {
      previousQuestionsSummary = allPrevTexts
        .slice(-5)
        .map((t) => `- ${t.slice(0, 80)}`)
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
    } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Quiz başlığı tələb olunur" }, { status: 400 });
    }
    if (questionCount < 1 || questionCount > 50) {
      return NextResponse.json({ error: "Sual sayı 1-50 arasında olmalıdır" }, { status: 400 });
    }

    // ── Sistem promptu ──
    const systemPrompt = `Sen quiz sualları yaradan AI-sən. YALNIZ JSON formatında cavab ver, başqa heç nə yazma.
JSON formatı:
{"questions":[{"text":"Sual?","options":[{"label":"A","text":"cavab"},{"label":"B","text":"cavab"},{"label":"C","text":"cavab"},{"label":"D","text":"cavab"}],"correctOption":"A"}]}`;

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
    const contextPart   = botContent ? `\nKontekst: ${botContent.slice(0, 800)}\n` : "";
    const historyAvoid  = previousQuestionsSummary ? `\nBunları yaratma (köhnə suallar):\n${previousQuestionsSummary}\n` : "";

    const aspectHints = [
      "", " (müxtəlif aspektlərə fokuslan)",
      " (praktiki suallar)", " (tarixi/nəzəri suallar)",
      " (müqayisəli suallar)", " (tətbiqi suallar)",
      " (analitik suallar)", " (başqa açıdan yanaş)",
      " (daha dərin suallar)", " (gündəlik həyatla bağlı)",
    ];

    const buildPrompt = (count: number, chunkIdx: number, alreadyCollected: string[]): string => {
      const hint = aspectHints[chunkIdx % aspectHints.length] || "";
      const avoidSection = alreadyCollected.length > 0
        ? `\nBu sualları TƏKRARLAMA:\n${alreadyCollected.join("\n")}\n`
        : "";
      return `${langLabel} "${title}" mövzusu${hint}. Kateqoriya: ${categoryLabel}.${contextPart}${historyAvoid}${avoidSection}
DƏQIQ ${count} sual yarat (A,B,C,D variantları, 1 düzgün cavab).
JSON:`;
    };

    console.log(`[generate-quiz] Başlayır: ${questionCount} sual, botId=${botId || "yox"}`);

    const resultData = await generateSequential(
      questionCount,
      systemPrompt,
      buildPrompt,
      groqKey,
      orKey,
    );

    const rawQuestions = resultData.questions;

    if (rawQuestions.length === 0) {
      return NextResponse.json(
        { error: `AI sual yarada bilmədi. Səbəb: ${resultData.lastError || "Naməlum xəta"}` },
        { status: 502 }
      );
    }

    const normalized      = rawQuestions.map((q) => normalizeQuestion(q, false));
    const normalizedWrong = wrongAnsweredQuestions.map((q) => normalizeQuestion(q, true));

    console.log(`[generate-quiz] ✓ Tamamlandı: ${normalized.length}/${questionCount} sual.`);

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
