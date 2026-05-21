import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic    = "force-dynamic";
export const runtime    = "nodejs";
export const maxDuration = 55;

// ─── Worker konfiqurasiyası ───────────────────────────────────────────────────
// Hər worker fərqli model + fərqli rate limit → paralel göndərmək təhlükəsizdir
interface Worker {
  id: string;
  provider: "groq" | "openrouter";
  jsonMode: boolean;
  maxPerCall: number; // bir sorğuda optimal sual sayı
}

const ALL_WORKERS: Worker[] = [
  // Groq — yalnız llama-3.3-70b json_object dəstəkləyir
  { id: "llama-3.3-70b-versatile",                provider: "groq",       jsonMode: true,  maxPerCall: 20 },
  // llama-3.1-8b json_object dəstəkləmir — jsonMode: false
  { id: "llama-3.1-8b-instant",                   provider: "groq",       jsonMode: false, maxPerCall: 15 },
  // OpenRouter — mövcud pulsuz modellər (API-dən yoxlanıldı, 2026-05)
  { id: "meta-llama/llama-3.3-70b-instruct:free", provider: "openrouter", jsonMode: false, maxPerCall: 12 },
  { id: "openai/gpt-oss-120b:free",               provider: "openrouter", jsonMode: false, maxPerCall: 12 },
  { id: "openai/gpt-oss-20b:free",                provider: "openrouter", jsonMode: false, maxPerCall: 10 },
  { id: "qwen/qwen3-coder:free",                  provider: "openrouter", jsonMode: false, maxPerCall: 10 },
  { id: "z-ai/glm-4.5-air:free",                  provider: "openrouter", jsonMode: false, maxPerCall: 10 },
];

// ─── JSON parser ──────────────────────────────────────────────────────────────
function extractQuestions(raw: string): any[] | null {
  if (!raw) return null;
  const text = raw
    .replace(/^```json\s*/im, "")
    .replace(/^```\s*/im, "")
    .replace(/\s*```\s*$/im, "")
    .trim();

  const tries: Array<() => any> = [
    () => JSON.parse(text),
    () => {
      const s = text.indexOf("{"), e = text.lastIndexOf("}");
      if (s < 0 || e < 0) throw 0;
      return JSON.parse(text.slice(s, e + 1));
    },
    () => {
      const s = text.indexOf("["), e = text.lastIndexOf("]");
      if (s < 0 || e < 0) throw 0;
      return { questions: JSON.parse(text.slice(s, e + 1)) };
    },
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

// ─── Tək worker çağırışı ─────────────────────────────────────────────────────
async function callWorker(
  w: Worker,
  groqKey: string | undefined,
  orKey: string | undefined,
  system: string,
  user: string,
): Promise<any[] | null> {
  const key = w.provider === "groq" ? groqKey : orKey;
  if (!key) return null;

  const endpoint = w.provider === "groq"
    ? "https://api.groq.com/openai/v1/chat/completions"
    : "https://openrouter.ai/api/v1/chat/completions";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${key}`,
  };
  if (w.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://ulvi-asad-hnez.vercel.app";
    headers["X-Title"]      = "Muellim Portal";
  }

  const body: any = {
    model: w.id,
    messages: [
      { role: "system", content: system },
      { role: "user",   content: user   },
    ],
    temperature: 0.7,
    max_tokens: 12000,
  };
  if (w.jsonMode) body.response_format = { type: "json_object" };

  try {
    const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.warn(`[${w.id}] HTTP ${res.status}: ${errBody.slice(0, 150)}`);
      return null;
    }

    const data = await res.json().catch(() => null);
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      console.warn(`[${w.id}] empty content`);
      return null;
    }

    const qs = extractQuestions(content);
    console.log(`[${w.id}] returned ${qs?.length ?? 0} questions`);
    return qs;
  } catch (e: any) {
    console.warn(`[${w.id}] fetch error: ${e?.message}`);
    return null;
  }
}

// ─── Content-i hissələrə böl ──────────────────────────────────────────────────
function splitContent(content: string, parts: number): string[] {
  if (!content || parts <= 1) return [content || ""];
  const size = Math.ceil(content.length / parts);
  const chunks: string[] = [];
  let start = 0;
  while (start < content.length) {
    let end = Math.min(start + size, content.length);
    if (end < content.length) {
      const sp = content.lastIndexOf(" ", end);
      if (sp > start) end = sp;
    }
    chunks.push(content.slice(start, end).trim());
    start = end;
  }
  return chunks.filter(Boolean);
}

