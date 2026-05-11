import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

    // Bot seçilibsə — onun prompt və content-ini yüklə
    let botSystemPrompt = "Sən yalnız JSON formatında cavab verən quiz yaradıcısısan. Heç vaxt JSON-dan kənar mətn yazma. Yalnız düzgün JSON obyekti qaytar.";
    let botContext = "";

    if (botId) {
      const bot = await prisma.aiBot.findUnique({
        where: { id: botId, active: true },
        select: { name: true, prompt: true, content: true },
      });

      if (!bot) {
        return NextResponse.json({ error: "Seçilmiş AI bot tapılmadı" }, { status: 404 });
      }

      // Bot-un öz sistem promptunu istifadə et
      botSystemPrompt = `${bot.prompt}\n\nÖNƏMLİ: Yalnız JSON formatında cavab ver. Heç vaxt JSON-dan kənar mətn yazma.`;
      botContext = bot.content
        ? `\n\nAşağıdakı bilik bazasından istifadə et:\n---\n${bot.content}\n---`
        : "";
    }

    const langLabel =
      language === "az" ? "Azərbaycan dilində" :
      language === "ru" ? "Rus dilində" : "İngilis dilində";
    const categoryLabel = category || "ümumi bilik";

    const userPrompt = `${langLabel} "${title}" mövzusu üzrə ${questionCount} ədəd test sualı yarat.
Kateqoriya: ${categoryLabel}${botContext}

Tələblər:
- Hər sualın 4 variant cavabı olsun (A, B, C, D)
- Yalnız 1 düzgün cavab olsun
- Suallar mövzuya uyğun, aydın və dəqiq olsun
- Variantlar inandırıcı olsun (yalnız biri düzgün, digərləri məntiqli amma yanlış)
- Suallar müxtəlif çətinlik dərəcəsində olsun
${botId ? "- Yalnız verilmiş bilik bazasındakı məlumatlardan istifadə et, kənara çıxma" : ""}

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

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: botSystemPrompt },
          { role: "user",   content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4096,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error("Groq API error:", response.status, JSON.stringify(errData));

      if (response.status === 401) {
        return NextResponse.json({ error: "Groq API açarı yanlışdır" }, { status: 503 });
      }
      if (response.status === 429) {
        return NextResponse.json({ error: "Groq limit aşıldı. Bir az gözləyib yenidən cəhd edin." }, { status: 429 });
      }
      if (response.status === 400) {
        const msg = errData?.error?.message || "Sorğu yanlışdır";
        return NextResponse.json({ error: `Groq xətası: ${msg}` }, { status: 502 });
      }
      return NextResponse.json({ error: `AI xidməti cavab vermədi (${response.status})` }, { status: 502 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: "AI cavab vermədi" }, { status: 502 });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: "AI cavabı parse edilmədi" }, { status: 502 });
    }

    const questions = parsed.questions;
    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: "AI sual yarada bilmədi" }, { status: 502 });
    }

    const normalized = questions.map((q: any) => ({
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
