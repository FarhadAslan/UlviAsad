import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

// Groq modellər — JSON mode dəstəkləyir, sürətli
const GROQ_MODELS = [
  "llama-3.3-70b-versatile",   // 6000 TPM — ən yüksək keyfiyyət
  "llama-3.1-8b-instant",      // 20000 TPM — sürətli (kiçik mətn üçün)
];

// OpenRouter — "openrouter/auto" avtomatik ən yaxşı pulsuz modeli seçir
// Alternativ olaraq konkret modellər
const OPENROUTER_MODELS = [
  "openrouter/auto",                          // avtomatik seçim
  "meta-llama/llama-3.2-3b-instruct:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
];

const CHUNK_SIZE   = 4_000;  // 413 xətasından qaçmaq üçün kiçiltdik (~1000 token)
const DIRECT_LIMIT = 4_000;  // eyni limit
const BATCH_SIZE   = 25;     // hər AI sorğusunda maksimum sual sayı

// JSON mətnindən sualları çıxar — bütün formatları handle edir
function extractQuestions(raw: string): any[] | null {
  if (!raw) return null;

  // Markdown code block-larını sil
  let text = raw
    .replace(/^```json\s*/im, "")
    .replace(/^```\s*/im, "")
    .replace(/\s*```\s*$/im, "")
    .trim();

  // JSON parse cəhdləri
  const attempts = [
    // 1. Birbaşa parse
    () => JSON.parse(text),
    // 2. İlk { ... } blokundan çıxar
    () => {
      const start = text.indexOf("{");
      const end   = text.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error("no object");
      return JSON.parse(text.slice(start, end + 1));
    },
    // 3. İlk [ ... ] blokundan çıxar (array formatı)
    () => {
      const start = text.indexOf("[");
      const end   = text.lastIndexOf("]");
      if (start === -1 || end === -1) throw new Error("no array");
      return { questions: JSON.parse(text.slice(start, end + 1)) };
    },
  ];

  for (const attempt of attempts) {
    try {
      const parsed = attempt();
      if (Array.isArray(parsed?.questions) && parsed.questions.length > 0) {
        return parsed.questions;
      }
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // növbəti cəhd
    }
  }
  return null;
}

// AI sorğusu — Groq üçün JSON mode, OpenRouter üçün JSON mode olmadan
async function callAI(opts: {
  endpoint: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  extraHeaders?: Record<string, string>;
  useJsonMode?: boolean;
  retries?: number;
}): Promise<any[] | null> {
  const { endpoint, apiKey, model, systemPrompt, userPrompt,
          extraHeaders = {}, useJsonMode = true, retries = 3 } = opts;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const body: any = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 16000,
    };

    // JSON mode yalnız dəstəkləyən modellər üçün
    if (useJsonMode) {
      body.response_format = { type: "json_object" };
    }

    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          ...extraHeaders,
        },
        body: JSON.stringify(body),
      });
    } catch (fetchErr) {
      console.error(`[${model}] fetch error:`, fetchErr);
      if (attempt < retries) { await new Promise(r => setTimeout(r, 2000)); continue; }
      return null;
    }

    if (res.status === 429 && attempt < retries) {
      const waitMs = 5000 * (attempt + 1);
      console.log(`[${model}] rate limit, ${waitMs}ms gözlənilir...`);
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }

    // 413 — mətn çox böyükdür, retry etmə
    if (res.status === 413) {
      console.error(`[${model}] 413 - mətn çox böyükdür`);
      return null;
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[${model}] HTTP ${res.status}:`, errText.slice(0, 200));
      // 5xx xətalarında retry
      if (res.status >= 500 && attempt < retries) {
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      return null;
    }

    const data = await res.json().catch(() => null);
    if (!data) { console.error(`[${model}] JSON parse failed`); return null; }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error(`[${model}] empty content. data:`, JSON.stringify(data).slice(0, 300));
      return null;
    }

    const questions = extractQuestions(content);
    if (!questions) {
      console.error(`[${model}] could not extract questions from:`, content.slice(0, 300));
      return null;
    }

    return questions;
  }
  return null;
}

