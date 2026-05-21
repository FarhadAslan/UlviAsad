import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime  = "nodejs";
export const maxDuration = 55; // Vercel hobby: 60s, biz 55s saxlayırıq

// ─── Modellər ────────────────────────────────────────────────────────────────
const GROQ_MODELS = [
  { id: "llama-3.3-70b-versatile",                   jsonMode: true  },
  { id: "llama-3.1-8b-instant",                      jsonMode: true  },
  { id: "meta-llama/llama-4-scout-17b-16e-instruct", jsonMode: false },
  { id: "openai/gpt-oss-120b",                       jsonMode: true  },
];

const OR_MODELS = [
  { id: "meta-llama/llama-3.3-70b-instruct:free", jsonMode: false },
  { id: "meta-llama/llama-3.1-8b-instruct:free",  jsonMode: false },
  { id: "mistralai/mistral-7b-instruct:free",     jsonMode: false },
];

// ─── JSON parser ──────────────────────────────────────────────────────────────
function extractQuestions(raw: string): any[] | null {
  if (!raw) return null;
  let text = raw
    .replace(/^```json\s*/im, "").replace(/^```\s*/im, "").replace(/\s*```\s*$/im, "").trim();

  const tries = [
    () => JSON.parse(text),
    () => { const s = text.indexOf("{"), e = text.lastIndexOf("}"); if (s < 0 || e < 0) throw 0; return JSON.parse(text.slice(s, e + 1)); },
    () => { const s = text.indexOf("["), e = text.lastIndexOf("]"); if (s < 0 || e < 0) throw 0; return { questions: JSON.parse(text.slice(s, e + 1)) }; },
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
async function callModel(
  id: string, jsonMode: boolean, isGroq: boolean,
  groqKey: string | undefined, orKey: string | undefined,
  system: string, user: string,
): Promise<any[] | null> {
  const key = isGroq ? groqKey : orKey;
  if (!key) return null;

  const endpoint = isGroq
    ? "https://api.groq.com/openai/v1/chat/completions"
    : "https://openrouter.ai/api/v1/chat/completions";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${key}`,
  };
  if (!isGroq) {
    headers["HTTP-Referer"] = "https://ulvi-asad-hnez.vercel.app";
    headers["X-Title"]      = "Muellim Portal";
  }

  const body: any = {
    model: id,
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    temperature: 0.7,
    max_tokens: 8000,
  };
  if (jsonMode) body.response_format = { type: "json_object" };

  try {
    const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
    if (res.status === 429) { console.warn(`[${id}] 429 rate limit`); return null; }
    if (!res.ok)            { console.warn(`[${id}] HTTP ${res.status}`); return null; }
    const data = await res.json().catch(() => null);
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;
    return extractQuestions(content);
  } catch (e: any) {
    console.warn(`[${id}] error: ${e?.message}`);
    return null;
  }
}

// ─── fetchUntilFull: lazım olan sayı toplayana qədər retry ───────────────────
// Ardıcıl işləyir — rate limit problemi olmur.
// Hər cəhddə fərqli model sınanır. Dublikat suallar atlanır, retry davam edir.
async function fetchUntilFull(
  needed: number,
  system: string,
  buildPrompt: (count: number, attempt: number) => string,
  groqKey: string | undefined,
  orKey: string | undefined,
  maxAttempts = 8,
): Promise<any[]> {
  const collected: any[] = [];
  const seen = new Set<string>();

  const allModels = [
    ...GROQ_MODELS.map(m => ({ ...m, isGroq: true  })),
    ...OR_MODELS  .map(m => ({ ...m, isGroq: false })),
  ].filter(m => m.isGroq ? !!groqKey : !!orKey);

  if (allModels.length === 0) return [];

  for (let attempt = 0; attempt < maxAttempts && collected.length < needed; attempt++) {
    const stillNeed = needed - collected.length;
    const askFor    = stillNeed + 3; // 3 ehtiyat — az overhead, az token

    const model = allModels[attempt % allModels.length];
    const questions = await callModel(
      model.id, model.jsonMode, model.isGroq,
      groqKey, orKey, system, buildPrompt(askFor, attempt),
    );

    if (Array.isArray(questions) && questions.length > 0) {
      for (const q of questions) {
        const key = q.text?.trim().toLowerCase();
        if (!key) continue;
        if (!seen.has(key)) {
          seen.add(key);
          collected.push(q);
        }
        // Dublikat olsa da davam et — break yoxdur!
      }
    }

    // Rate limit-dən qaçmaq üçün cəhdlər arasında qısa fasilə
    if (collected.length < needed && attempt < maxAttempts - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return collected.slice(0, needed);
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
      const seen = new Set<string>();
      outer: for (const quiz of quizzes) {
        for (const q of quiz.questions) {
          if (wrongQs.length >= 10) break outer;
          const norm = q.text.replace(/<[^>]+>/g, "").trim().toLowerCase();
          if (wrongSet.has(norm) && !seen.has(norm)) {
            seen.add(norm);
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

    let botContent = "";
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

      botContent = bot.content || "";

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
    const ctx      = botContent ? `\n\nBilik bazası:\n---\n${botContent.slice(0, 3000)}\n---\n` : "";

    const allAvoid = [
      ...avoidTexts.slice(0, 20),
      ...(prevSummary ? prevSummary.split("\n").slice(0, 20) : []),
    ].filter(Boolean);

    const avoidPart = allAvoid.length > 0
      ? `\n\nAŞAĞIDAKI SUALLAR ARTIQ YARADILIB — BUNLARI VƏ BUNLARA OXŞAR SUALLAR YARATMA:\n---\n${allAvoid.join("\n")}\n---\n`
      : "";

    const aspects = ["", " Fərqli aspektlərə fokuslan.", " Praktiki suallar yarat.", " Nəzəri suallar yarat.", " Müqayisəli suallar yarat."];

    const buildPrompt = (count: number, attempt: number): string => {
      const hint  = aspects[attempt % aspects.length] || "";
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

    // ── Sualları topla ──
    const rawQs = await fetchUntilFull(questionCount, systemPrompt, buildPrompt, groqKey, orKey);

    if (rawQs.length === 0) {
      return NextResponse.json(
        { error: "AI sual yarada bilmədi. Groq/OpenRouter limiti dolmuş ola bilər — bir neçə saniyə gözləyib yenidən cəhd edin." },
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
