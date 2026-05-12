import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Fərqli modellər — hər birinin ayrı TPM limiti var
// Paralel işlədildikdə effektiv limit artır
// Qeyd: response_format json_object yalnız llama modelləri dəstəkləyir
const GROQ_MODELS = [
  "llama-3.1-8b-instant",      // 20,000 TPM — sürətli
  "llama3-8b-8192",             // 30,000 TPM — ən yüksək limit
  "llama-3.3-70b-versatile",    // 6,000 TPM — ən yüksək keyfiyyət
];

const CHUNK_SIZE = 7_000; // ~1750 token per chunk

async function callGroq(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  retries = 3
): Promise<any[] | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
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
      const waitMs = 4000 * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    if (!res.ok) {
      console.error(`Groq [${model}] error:`, res.status);
      return null;
    }

    const data    = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    try {
      // Bəzən model JSON-u markdown code block içinə bükür — təmizlə
      const cleaned = content
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
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

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Groq API açarı konfiqurasiya edilməyib. GROQ_API_KEY mühit dəyişənini əlavə edin." },
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
        if (content.length <= CHUNK_SIZE) {
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

    // Hər chunk üçün task hazırla
    const tasks = botChunks.map((chunk, ci) => {
      const countForChunk = baseCount + (ci < remainder ? 1 : 0);
      const model         = GROQ_MODELS[ci % GROQ_MODELS.length]; // modellər növbə ilə
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

      return { model, systemForChunk, userPrompt, countForChunk };
    });

    // Bütün chunk-ları PARALEL göndər — hər biri fərqli model
    const results = await Promise.all(
      tasks.map(({ model, systemForChunk, userPrompt, countForChunk }) =>
        countForChunk > 0
          ? callGroq(apiKey, model, systemForChunk, userPrompt)
          : Promise.resolve(null)
      )
    );

    // Nəticələri birləşdir
    const allQuestions: any[] = [];
    for (const qs of results) {
      if (Array.isArray(qs)) allQuestions.push(...qs);
    }

    if (allQuestions.length === 0) {
      return NextResponse.json({ error: "AI sual yarada bilmədi. Groq limiti aşılmış ola bilər, bir az gözləyib yenidən cəhd edin." }, { status: 502 });
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