// Groq ilə sorğu (JSON mode aktiv)
function callGroq(apiKey: string, model: string, system: string, user: string) {
  return callAI({
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    apiKey, model,
    systemPrompt: system,
    userPrompt: user,
    useJsonMode: true,
  });
}

// OpenRouter ilə sorğu (JSON mode olmadan — pulsuz modellər dəstəkləmir)
function callOpenRouter(apiKey: string, model: string, system: string, user: string) {
  return callAI({
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    apiKey, model,
    systemPrompt: system,
    userPrompt: user,
    useJsonMode: false,
    extraHeaders: {
      "HTTP-Referer": "https://ulvi-asad-hnez.vercel.app",
      "X-Title": "Muellim Portal",
    },
  });
}

// İstənilən sayda sual toplayana qədər sorğu göndər (fill-up strategiyası)
async function fetchUntilFull(opts: {
  needed: number;
  chunk: string;
  chunkIndex: number;
  chunkCount: number;
  systemPrompt: string;
  langLabel: string;
  categoryLabel: string;
  title: string;
  botId: string | undefined;
  groqKey: string | undefined;
  orKey: string | undefined;
  buildPrompt: (chunk: string, ci: number, count: number) => string;
  maxAttempts?: number;
}): Promise<any[]> {
  const { needed, maxAttempts = 8 } = opts;
  const collected: any[] = [];
  let attempts = 0;

  while (collected.length < needed && attempts < maxAttempts) {
    const stillNeed = needed - collected.length;
    // Modelin az qaytarma ehtimalına qarşı 30% artıq istə (min 2 əlavə), üst limit yoxdur
    const askFor = stillNeed + Math.max(2, Math.ceil(stillNeed * 0.3));
    const userPrompt = opts.buildPrompt(opts.chunk, opts.chunkIndex, askFor);

    let questions: any[] | null = null;

    if (opts.groqKey) {
      const model = GROQ_MODELS[attempts % GROQ_MODELS.length];
      questions = await callGroq(opts.groqKey, model, opts.systemPrompt, userPrompt);
    }
    if (!questions && opts.orKey) {
      for (const model of OPENROUTER_MODELS) {
        questions = await callOpenRouter(opts.orKey, model, opts.systemPrompt, userPrompt);
        if (questions) break;
      }
    }

    if (Array.isArray(questions) && questions.length > 0) {
      // Artıq gəlmiş sualları duplikat yoxlaması ilə əlavə et
      const existingTexts = new Set(collected.map((q: any) => q.text?.trim().toLowerCase()));
      for (const q of questions) {
        const key = q.text?.trim().toLowerCase();
        if (key && !existingTexts.has(key)) {
          collected.push(q);
          existingTexts.add(key);
        }
        if (collected.length >= needed) break;
      }
    }

    attempts++;
    // Hələ çatmırsa qısa gözlə
    if (collected.length < needed && attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return collected.slice(0, needed);
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;

    if (!session) {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    const groqKey = process.env.GROQ_API_KEY;
    const orKey   = process.env.OPENROUTER_API_KEY;

    if (!groqKey && !orKey) {
      const keys = Object.keys(process.env).filter(k => k.includes("GROQ") || k.includes("OPENROUTER") || k.includes("API")).join(",");
      return NextResponse.json(
        { error: `AI API açarı tapılmadı! Mühit (Env): GROQ=${!!groqKey}, OR=${!!orKey}. Mövcud uyğun key-lər: ${keys}` },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { title, questionCount, category, language = "az", botId } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Quiz başlığı tələb olunur" }, { status: 400 });
    }
    if (!questionCount || questionCount < 1 || questionCount > 50) {
      return NextResponse.json({ error: "Sual sayı 1-50 arasında olmalıdır" }, { status: 400 });
    }

    let botSystemPrompt = `Sən yüksək keyfiyyətli quiz sualları yaradan ixtisaslaşmış AI assistentsən.

ƏSAS QAYDALAR:
1. Verilən mövzu üzrə dəqiq, aydın test sualları yarat.
2. Bütün suallar və cavablar Azərbaycan dilində olmalıdır.
3. Əgər "ARTIQ YARADILIB" bölməsi varsa — oradakı sualları və onlara oxşar sualları MÜTLƏQ yaratma. Tamamilə fərqli aspektləri əhatə et.

CAVAB VARİANTLARI ÜÇÜN QAYDALAR (ÇOX VACİBDİR):
- Yanlış variantlar (distraktorlar) düzgün cavaba mümkün qədər oxşar olsun — oxucu ilk baxışda fərqi görməsin.
- Rəqəm, tarix, ad, termin içərən suallar üçün yanlış variantlarda çox yaxın dəyərlər istifadə et (məs: 1918 əvəzinə 1919, 1917, 1920).
- "Hamısı doğrudur" və ya "Heç biri doğru deyil" tipli variantlardan çəkin.
- Variantların uzunluğu bir-birinə yaxın olsun.
- Düzgün cavab variantlar arasında seçilə bilməsin — hamısı eyni dərəcədə inandırıcı görünsün.

Cavabı MÜTLƏQ aşağıdakı JSON formatında ver — başqa heç nə yazma:
{"questions":[{"text":"Sual 1 mətni","options":[{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],"correctOption":"A"},{"text":"Sual 2 mətni","options":[{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],"correctOption":"B"}]}`;

    let botChunks: string[] = [""];
    let previousQuestionsSummary = ""; // Bu bot ilə əvvəl yaradılmış sualların xülasəsi

    // Səhv cavablanmış suallar — birbaşa yeni quizə əlavə olunacaq
    // { questionId, text, options (parsed), correctOption, points }
    let wrongAnsweredQuestions: any[] = [];

    if (botId) {
      const bot = await prisma.aiBot.findUnique({
        where: { id: botId, active: true },
        select: { name: true, prompt: true, content: true },
      });

      if (!bot) {
        return NextResponse.json({ error: "Seçilmiş AI bot tapılmadı" }, { status: 404 });
      }

      const userId = (session?.user as any)?.id;
      if (userId) {
        // Bu botla yaradılmış quizləri tap (sourceBotId ilə)
        const previousQuizzes = await (prisma.quiz as any).findMany({
          where: {
            createdById: userId,
            sourceBotId: botId,
          },
          select: {
            id: true,
            questions: {
              select: {
                id: true,
                text: true,
                options: true,
                correctOption: true,
                points: true,
                questionType: true,
              },
            },
            results: {
              where: { userId },
              orderBy: { createdAt: "desc" },
              take: 1, // hər quizin ən son nəticəsi
              select: { answers: true },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 30,
        });

        // Sualları iki qrupa ayır:
        // 1. Heç vaxt düzgün cavablanmamış (və ya ən son nəticədə səhv olan) suallar
        // 2. Bütün əvvəlki sualların mətni (AI-a göndərmək üçün)
        const allPrevTexts: string[] = [];

        // questionId → ən son nəticədə düzgün cavablanıb-cavablanmadığı
        // Bir sual birdən çox quizdə ola bilməz (hər quiz öz suallarını yaradır),
        // amma eyni mətnli suallar fərqli quizlərdə ola bilər.
        // Məntiqi: sualın MƏTNİ əsasında izləyirik.

        // questionText (normalized) → son nəticədə isCorrect
        const questionStatusMap = new Map<string, boolean>(); // text → lastCorrect

        for (const pq of previousQuizzes) {
          // Bu quizin ən son nəticəsini al
          const lastResult = pq.results[0];
          let answersArr: any[] = [];
          if (lastResult?.answers) {
            try {
              answersArr = JSON.parse(lastResult.answers);
            } catch {
              answersArr = [];
            }
          }

          // answersArr: [{questionId, selected, isCorrect, ...}]
          const answerMap = new Map<string, boolean>(); // questionId → isCorrect
          for (const ans of answersArr) {
            if (ans.questionId) {
              answerMap.set(ans.questionId, !!ans.isCorrect);
            }
          }

          for (const q of pq.questions) {
            const cleanText = q.text.replace(/<[^>]+>/g, "").trim();
            if (cleanText.length > 5) {
              allPrevTexts.push(cleanText);
            }

            // Bu sual bu quizdə cavablanıbmı?
            const isCorrect = answerMap.get(q.id);
            const normalizedText = cleanText.toLowerCase();

            // Quizlər ən yenidən köhnəyə gəlir (orderBy: desc).
            // Bir sualın statusunu yalnız ilk dəfə gördükdə set edirik —
            // bu onun ən son nəticəsini əks etdirir.
            // İstisna: əgər hər hansı quizdə düzgün cavablanıbsa, "düzgün" kimi işarələ
            // (bir dəfə düzgün cavablandısa — artıq təkrarlama lazım deyil)
            if (isCorrect === true) {
              // Düzgün cavablandı — həmişə "düzgün" kimi işarələ (override et)
              questionStatusMap.set(normalizedText, true);
            } else if (isCorrect === false) {
              // Səhv cavablandı — yalnız əvvəlcədən "düzgün" işarələnməyibsə set et
              if (questionStatusMap.get(normalizedText) !== true) {
                questionStatusMap.set(normalizedText, false);
              }
            }
            // isCorrect === undefined: bu quiz həll edilməyib — statusu dəyişmə
          }
        }

        // Səhv cavablanmış sualları topla (heç vaxt düzgün cavablanmamış)
        // Bunları birbaşa yeni quizə əlavə edəcəyik
        const wrongTextSet = new Set<string>();
        for (const [text, correct] of Array.from(questionStatusMap.entries())) {
          if (!correct) wrongTextSet.add(text);
        }

        if (wrongTextSet.size > 0) {
          // Bütün əvvəlki quizlərdən həmin sualların tam məlumatını tap
          // (options, correctOption saxlamaq üçün)
          // Maksimum 10 səhv sual əlavə et — quiz çox böyüməsin
          const MAX_REVIEW_QUESTIONS = 10;
          const seenTexts = new Set<string>();
          for (const pq of previousQuizzes) {
            if (wrongAnsweredQuestions.length >= MAX_REVIEW_QUESTIONS) break;
            for (const q of pq.questions) {
              if (wrongAnsweredQuestions.length >= MAX_REVIEW_QUESTIONS) break;
              const cleanText = q.text.replace(/<[^>]+>/g, "").trim();
              const normalizedText = cleanText.toLowerCase();
              if (wrongTextSet.has(normalizedText) && !seenTexts.has(normalizedText)) {
                seenTexts.add(normalizedText);
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
                } catch {
                  // options parse xətası — bu sualı atla
                }
              }
            }
          }
        }

        if (allPrevTexts.length > 0) {
          // Maks 15 sual xülasəsi göndər (çox uzun list modeli çaşdırır — "AI paralysis")
          const limited = allPrevTexts.slice(0, 15);
          previousQuestionsSummary = limited
            .map((t, i) => `${i + 1}. ${t.slice(0, 80)}`)
            .join("\n");
        }
      }

      botSystemPrompt = `${bot.prompt}

ƏLAVƏ QAYDALAR:
3. Əgər "ARTIQ YARADILIB" bölməsi varsa — oradakı sualları və onlara oxşar sualları MÜTLƏQ yaratma. Tamamilə fərqli aspektləri əhatə et.

CAVAB VARİANTLARI ÜÇÜN QAYDALAR (ÇOX VACİBDİR):
- Yanlış variantlar (distraktorlar) düzgün cavaba mümkün qədər oxşar olsun — oxucu ilk baxışda fərqi görməsin.
- Rəqəm, tarix, ad, termin içərən suallar üçün yanlış variantlarda çox yaxın dəyərlər istifadə et (məs: 1918 əvəzinə 1919, 1917, 1920).
- "Hamısı doğrudur" və ya "Heç biri doğru deyil" tipli variantlardan çəkin.
- Variantların uzunluğu bir-birinə yaxın olsun.
- Düzgün cavab variantlar arasında seçilə bilməsin — hamısı eyni dərəcədə inandırıcı görünsün.

MÜTLƏQ bu JSON formatında cavab ver — başqa heç nə yazma:
{"questions":[{"text":"Sual 1 mətni","options":[{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],"correctOption":"A"},{"text":"Sual 2 mətni","options":[{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],"correctOption":"C"}]}`;

      if (bot.content) {
        const content = bot.content;
        if (content.length <= DIRECT_LIMIT) {
          botChunks = [content];
        } else {
          const chunks: string[] = [];
          let start = 0;
          while (start < content.length) {
            let end = Math.min(start + CHUNK_SIZE, content.length);
            if (end < content.length) {
              const lastSpace = content.lastIndexOf(" ", end);
              if (lastSpace > start) end = lastSpace;
            }
            chunks.push(content.slice(start, end).trim());
            start = end;
          }
          botChunks = chunks;
        }
      }
    }

    const langLabel =
      language === "az" ? "Azərbaycan dilində" :
      language === "ru" ? "Rus dilində" : "İngilis dilində";
    const categoryLabel = category || "ümumi bilik";

    const chunkCount = botChunks.length;
    const baseCount  = Math.floor(questionCount / chunkCount);
    const remainder  = questionCount % chunkCount;

    const buildUserPrompt = (chunk: string, ci: number, count: number) => {
      const contextPart = chunk
        ? `\n\nBilik bazası (${ci + 1}/${chunkCount} hissə):\n---\n${chunk}\n---\n`
        : "";

      const avoidPart = previousQuestionsSummary
        ? `\n\nAŞAĞIDAKI SUALLAR ARTIQ YARADILIB — BUNLARI VƏ BUNLARA OXŞAR SUALLAR YARATMA, TAMAMILƏ YENİ SUALLAR YAZ:\n---\n${previousQuestionsSummary}\n---\n`
        : "";

      return `${langLabel} "${title}" mövzusu üzrə DƏQIQ ${count} ədəd test sualı yarat. Nə az, nə çox — məhz ${count} sual.
Kateqoriya: ${categoryLabel}${contextPart}${avoidPart}
Tələblər:
- Hər sualın 4 variant cavabı olsun (A, B, C, D)
- Yalnız 1 düzgün cavab olsun
- Suallar mövzuya uyğun, aydın və dəqiq olsun
- Yanlış variantlar düzgün cavaba çox oxşar olsun — çaşdırıcı və çətin olsun
- Rəqəm/tarix/ad içərən suallar üçün yanlış variantlarda çox yaxın dəyərlər istifadə et
- Variantların uzunluğu bir-birinə yaxın olsun, hamısı inandırıcı görünsün
- Əvvəlki suallarla eyni və ya çox oxşar suallar YARATMA
${botId ? "- Yalnız verilmiş bilik bazasından istifadə et" : ""}

Cavabı YALNIZ JSON formatında ver, ${count} sual ilə:
{"questions":[{"text":"Sual mətni","options":[{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],"correctOption":"A"}]}`;
    };

    // Paralel sorğular — hər chunk üçün ən yaxşı mövcud provider
    const allQuestions: any[] = [];

    if (chunkCount === 1) {
      // Tək chunk — çox sual varsa batch-lərə böl, hər batch fill-up ilə doldurulur
      const chunk = botChunks[0];

      const batches: number[] = [];
      let remaining = questionCount;
      while (remaining > 0) {
        const batchCount = Math.min(remaining, BATCH_SIZE);
        batches.push(batchCount);
        remaining -= batchCount;
      }

      const batchResults = await Promise.all(
        batches.map((count) =>
          fetchUntilFull({
            needed: count,
            chunk,
            chunkIndex: 0,
            chunkCount,
            systemPrompt: botSystemPrompt,
            langLabel,
            categoryLabel,
            title,
            botId: botId || undefined,
            groqKey,
            orKey,
            buildPrompt: buildUserPrompt,
          })
        )
      );

      for (const qs of batchResults) {
        allQuestions.push(...qs);
      }

    } else {
      // Çox chunk — hər chunk üçün fetchUntilFull ilə retry mexanizmi
      // Sualları chunk-lara paylaşdır
      const chunkTasks = botChunks.map((chunk, ci) => {
        const count = baseCount + (ci < remainder ? 1 : 0);
        if (count === 0) return Promise.resolve([] as any[]);

        return fetchUntilFull({
          needed: count,
          chunk,
          chunkIndex: ci,
          chunkCount,
          systemPrompt: botSystemPrompt,
          langLabel,
          categoryLabel,
          title,
          botId: botId || undefined,
          groqKey,
          orKey,
          buildPrompt: buildUserPrompt,
        });
      });

      const chunkResults = await Promise.all(chunkTasks);
      for (const qs of chunkResults) {
        allQuestions.push(...qs);
      }

      // Hələ də çatmırsa — ilk chunk-dan əlavə suallar al (fill-up)
      if (allQuestions.length < questionCount) {
        const deficit = questionCount - allQuestions.length;
        console.log(`[multi-chunk] ${deficit} sual çatmır, əlavə fill-up sorğusu göndərilir...`);
        const extra = await fetchUntilFull({
          needed: deficit,
          chunk: botChunks[0],
          chunkIndex: 0,
          chunkCount: 1,
          systemPrompt: botSystemPrompt,
          langLabel,
          categoryLabel,
          title,
          botId: botId || undefined,
          groqKey,
          orKey,
          buildPrompt: buildUserPrompt,
        });
        allQuestions.push(...extra);
      }
    }

    if (allQuestions.length === 0 && wrongAnsweredQuestions.length === 0) {
      return NextResponse.json(
        { error: "AI sual yarada bilmədi. Groq və OpenRouter hər ikisi uğursuz oldu. Bir az gözləyib yenidən cəhd edin." },
        { status: 502 }
      );
    }

    // İstənən saydan çox gəlibsə kəs, az gəlibsə hamısını qaytar
    const finalQuestions = allQuestions.slice(0, questionCount);

    const LABELS = ["A", "B", "C", "D"];

    const normalized = finalQuestions.map((q: any) => {
      const rawOptions = Array.isArray(q.options)
        ? q.options.map((o: any) => ({ label: o.label || "A", text: o.text || "" }))
        : [
            { label: "A", text: "" },
            { label: "B", text: "" },
            { label: "C", text: "" },
            { label: "D", text: "" },
          ];
      const correctLabel = q.correctOption || "A";

      // Düzgün cavabın mətnini tap
      const correctText = rawOptions.find((o: any) => o.label === correctLabel)?.text || rawOptions[0]?.text || "";

      // Fisher-Yates shuffle — variantları qarışdır
      const shuffled = [...rawOptions];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      // Yeni label-lar təyin et və düzgün cavabın yeni yerini tap
      let newCorrectLabel = "A";
      const newOptions = shuffled.map((o: any, idx: number) => {
        const label = LABELS[idx] || String.fromCharCode(65 + idx);
        if (o.text === correctText) newCorrectLabel = label;
        return { label, text: o.text };
      });

      return {
        text: q.text || "",
        imageUrl: "",
        questionType: "CHOICE",
        openAnswerExample: "",
        options: newOptions,
        correctOption: newCorrectLabel,
        points: 1,
      };
    });

    // Səhv cavablanmış sualları da shuffle et (variantların yerini qarışdır)
    const normalizedWrong = wrongAnsweredQuestions.map((q: any) => {
      const rawOptions = Array.isArray(q.options)
        ? q.options.map((o: any) => ({ label: o.label || "A", text: o.text || "" }))
        : [
            { label: "A", text: "" },
            { label: "B", text: "" },
            { label: "C", text: "" },
            { label: "D", text: "" },
          ];
      const correctLabel = q.correctOption || "A";
      const correctText = rawOptions.find((o: any) => o.label === correctLabel)?.text || rawOptions[0]?.text || "";

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
        isReview: true, // Bu sualın "təkrar" sual olduğunu bildirmək üçün
      };
    });

    return NextResponse.json({
      questions: normalized,
      reviewQuestions: normalizedWrong, // Səhv cavablanmış suallar — frontend bunları əlavə edəcək
    });
  } catch (err: any) {
    console.error("AI generate-quiz error:", err?.message ?? err);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}
