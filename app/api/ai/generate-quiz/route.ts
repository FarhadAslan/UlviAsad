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
  maxTokens: number; // Hər model üçün ayrıca token limiti
}

// Groq model limitləri (https://console.groq.com/settings/limits):
// llama-3.1-8b-instant : 30 RPM, 131,072 TPM  ← Ən yaxşı seçim
// llama-3.3-70b-versatile: 30 RPM, 6,000 TPM  ← Çox aşağı, max_tokens kiçik olmalı
// llama-4-scout       : 30 RPM, 8,000 TPM
const GROQ_MODELS: ModelConfig[] = [
  { id: "llama-3.1-8b-instant",  provider: "groq", jsonMode: true,  maxTokens: 3000 },
  { id: "llama-4-scout-17b-16e-instruct", provider: "groq", jsonMode: false, maxTokens: 3000 },
  { id: "llama-3.3-70b-versatile", provider: "groq", jsonMode: true, maxTokens: 2000 },
];

const OR_MODELS: ModelConfig[] = [
  { id: "meta-llama/llama-3.1-8b-instruct:free",  provider: "openrouter", jsonMode: false, maxTokens: 3000 },
  { id: "meta-llama/llama-3.3-70b-instruct:free", provider: "openrouter", jsonMode: false, maxTokens: 3000 },
  { id: "mistralai/mistral-7b-instruct:free",     provider: "openrouter", jsonMode: false, maxTokens: 3000 },
];

// Hər token ≈ 4 Azərbaycan hərfi. 1 sual ≈ 250 token.
// 10 sual üçün ≈ 2500 token lazımdır.
// 3000 token = rahat margin, 6000 TPM olan modelə də sığır (1 sorğu = 3000 token < 6000 limit).
const CHUNK_SIZE = 8; // 8 sual × 250 token ≈ 2000 token. Hər model üçün təhlükəsizdir.

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

  // 4. Regex xilasetmə: kəsilmiş JSON-dan tam sualları çıxar
  try {
    const matches = text.match(/\{\s*"text"\s*:\s*"[\s\S]+?"correctOption"\s*:\s*"[A-D]"\s*\}/g);
    if (matches) {
      const parsed = matches.map((m) => { try { return JSON.parse(m); } catch { return null; } }).filter(Boolean);
      if (parsed.length > 0) return parsed;
    }
  } catch { /* next */ }

  return null;
}

// ─── Tək model sorğusu ────────────────────────────────────────────────────────
async function callModel(
  cfg: ModelConfig,
  groqKey: string | undefined,
  orKey: string | undefined,
  systemPrompt: string,
  userPrompt: string,
): Promise<{ questions: any[] | null; error?: string }> {
  const apiKey = cfg.provider === "groq" ? groqKey : orKey;
  if (!apiKey) return { questions: null, error: "API açarı yoxdur" };

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
    max_tokens: cfg.maxTokens,
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

    if (res.status === 429) {
      const errData = await res.json().catch(() => ({}));
      const msg = errData?.error?.message || "Rate limit";
      console.warn(`[${cfg.id}] 429 rate limit: ${msg}`);
      return { questions: null, error: `[${cfg.id}] Rate limit: ${msg}` };
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = errData?.error?.message || `HTTP ${res.status}`;
      console.warn(`[${cfg.id}] Xəta: ${msg}`);
      return { questions: null, error: `[${cfg.id}] ${msg}` };
    }

    const data = await res.json().catch(() => null);
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return { questions: null, error: `[${cfg.id}] Boş cavab` };

    const questions = extractQuestions(content);
    if (!questions || questions.length === 0) {
      console.warn(`[${cfg.id}] JSON parse uğursuz. İlk 200 char:`, content.slice(0, 200));
      return { questions: null, error: `[${cfg.id}] JSON parse uğursuz` };
    }

    console.log(`[${cfg.id}] ✓ ${questions.length} sual əldə edildi`);
    return { questions };
  } catch (err: any) {
    console.warn(`[${cfg.id}] Şəbəkə xətası: ${err?.message}`);
    return { questions: null, error: `[${cfg.id}] ${err?.message}` };
  }
}

// ─── Bir chunk üçün sorğu (bütün modelləri sıra ilə denəyir) ─────────────────
async function fetchChunk(
  count: number,
  systemPrompt: string,
  userPrompt: string,
  groqKey: string | undefined,
  orKey: string | undefined,
): Promise<{ questions: any[]; error?: string }> {
  const allModels: ModelConfig[] = [
    ...(groqKey ? GROQ_MODELS : []),
    ...(orKey   ? OR_MODELS   : []),
  ];

  if (allModels.length === 0) return { questions: [], error: "Heç bir API açarı yoxdur" };

  let lastError = "";

  for (const model of allModels) {
    const result = await callModel(model, groqKey, orKey, systemPrompt, userPrompt);
    
    if (result.questions && result.questions.length > 0) {
      return { questions: result.questions };
    }
    
    if (result.error) lastError = result.error;
    
    // Növbəti modelə keçməzdən əvvəl qısa gözləmə (rate limit-ə görə)
    await new Promise(r => setTimeout(r, 500));
  }

  return { questions: [], error: lastError };
}

