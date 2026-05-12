import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Groq modellər (kiçik mətn üçün)
const GROQ_MODELS = [
  "llama-3.1-8b-instant",
  "llama3-8b-8192",
  "llama-3.3-70b-versatile",
];

// OpenRouter pulsuz modellər (böyük mətn üçün paralel)
const OPENROUTER_MODELS = [
  "meta-llama/llama-3.1-8b-instruct:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "mistralai/mistral-7b-instruct:free",
  "google/gemma-2-9b-it:free",
  "qwen/qwen-2.5-7b-instruct:free",
];

const CHUNK_SIZE   = 8_000;  // hər chunk ~2000 token
const DIRECT_LIMIT = 12_000; // bu qədərə qədər Groq ilə birbaşa göndər

// JSON formatında sual qaytaran sorğu
async function callAI(
  endpoint: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  extraHeaders: Record<string, string> = {},
  retries = 2
): Promise<any[] | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4096,
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429 && attempt < retries) {
      await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) {
      console.error(`AI [${model}] error:`, res.status, await res.text().catch(() => ""));
      return null;
    }

    const data    = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    try {
      const cleaned = content
        .replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
      const parsed = JSON.parse(cleaned);
      return Array.isArray(parsed.questions) ? parsed.questions : null;
    } catch {
      return null;
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;

    if (!session || (userRole !== "ADMIN" && userRole !== "TEACHER")) {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    const groqKey   = process.env.GROQ_API_KEY;
    const orKey     = process.env.OPENROUTER_API_KEY;

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

    let botSystemPrompt = "Sən yalnız JSON formatında cavab verən quiz yaradıcısısan. Heç vaxt JSON-dan kənar mətn yazma. Yalnız düzgün JSON obyekti qaytar.";
    let botChunks: string[] = [""]; // bot yoxdursa tək boş chunk

    if (botId) {
      const bot = await prisma.aiBot.findUnique({
        where: { id: botId, active: true },
        select: { name: true, prompt: true, content: true },
      });

      if (!bot) {
        return NextResponse.json({ error: "Seçilmiş AI bot tapılmadı" }, { status: 404 });
      }

      botSystemPrompt = `${bot.prompt}\n\nÖNƏMLİ: Yalnız JSON formatında cavab ver. Heç vaxt JSON-dan kənar mətn yazma.`;

      if (bot.content) {
        const content = bot.content;
        if (content.length <= DIRECT_LIMIT) {
          // Kiçik mətn — birbaşa tək chunk
          botChunks = [content];
        } else {
          // Böyük mətn — chunk-lara böl
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

    // Hər chunk üçün task hazırla
    const tasks = botChunks.map((chunk, ci) => {
      const countForChunk = baseCount + (ci < remainder ? 1 : 0);
      const systemForChunk = chunk
        ? `${botSystemPrompt}\n\nBilik bazası (${ci + 1}/${chunkCount} hissə):\n---\n${chunk}\n---`
        : botSystemPrompt;

      const userPrompt = `${langLabel} "${title}" mövzusu üzrə ${countForChunk} ədəd test sualı yarat.
Kateqoriya: ${categoryLabel}

Tələblər:
- Hər sualın 4 variant cavabı olsun (A, B, C, D)
- Yalnız 1 düzgün cavab olsun
- Suallar mövzuya uyğun, aydın və dəqiq olsun
- Variantlar inandırıcı olsun (yalnız biri düzgün, digərləri məntiqli amma yanlış)
- Suallar müxtəlif çətinlik dərəcəsində olsun
${botId ? "- Yalnız sistem mesajındakı bilik bazasından istifadə et" : ""}

Cavabı YALNIZ bu JSON formatında ver:
{
  "questions": [
    {
      "text": "Sual mətni",
      "options": [
        { "label": "A", "text": "Variant A" },
        { "label": "B", "text": "Variant B" },
        { "label": "C", "text": "Variant C" },
        { "label": "D", "text": "Variant D" }
      ],
      "correctOption": "A"
    }
  ]
}`;

      return { ci, systemForChunk, userPrompt, countForChunk };
    });

    // Paralel göndər
    // - Tək chunk (kiçik mətn) → Groq
    // - Çox chunk (böyük mətn) → OpenRouter paralel, hər chunk fərqli model
    const results = await Promise.all(
      tasks.map(({ ci, systemForChunk, userPrompt, countForChunk }) => {
        if (countForChunk === 0) return Promise.resolve(null);

        const useOpenRouter = chunkCount > 1 && orKey;

        if (useOpenRouter) {
          // OpenRouter — hər chunk fərqli pulsuz model
          const model = OPENROUTER_MODELS[ci % OPENROUTER_MODELS.length];
          return callAI(
            "https://openrouter.ai/api/v1/chat/completions",
            orKey!,
            model,
            systemForChunk,
            userPrompt,
            {
              "HTTP-Referer": "https://ulvi-asad-hnez.vercel.app",
              "X-Title": "Muellim Portal",
            }
          );
        } else {
          // Groq — tək chunk üçün
          const model = GROQ_MODELS[ci % GROQ_MODELS.length];
          return callAI(
            "https://api.groq.com/openai/v1/chat/completions",
            groqKey!,
            model,
            systemForChunk,
            userPrompt
          );
        }
      })
    );

    const allQuestions: any[] = [];
    for (const qs of results) {
      if (Array.isArray(qs)) allQuestions.push(...qs);
    }

    if (allQuestions.length === 0) {
      return NextResponse.json(
        { error: "AI sual yarada bilmədi. Yenidən cəhd edin." },
        { status: 502 }
      );
    }

    const normalized = allQuestions.map((q: any) => ({
      text: q.text || "",
      imageUrl: "",
      questionType: "CHOICE",
      openAnswerExample: "",
      options: Array.isArray(q.options)
        ? q.options.map((o: any) => ({ label: o.label, text: o.text }))
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
