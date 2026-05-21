import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic    = "force-dynamic";
export const runtime    = "nodejs";
export const maxDuration = 55;

// ─── Worker konfiqurasiyası ───────────────────────────────────────────────────
// Hər worker: model + provider + öz rate limit-i
// Fərqli modellər = fərqli rate limit → paralel göndərmək təhlükəsizdir
interface Worker {
  id: string;
  provider: "groq" | "openrouter";
  jsonMode: boolean;
  // Bir sorğuda neçə sual istəmək optimal (token limitinə görə)
  maxPerCall: number;
}

const WORKERS: Worker[] = [
  // Groq — JSON mode, sürətli
  { id: "llama-3.3-70b-versatile",                   provider: "groq",       jsonMode: true,  maxPerCall: 15 },
  { id: "llama-3.1-8b-instant",                      provider: "groq",       jsonMode: true,  maxPerCall: 15 },
  // OpenRouter — hər model öz ayrı rate limit-inə malikdir
  { id: "meta-llama/llama-3.3-70b-instruct:free",    provider: "openrouter", jsonMode: false, maxPerCall: 12 },
  { id: "meta-llama/llama-3.1-8b-instruct:free",     provider: "openrouter", jsonMode: false, maxPerCall: 12 },
  { id: "mistralai/mistral-7b-instruct:free",        provider: "openrouter", jsonMode: false, maxPerCall: 10 },
  { id: "google/gemma-3-12b-it:free",                provider: "openrouter", jsonMode: false, maxPerCall: 10 },
  { id: "qwen/qwen3-8b:free",                        provider: "openrouter", jsonMode: false, maxPerCall: 10 },
];