// ─── Paralel generasiya ───────────────────────────────────────────────────────
// 25-ə qədər: tək sorğu.
// 26-50: 2 paralel sorğu (hər biri yarısını alır) — token limitinə sığır.
async function generateParallel(
  totalNeeded: number,
  system: string,
  buildPrompt: (count: number, chunk: string, workerIdx: number, attempt: number) => string,
  groqKey: string | undefined,
  orKey: string | undefined,
  contentChunks: string[],
): Promise<any[]> {

  const chunk = contentChunks[0] || "";
  const collected: any[] = [];
  const seen = new Set<string>();

  const addAll = (qs: any[]) => {
    for (const q of qs) {
      const k = q.text?.trim().toLowerCase();
      if (k && !seen.has(k)) { seen.add(k); collected.push(q); }
    }
  };

  // Bütün mövcud modellər — Groq əvvəl, sonra OpenRouter
  const allModels = ALL_WORKERS.filter(w =>
    w.provider === "groq" ? !!groqKey : !!orKey
  );

  if (allModels.length === 0) return [];

  // 25-dən çox sual üçün ardıcıl 2 sorğu göndər
  // Paralel deyil — rate limit problemi olmur
  if (totalNeeded > 25) {
    const half1 = Math.ceil(totalNeeded / 2);
    const half2 = totalNeeded - half1;
    const model1 = allModels[0]; // llama-3.3-70b
    const model2 = allModels[1] || allModels[0]; // llama-3.1-8b

    console.log(`[seq-2] sorğu 1: ${half1} sual, model=${model1.id}`);
    const qs1 = await callWorker(model1, groqKey, orKey, system, buildPrompt(half1 + 2, chunk, 0, 0));
    if (qs1) addAll(qs1);
    console.log(`[seq-2] sorğu 1 nəticə: ${collected.length}`);

    // Qısa fasilə — rate limit üçün
    await new Promise(r => setTimeout(r, 500));

    console.log(`[seq-2] sorğu 2: ${half2} sual, model=${model2.id}`);
    const qs2 = await callWorker(model2, groqKey, orKey, system, buildPrompt(half2 + 2, chunk, 1, 0));
    if (qs2) addAll(qs2);
    console.log(`[seq-2] sorğu 2 nəticə: ${collected.length}/${totalNeeded}`);

    // Hələ çatmırsa — əlavə sorğu
    if (collected.length < totalNeeded) {
      const deficit = totalNeeded - collected.length;
      console.log(`[seq-2] deficit=${deficit}, əlavə sorğu`);
      await new Promise(r => setTimeout(r, 500));
      const best = allModels.find(w => w.provider === "groq") || allModels[0];
      const qs3 = await callWorker(best, groqKey, orKey, system, buildPrompt(deficit + 2, chunk, 0, 1));
      if (qs3) addAll(qs3);
    }

    return collected.slice(0, totalNeeded);
  }

  // 25-ə qədər: modellər sırayla sınanır
  for (let attempt = 0; attempt < allModels.length && collected.length < totalNeeded; attempt++) {
    const model = allModels[attempt];
    const stillNeed = totalNeeded - collected.length;
    const askFor = stillNeed + 2;

    console.log(`[attempt ${attempt + 1}] model=${model.id}, asking=${askFor}`);

    const qs = await callWorker(
      model, groqKey, orKey, system,
      buildPrompt(askFor, chunk, attempt, attempt > 0 ? 1 : 0)
    );

    if (qs && qs.length > 0) {
      addAll(qs);
      console.log(`[attempt ${attempt + 1}] got ${qs.length}, total=${collected.length}/${totalNeeded}`);
    } else {
      console.warn(`[attempt ${attempt + 1}] model=${model.id} returned nothing`);
    }

    if (collected.length >= totalNeeded) break;

    if (attempt < allModels.length - 1) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return collected.slice(0, totalNeeded);
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
      const seenT = new Set<string>();
      outer: for (const quiz of quizzes) {
        for (const q of quiz.questions) {
          if (wrongQs.length >= 10) break outer;
          const norm = q.text.replace(/<[^>]+>/g, "").trim().toLowerCase();
          if (wrongSet.has(norm) && !seenT.has(norm)) {
            seenT.add(norm);
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

    // ── Content məhdudlaşdırması ──
    // Bot content varsa — max 2500 simvol (token limitinə görə)
    // Böyük content-lər truncate edilir
    const safeContent = botContent ? botContent.slice(0, 2500) : "";

    // ── Prompt builder ──
    const lang     = language === "az" ? "Azərbaycan dilində" : language === "ru" ? "Rus dilində" : "İngilis dilində";
    const catLabel = category || "ümumi bilik";

    const allAvoid = [
      ...avoidTexts.slice(0, 15),
      ...(prevSummary ? prevSummary.split("\n").slice(0, 15) : []),
    ].filter(Boolean);

    const avoidPart = allAvoid.length > 0
      ? `\n\nAŞAĞIDAKI SUALLAR ARTIQ YARADILIB — BUNLARI VƏ BUNLARA OXŞAR SUALLAR YARATMA:\n---\n${allAvoid.join("\n")}\n---\n`
      : "";

    const aspects = ["", " Fərqli aspektlərə fokuslan.", " Praktiki suallar yarat.", " Nəzəri suallar yarat.", " Müqayisəli suallar yarat."];

    const buildPrompt = (count: number, chunk: string, workerIdx: number, attempt: number): string => {
      // chunk parametri artıq istifadə edilmir — safeContent birbaşa əlavə edilir
      const ctx   = safeContent ? `\n\nBilik bazası:\n---\n${safeContent}\n---\n` : "";
      const hint  = aspects[workerIdx % aspects.length] || "";
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

    // ── Paralel generasiya ──
    const rawQs = await generateParallel(
      questionCount, systemPrompt, buildPrompt,
      groqKey, orKey, [""], // contentChunks artıq buildPrompt içindədir
    );

    if (rawQs.length === 0) {
      return NextResponse.json(
        { error: "AI sual yarada bilmədi. API limitləri dolmuş ola bilər — bir neçə saniyə gözləyib yenidən cəhd edin." },
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
