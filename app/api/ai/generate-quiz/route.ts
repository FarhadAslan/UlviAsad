import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

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
const BATCH_SIZE   = 15;     // hər AI sorğusunda maksimum sual sayı

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
      max_tokens: 8192,
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

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;

    if (!session || (userRole !== "ADMIN" && userRole !== "TEACHER")) {
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
    const { title, questionCount, category, language = "az", botId } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Quiz başlığı tələb olunur" }, { status: 400 });
    }
    if (!questionCount || questionCount < 1 || questionCount > 30) {
      return NextResponse.json({ error: "Sual sayı 1-30 arasında olmalıdır" }, { status: 400 });
    }

    let botSystemPrompt = `Sən quiz yaradıcısısan. Verilən mövzu üzrə test sualları yarat.
Cavabı MÜTLƏQ aşağıdakı JSON formatında ver — başqa heç nə yazma:
{"questions":[{"text":"Sual 1 mətni","options":[{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],"correctOption":"A"},{"text":"Sual 2 mətni","options":[{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],"correctOption":"B"}]}`;

    let botChunks: string[] = [""];

    if (botId) {
      const bot = await prisma.aiBot.findUnique({
        where: { id: botId, active: true },
        select: { name: true, prompt: true, content: true },
      });

      if (!bot) {
        return NextResponse.json({ error: "Seçilmiş AI bot tapılmadı" }, { status: 404 });
      }

      botSystemPrompt = `${bot.prompt}

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
      return `${langLabel} "${title}" mövzusu üzrə DƏQIQ ${count} ədəd test sualı yarat. Nə az, nə çox — məhz ${count} sual.
Kateqoriya: ${categoryLabel}${contextPart}
Tələblər:
- Hər sualın 4 variant cavabı olsun (A, B, C, D)
- Yalnız 1 düzgün cavab olsun
- Suallar mövzuya uyğun, aydın və dəqiq olsun
- Variantlar inandırıcı olsun
${botId ? "- Yalnız verilmiş bilik bazasından istifadə et" : ""}

Cavabı YALNIZ JSON formatında ver, ${count} sual ilə:
{"questions":[{"text":"Sual mətni","options":[{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],"correctOption":"A"}]}`;
    };

    // Paralel sorğular — hər chunk üçün ən yaxşı mövcud provider
    const allQuestions: any[] = [];

    if (chunkCount === 1) {
      // Tək chunk — çox sual varsa batch-lərə böl
      const chunk = botChunks[0];

      // questionCount > BATCH_SIZE olarsa paralel batch-lər göndər
      const batches: number[] = [];
      let remaining = questionCount;
      while (remaining > 0) {
        const batchCount = Math.min(remaining, BATCH_SIZE);
        batches.push(batchCount);
        remaining -= batchCount;
      }

      const batchResults = await Promise.all(
        batches.map(async (count, bi) => {
          const userPrompt = buildUserPrompt(chunk, 0, count);
          let questions: any[] | null = null;

          if (groqKey) {
            const model = GROQ_MODELS[bi % GROQ_MODELS.length];
            questions = await callGroq(groqKey, model, botSystemPrompt, userPrompt);
          }

          // Groq uğursuz olsa OpenRouter ilə cəhd et
          if (!questions && orKey) {
            for (const model of OPENROUTER_MODELS) {
              questions = await callOpenRouter(orKey, model, botSystemPrompt, userPrompt);
              if (questions) break;
            }
          }

          return questions;
        })
      );

      for (const qs of batchResults) {
        if (Array.isArray(qs)) allQuestions.push(...qs);
      }

    } else {
      // Çox chunk — paralel göndər
      // Groq varsa ilk 3 chunk Groq, qalanları OpenRouter
      const tasks = botChunks.map((chunk, ci) => {
        const count = baseCount + (ci < remainder ? 1 : 0);
        if (count === 0) return Promise.resolve(null);

        const userPrompt = buildUserPrompt(chunk, ci, count);

        // Groq modeli seç (növbə ilə)
        if (groqKey && ci < GROQ_MODELS.length) {
          const model = GROQ_MODELS[ci % GROQ_MODELS.length];
          return callGroq(groqKey, model, botSystemPrompt, userPrompt)
            .then(qs => {
              // Groq uğursuz olsa OpenRouter ilə fallback
              if (!qs && orKey) {
                const orModel = OPENROUTER_MODELS[ci % OPENROUTER_MODELS.length];
                return callOpenRouter(orKey, orModel, botSystemPrompt, userPrompt);
              }
              return qs;
            });
        }

        // OpenRouter
        if (orKey) {
          const model = OPENROUTER_MODELS[ci % OPENROUTER_MODELS.length];
          return callOpenRouter(orKey, model, botSystemPrompt, userPrompt);
        }

        return Promise.resolve(null);
      });

      const results = await Promise.all(tasks);
      for (const qs of results) {
        if (Array.isArray(qs)) allQuestions.push(...qs);
      }
    }

    if (allQuestions.length === 0) {
      return NextResponse.json(
        { error: "AI sual yarada bilmədi. Groq və OpenRouter hər ikisi uğursuz oldu. Bir az gözləyib yenidən cəhd edin." },
        { status: 502 }
      );
    }

    // İstənən saydan çox gəlibsə kəs, az gəlibsə hamısını qaytar
    const finalQuestions = allQuestions.slice(0, questionCount);

    const normalized = finalQuestions.map((q: any) => ({
      text: q.text || "",
      imageUrl: "",
      questionType: "CHOICE",
      openAnswerExample: "",
      options: Array.isArray(q.options)
        ? q.options.map((o: any) => ({ label: o.label || "A", text: o.text || "" }))
        : [
            { label: "A", text: "" },
            { label: "B", text: "" },
            { label: "C", text: "" },
            { label: "D", text: "" },
          ],
      correctOption: q.correctOption || "A",
      points: 1,
    }));

    return NextResponse.json({ questions: normalized });
  } catch (err: any) {
    console.error("AI generate-quiz error:", err?.message ?? err);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}