// ─── JSON parser ──────────────────────────────────────────────────────────────
function extractQuestions(raw: string): any[] | null {
  if (!raw) return null;
  const text = raw
    .replace(/^```json\s*/im, "").replace(/^```\s*/im, "").replace(/\s*```\s*$/im, "").trim();

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
    max_tokens: 6000,
  };
  if (w.jsonMode) body.response_format = { type: "json_object" };

  try {
    const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
    if (res.status === 429) { console.warn(`[${w.id}] 429`); return null; }
    if (!res.ok)            { console.warn(`[${w.id}] HTTP ${res.status}`); return null; }
    const data = await res.json().catch(() => null);
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;
    return extractQuestions(content);
  } catch (e: any) {
    console.warn(`[${w.id}] ${e?.message}`);
    return null;
  }
}

// ─── Əsas funksiya: paralel worker + content chunking ────────────────────────
// Strategiya:
//   1. Mövcud worker-ləri müəyyən et (groqKey/orKey-ə görə)
//   2. Bot content varsa → hissələrə böl, hər worker öz hissəsini alır
//   3. Sualları worker-lər arasında paylaşdır
//   4. Hamısını eyni anda göndər (Promise.allSettled)
//   5. Nəticələri birləşdir, dublikatları sil
//   6. Hələ çatmırsa → uğurlu worker-lərlə retry
async function generateQuestions(
  totalNeeded: number,
  system: string,
  buildPrompt: (count: number, contentChunk: string, workerIdx: number, attempt: number) => string,
  groqKey: string | undefined,
  orKey: string | undefined,
  contentChunks: string[],  // bot content hissələri (bot yoxdursa [""])
): Promise<any[]> {

  // Mövcud worker-ləri filtrə et
  const available = WORKERS.filter(w =>
    w.provider === "groq" ? !!groqKey : !!orKey
  );
  if (available.length === 0) return [];

  const collected: any[] = [];
  const seen = new Set<string>();

  const addQuestions = (qs: any[]) => {
    for (const q of qs) {
      const k = q.text?.trim().toLowerCase();
      if (k && !seen.has(k)) { seen.add(k); collected.push(q); }
    }
  };

  // ── Mərhələ 1: İlk paralel dalğa ──────────────────────────────────────────
  // Sualları worker-lər arasında paylaşdır
  // Content chunk-ları da worker-lər arasında paylaşdır
  const assignments = buildAssignments(available, totalNeeded, contentChunks);

  const wave1 = await Promise.allSettled(
    assignments.map(({ worker, count, chunk }, idx) =>
      callWorker(worker, groqKey, orKey, system, buildPrompt(count, chunk, idx, 0))
    )
  );

  const successfulWorkers: Worker[] = [];
  for (let i = 0; i < wave1.length; i++) {
    const r = wave1[i];
    if (r.status === "fulfilled" && r.value) {
      addQuestions(r.value);
      successfulWorkers.push(assignments[i].worker);
    } else {
      console.warn(`[wave1] worker ${assignments[i].worker.id} uğursuz`);
    }
  }

  // ── Mərhələ 2: Çatmayan suallar üçün retry ────────────────────────────────
  if (collected.length < totalNeeded && successfulWorkers.length > 0) {
    const deficit = totalNeeded - collected.length;
    console.log(`[wave2] ${deficit} sual çatmır, retry...`);

    // Artıq yaradılmış sualları avoid list-ə əlavə et
    const alreadyCreated = collected.slice(0, 20).map(q => q.text?.slice(0, 60)).filter(Boolean);
    const avoidNote = alreadyCreated.length > 0
      ? `\n\nBU SUALLAR ARTIQ YARADILIB — BUNLARA OXŞAR YARATMA:\n${alreadyCreated.join("\n")}\n`
      : "";

    // Uğurlu worker-ləri yenidən işlət
    const retryAssignments = buildAssignments(successfulWorkers, deficit, contentChunks);

    const wave2 = await Promise.allSettled(
      retryAssignments.map(({ worker, count, chunk }, idx) =>
        callWorker(worker, groqKey, orKey, system,
          buildPrompt(count, chunk, idx, 1) + avoidNote)
      )
    );

    for (const r of wave2) {
      if (r.status === "fulfilled" && r.value) addQuestions(r.value);
    }
  }

  // ── Mərhələ 3: Hələ çatmırsa — ən sürətli worker ilə son cəhd ─────────────
  if (collected.length < totalNeeded) {
    const deficit = totalNeeded - collected.length;
    const fastWorker = available.find(w => w.provider === "groq") || available[0];
    console.log(`[wave3] ${deficit} sual çatmır, son cəhd: ${fastWorker.id}`);

    const alreadyCreated = collected.slice(0, 30).map(q => q.text?.slice(0, 60)).filter(Boolean);
    const avoidNote = alreadyCreated.length > 0
      ? `\n\nBU SUALLAR ARTIQ YARADILIB — BUNLARA OXŞAR YARATMA:\n${alreadyCreated.join("\n")}\n`
      : "";

    const qs = await callWorker(
      fastWorker, groqKey, orKey, system,
      buildPrompt(deficit + 3, contentChunks[0] || "", 0, 2) + avoidNote
    );
    if (qs) addQuestions(qs);
  }

  return collected.slice(0, totalNeeded);
}

// ─── Worker assignment: sualları və content-i worker-lər arasında paylaşdır ──
function buildAssignments(
  workers: Worker[],
  totalCount: number,
  contentChunks: string[],
): Array<{ worker: Worker; count: number; chunk: string }> {
  if (workers.length === 0) return [];

  // Hər worker-ə neçə sual düşür
  const base = Math.floor(totalCount / workers.length);
  const rem  = totalCount % workers.length;

  return workers.map((worker, i) => {
    const count = Math.min(
      base + (i < rem ? 1 : 0),
      worker.maxPerCall,
    );
    // Content chunk-ları worker-lər arasında dövri paylaşdır
    const chunk = contentChunks[i % contentChunks.length] || "";
    return { worker, count, chunk };
  }).filter(a => a.count > 0);
}

// ─── Content-i hissələrə böl ──────────────────────────────────────────────────
function splitContent(content: string, workerCount: number): string[] {
  if (!content || workerCount <= 1) return [content || ""];

  const chunkSize = Math.ceil(content.length / workerCount);
  const chunks: string[] = [];
  let start = 0;

  while (start < content.length) {
    let end = Math.min(start + chunkSize, content.length);
    // Söz ortasında kəsmə
    if (end < content.length) {
      const lastSpace = content.lastIndexOf(" ", end);
      if (lastSpace > start) end = lastSpace;
    }
    chunks.push(content.slice(start, end).trim());
    start = end;
  }

  return chunks.filter(Boolean);
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

    // ── Mövcud worker sayını hesabla ──
    const availableCount = WORKERS.filter(w =>
      w.provider === "groq" ? !!groqKey : !!orKey
    ).length;

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

    // ── Content-i worker sayına görə hissələrə böl ──
    // Bot content varsa → hər worker öz hissəsini alır
    // Bot content yoxdursa → hamısı eyni boş string alır
    const contentChunks = botContent
      ? splitContent(botContent, availableCount)
      : [""];

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
      const ctx   = chunk ? `\n\nBilik bazası:\n---\n${chunk}\n---\n` : "";
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
    const rawQs = await generateQuestions(
      questionCount, systemPrompt, buildPrompt,
      groqKey, orKey, contentChunks,
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
      meta: { requested: questionCount, generated: rawQs.length, workers: availableCount },
    });

  } catch (err: any) {
    console.error("generate-quiz error:", err?.message ?? err);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}