// ─── Ardıcıl (Sequential) sual generasiyası ──────────────────────────────────
// Bütün chunk-lar bir-birinin ardınca (paralel deyil) göndərilir.
// Bu, API rate limit problemini tamamilə aradan qaldırır.
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

  // Maksimum neçə dəfə cəhd edilə bilər (tələb olunanın 2 qatı qədər chunk, boş dövrələrin qarşısını almaq üçün)
  const maxChunks = Math.ceil(totalCount / CHUNK_SIZE) * 2;

  for (let chunkIdx = 0; chunkIdx < maxChunks && allQuestions.length < totalCount; chunkIdx++) {
    const remaining = totalCount - allQuestions.length;
    const chunkCount = Math.min(remaining, CHUNK_SIZE);

    // İndiyədək yığılmış sualları (qısa formatda, max 10 ədəd) verək ki model boğulmasın
    const alreadyCollected = allQuestions
      .slice(-10)
      .map((q: any) => q.text?.slice(0, 50) + "...")
      .filter(Boolean);

    const userPrompt = buildPrompt(chunkCount, chunkIdx, alreadyCollected);

    console.log(`[sequential] Chunk ${chunkIdx + 1}/${maxChunks}: ${chunkCount} sual istənilir (cəmi ${allQuestions.length}/${totalCount})...`);

    const result = await fetchChunk(chunkCount, systemPrompt, userPrompt, groqKey, orKey);
    
    if (result.error) lastError = result.error;

    let addedThisChunk = 0;
    for (const q of result.questions) {
      if (allQuestions.length >= totalCount) break;
      const key = q.text?.trim().toLowerCase();
      if (key && !seenTexts.has(key) && key.length > 5) {
        seenTexts.add(key);
        allQuestions.push(q);
        addedThisChunk++;
      }
    }

    console.log(`[sequential] Chunk ${chunkIdx + 1}: ${addedThisChunk} unikal sual əlavə edildi. Cəmi: ${allQuestions.length}/${totalCount}`);

    if (addedThisChunk === 0) {
      consecutiveEmpty++;
      console.warn(`[sequential] Chunk ${chunkIdx + 1} sıfır unikal sual verdi. (Ard-arda: ${consecutiveEmpty})`);
      if (consecutiveEmpty >= 2) {
        console.warn(`[sequential] 2 ard-arda boş chunk gəldi. Dayanıram.`);
        break;
      }
      // Boş chunk olanda bir az daha çox gözləyək
      await new Promise(r => setTimeout(r, 2000));
    } else {
      consecutiveEmpty = 0;
      // Normal chunk-lar arasında 1 saniyə fasilə
      if (allQuestions.length < totalCount) {
        await new Promise(r => setTimeout(r, 1000));
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
    let systemPrompt = `Sən quiz sualları yaradan AI assistentsən. YALNIZ JSON formatında cavab ver. Başqa heç nə yazma.

FORMAT (dəqiq belə):
{"questions":[{"text":"Sual?","options":[{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],"correctOption":"A"}]}`;

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

VACIB: Yalnız JSON formatında cavab ver:
{"questions":[{"text":"Sual?","options":[{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],"correctOption":"A"}]}`;

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
    // Bot content-i qıs saxla — token limitinə düşməmək üçün
    const contextPart   = botContent ? `\n\nMövzu konteksti:\n${botContent.slice(0, 1500)}\n` : "";

    // 40+ sualı prompta vermək modeli (özəlliklə 8B) çaşdırır və heç nə yaratmamasına səbəb olur.
    // Buna görə yalnız ən son 5 sualı (və limitli sayda) avoid siyahısına salırıq.
    const allAvoidTexts = [
      ...avoidTexts.slice(0, 5),
      ...(previousQuestionsSummary ? previousQuestionsSummary.split("\n").slice(0, 5) : []),
    ].filter(Boolean);

    const avoidPart = allAvoidTexts.length > 0
      ? `\n\nBU SUALLAR ARTIQ VAR — YARATMA:\n${allAvoidTexts.join("\n")}\n`
      : "";

    const aspectHints = [
      "",
      " Fərqli aspektlərə fokuslan.",
      " Praktiki suallar yarat.",
      " Tarixi/nəzəri suallar yarat.",
      " Müqayisəli suallar yarat.",
      " Tətbiqi suallar yarat.",
      " Analitik suallar yarat.",
    ];

    const buildPrompt = (count: number, chunkIdx: number, alreadyCollected: string[]): string => {
      const hint = aspectHints[chunkIdx % aspectHints.length] || "";
      const dynamicAvoid = alreadyCollected.length > 0 
        ? `\n\nBU SUALLAR BU SESSİYADA YARADILIB, BUNLARI QƏTİYYƏN TƏKRARLAMA:\n${alreadyCollected.join("\n")}\n` 
        : "";
      return `${langLabel} "${title}" mövzusu üzrə DƏQIQ ${count} sual yarat. Kateqoriya: ${categoryLabel}.${hint}${contextPart}${avoidPart}${dynamicAvoid}

Tələblər:
- Hər sualın A, B, C, D variantları olsun
- Yalnız 1 düzgün cavab
- Yanlış variantlar düzgün cavaba oxşar olsun
${botId ? "- Yalnız verilmiş kontekstdən istifadə et" : ""}

JSON (${count} sual):
{"questions":[{"text":"...","options":[{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],"correctOption":"A"}]}`;
    };

    // ─── Ardıcıl generasiya ──
    console.log(`[generate-quiz] ${questionCount} sual üçün ardıcıl generasiya başlayır...`);
    
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

    console.log(`[generate-quiz] ✓ ${normalized.length}/${questionCount} sual yaradıldı.`);

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
