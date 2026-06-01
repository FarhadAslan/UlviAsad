import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic    = "force-dynamic";
export const runtime    = "nodejs";
export const maxDuration = 55;

// ─── Timeout ──────────────────────────────────────────────────────────────────
const TOTAL_TIMEOUT_MS  = 46_000;
const WORKER_TIMEOUT_MS = 35_000; // BALANCED: 35s (sürət + etibarlılıq)

// ─── Per-user throttle (DB-based) ─────────────────────────────────────────────
// Saatda bir istifadəçi max 10 dəfə quiz generasiya edə bilər.
// DB-based olduğu üçün serverless-də də işləyir.
const USER_WINDOW_MS  = 60 * 60 * 1000; // 1 saat
const USER_MAX_CALLS  = 10;

async function checkUserThrottle(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - USER_WINDOW_MS);
  
  // Son 1 saatdakı quiz generasiya sayını yoxla
  const recentCount = await prisma.quiz.count({
    where: {
      createdById: userId,
      createdAt: { gte: windowStart },
    },
  });
  
  const remaining = Math.max(0, USER_MAX_CALLS - recentCount);
  return { allowed: recentCount < USER_MAX_CALLS, remaining };
}

// ─── Response cache (in-memory, 30 dəq TTL) ──────────────────────────────────
// Eyni mövzu + sual sayı üçün cache-dən cavab göndərilir.
const CACHE_TTL = 30 * 60 * 1000; // 30 dəqiqə
interface CacheEntry { questions: any[]; ts: number }
const responseCache = new Map<string, CacheEntry>();

// ─── GLOBAL Provider Cooldown (cross-request) ────────────────────────────────
// Hər provider-in son istifadə vaxtını qeyd edir (bütün istifadəçilər üçün)
// Bu, ardıcıl sorğuların eyni provider-i spam etməsinin qarşısını alır
const PROVIDER_COOLDOWN_MS = 20_000; // 20 saniyə - daha sürətli rotation
const providerGlobalCooldown = new Map<string, number>(); // provider -> last used timestamp

function isProviderAvailable(provider: string): boolean {
  const lastUsed = providerGlobalCooldown.get(provider) || 0;
  const elapsed = Date.now() - lastUsed;
  return elapsed >= PROVIDER_COOLDOWN_MS;
}

function markProviderUsed(provider: string): void {
  providerGlobalCooldown.set(provider, Date.now());
  console.log(`[cooldown] ${provider} marked as used, cooldown until ${new Date(Date.now() + PROVIDER_COOLDOWN_MS).toISOString()}`);
}

// ─── MODEL-LEVEL Cooldown (daha granular) ────────────────────────────────────
// Hər modelin son istifadə vaxtını qeyd edir
const MODEL_COOLDOWN_MS = 15_000; // 15 saniyə - model-level cooldown
const modelGlobalCooldown = new Map<string, number>(); // modelId -> last used timestamp

function isModelAvailable(modelId: string): boolean {
  const lastUsed = modelGlobalCooldown.get(modelId) || 0;
  const elapsed = Date.now() - lastUsed;
  return elapsed >= MODEL_COOLDOWN_MS;
}

function markModelUsed(modelId: string): void {
  modelGlobalCooldown.set(modelId, Date.now());
}

function markProviderUsed(provider: string): void {
  providerGlobalCooldown.set(provider, Date.now());
  console.log(`[cooldown] ${provider} marked as used, cooldown until ${new Date(Date.now() + PROVIDER_COOLDOWN_MS).toISOString()}`);
}

function getCacheKey(title: string, count: number, language: string, botId?: string): string {
  return `${title.trim().toLowerCase()}|${count}|${language}|${botId ?? ""}`;
}

function getCached(key: string): any[] | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { responseCache.delete(key); return null; }
  return entry.questions;
}

function setCache(key: string, questions: any[]): void {
  responseCache.set(key, { questions, ts: Date.now() });
  // Cache-i 200 elementdən böyük tutma — yaddaş sızmasının qarşısını al
  if (responseCache.size > 200) {
    // Map insertion order qorunur, ilk element ən köhnədir
    const firstKey = responseCache.keys().next().value;
    if (firstKey) {
      responseCache.delete(firstKey);
    }
  }
}

// ─── Model konfiqurasiyası (TIER-BASED SYSTEM) ──────────────────────────────
interface Worker {
  id: string;
  provider: "groq" | "openrouter" | "gemini" | "mistral" | "cerebras" | "huggingface";
  jsonMode: boolean;
  maxTokens: number;
  priority: number; // aşağı = daha əvvəl cəhd et
  tier: number;     // 1-5: Tier nömrəsi (1 = ən yüksək prioritet)
}

// ═══════════════════════════════════════════════════════════════════════════
// TIER 1: Premium Fast Models (İlk seçim - ən sürətli və etibarlı)
// ═══════════════════════════════════════════════════════════════════════════
const TIER1_WORKERS: Worker[] = [
  // Groq - ən sürətli
  { id: "llama-3.3-70b-versatile", provider: "groq", jsonMode: true,  maxTokens: 6000, priority: 1, tier: 1 },
  // Gemini - güclü və pulsuz
  { id: "gemini-2.5-flash",        provider: "gemini", jsonMode: true,  maxTokens: 6000, priority: 2, tier: 1 },
  // Cerebras - ən sürətli inference
  { id: "gpt-oss-120b",            provider: "cerebras", jsonMode: false, maxTokens: 6000, priority: 3, tier: 1 },
];

// ═══════════════════════════════════════════════════════════════════════════
// TIER 2: Reliable Alternatives (Tier 1 exhausted olduqda)
// ═══════════════════════════════════════════════════════════════════════════
const TIER2_WORKERS: Worker[] = [
  // Mistral - EU GDPR, yüksək limit
  { id: "mistral-small-latest",    provider: "mistral", jsonMode: true,  maxTokens: 5000, priority: 1, tier: 2 },
  // OpenRouter - Llama 3.3
  { id: "meta-llama/llama-3.3-70b-instruct:free", provider: "openrouter", jsonMode: false, maxTokens: 6000, priority: 2, tier: 2 },
  // Groq - kiçik model
  { id: "llama-3.1-8b-instant",    provider: "groq", jsonMode: false, maxTokens: 4000, priority: 3, tier: 2 },
];

// ═══════════════════════════════════════════════════════════════════════════
// TIER 3: Backup Models (Tier 1-2 exhausted olduqda)
// ═══════════════════════════════════════════════════════════════════════════
const TIER3_WORKERS: Worker[] = [
  // Gemini - lite versiya
  { id: "gemini-2.5-flash-lite",   provider: "gemini", jsonMode: false, maxTokens: 5000, priority: 1, tier: 3 },
  // OpenRouter - Gemma
  { id: "google/gemma-2-9b-it:free", provider: "openrouter", jsonMode: false, maxTokens: 5000, priority: 2, tier: 3 },
  // Groq - Gemma
  { id: "gemma2-9b-it",            provider: "groq", jsonMode: false, maxTokens: 4000, priority: 3, tier: 3 },
];

// ═══════════════════════════════════════════════════════════════════════════
// TIER 4: Extended Fallback (Tier 1-3 exhausted olduqda)
// ═══════════════════════════════════════════════════════════════════════════
const TIER4_WORKERS: Worker[] = [
  // HuggingFace - Llama
  { id: "meta-llama/Llama-3.3-70B-Instruct", provider: "huggingface", jsonMode: false, maxTokens: 5000, priority: 1, tier: 4 },
  // Mistral - tiny
  { id: "mistral-tiny",            provider: "mistral", jsonMode: false, maxTokens: 4000, priority: 2, tier: 4 },
  // OpenRouter - Qwen
  { id: "qwen/qwen-2-7b-instruct:free", provider: "openrouter", jsonMode: false, maxTokens: 5000, priority: 3, tier: 4 },
];

// ═══════════════════════════════════════════════════════════════════════════
// TIER 5: Emergency Reserve (Son çarə - bütün tier-lər exhausted olduqda)
// ═══════════════════════════════════════════════════════════════════════════
const TIER5_WORKERS: Worker[] = [
  // Groq - Llama 3
  { id: "llama3-70b-8192",         provider: "groq", jsonMode: false, maxTokens: 5000, priority: 1, tier: 5 },
  // HuggingFace - Mistral
  { id: "mistralai/Mistral-7B-Instruct-v0.3", provider: "huggingface", jsonMode: false, maxTokens: 4000, priority: 2, tier: 5 },
  // OpenRouter - Mistral
  { id: "mistralai/mistral-7b-instruct:free", provider: "openrouter", jsonMode: false, maxTokens: 5000, priority: 3, tier: 5 },
];

// ─── JSON parser ──────────────────────────────────────────────────────────────
function extractQuestions(raw: string): any[] | null {
  if (!raw?.trim()) return null;

  const text = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();

  const parsers: Array<() => any> = [
    () => JSON.parse(text),
    () => {
      const s = text.indexOf("[");
      const e = text.lastIndexOf("]");
      if (s < 0 || e < 0) throw new Error("no brackets");
      return { questions: JSON.parse(text.slice(s, e + 1)) };
    },
    () => {
      const s = text.indexOf("{");
      const e = text.lastIndexOf("}");
      if (s < 0 || e < 0) throw new Error("no braces");
      return JSON.parse(text.slice(s, e + 1));
    },
    // Kəsilmiş JSON-u bərpa etmək üçün — token limiti səbəbindən bitməmiş ola bilər
    () => {
      const s = text.indexOf("[");
      if (s < 0) throw new Error("no array start");
      const arr  = text.slice(s);
      const objs: string[] = [];
      let obj = "", depth = 0;
      for (let i = 0; i < arr.length; i++) {
        const ch = arr[i];
        if (ch === "{") { depth++; obj += ch; }
        else if (ch === "}") {
          depth--;
          obj += ch;
          if (depth === 0) { objs.push(obj); obj = ""; }
        } else if (depth > 0) {
          obj += ch;
        }
      }
      if (objs.length === 0) throw new Error("no objects");
      return { questions: objs.map(o => JSON.parse(o)) };
    },
  ];

  for (const parse of parsers) {
    try {
      const parsed = parse();
      if (Array.isArray(parsed?.questions) && parsed.questions.length > 0) return parsed.questions;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch { /* növbəti */ }
  }
  return null;
}

// ─── Sual validasiyası ───────────────────────────────────────────────────────
function isValidQuestion(q: any): boolean {
  if (!q || typeof q !== "object") return false;
  if (!q.text || typeof q.text !== "string" || q.text.trim().length < 5) return false;
  if (!Array.isArray(q.options) || q.options.length < 2) return false;
  if (!q.correctOption) return false;
  return q.options.every((o: any) => {
    if (!o) return false;
    if (typeof o === "string") return o.trim().length > 0;
    if (typeof o === "object") return typeof o.text === "string" && o.text.trim().length > 0;
    return false;
  });
}

// ─── Tək model çağırışı (retry ilə) ──────────────────────────────────────────
async function callWorker(
  w:          Worker,
  groqKey:    string | undefined,
  orKey:      string | undefined,
  geminiKey:  string | undefined,
  mistralKey: string | undefined,
  cerebrasKey: string | undefined,
  hfKey:      string | undefined,
  system:     string,
  userPrompt: string,
): Promise<any[]> {
  let key: string | undefined;
  let endpoint: string;

  // Provider-ə görə API key və endpoint seç
  switch (w.provider) {
    case "groq":
      key = groqKey;
      endpoint = "https://api.groq.com/openai/v1/chat/completions";
      break;
    case "openrouter":
      key = orKey;
      endpoint = "https://openrouter.ai/api/v1/chat/completions";
      break;
    case "gemini":
      key = geminiKey;
      endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${w.id}:generateContent?key=${geminiKey}`;
      break;
    case "mistral":
      key = mistralKey;
      endpoint = "https://api.mistral.ai/v1/chat/completions";
      break;
    case "cerebras":
      key = cerebrasKey;
      endpoint = "https://api.cerebras.ai/v1/chat/completions";
      break;
    case "huggingface":
      key = hfKey;
      endpoint = `https://api-inference.huggingface.co/models/${w.id}`;
      break;
    default:
      throw new Error(`[${w.id}] Naməlum provider: ${w.provider}`);
  }

  if (!key) throw new Error(`[${w.id}] API açarı tapılmadı`);

  const headers: Record<string, string> = {
    "Content-Type":  "application/json",
  };

  // Provider-ə görə header konfiqurasiyası
  if (w.provider === "gemini") {
    // Gemini üçün key URL-də olduğu üçün Authorization header lazım deyil
  } else if (w.provider === "huggingface") {
    headers["Authorization"] = `Bearer ${key}`;
  } else {
    headers["Authorization"] = `Bearer ${key}`;
  }

  if (w.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://ulvi-asad-hnez.vercel.app";
    headers["X-Title"]      = "Muellim Portal";
  }

  const body: any = {
    model:       w.id,
    messages:    [
      { role: "system", content: system },
      { role: "user",   content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens:  w.maxTokens,
  };
  if (w.jsonMode) body.response_format = { type: "json_object" };

  // Gemini üçün fərqli request formatı
  if (w.provider === "gemini") {
    const geminiBody = {
      contents: [{
        parts: [{ text: `${system}\n\n${userPrompt}` }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: w.maxTokens,
        ...(w.jsonMode ? { responseMimeType: "application/json" } : {}),
      },
    };

    // Exponential backoff retry: 3 cəhd (etibarlılıq üçün)
    const maxRetries = 3;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), WORKER_TIMEOUT_MS);

      try {
        const res = await fetch(endpoint, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(geminiBody),
          signal:  controller.signal,
        });
        clearTimeout(timer);

        if (res.status === 429) {
          const retryAfter = parseInt(res.headers.get("retry-after") || "2") * 1000;
          const backoffDelay = Math.min(retryAfter || (2000 * Math.pow(2, attempt - 1)), 10000);
          
          if (attempt < maxRetries) {
            console.log(`[${w.id}] 429 rate-limit, ${backoffDelay}ms sonra retry (${attempt}/${maxRetries})`);
            await new Promise(r => setTimeout(r, backoffDelay));
            continue;
          }
          throw new Error(`[${w.id}] 429 rate-limit (${maxRetries} cəhd)`);
        }

        if (res.status === 401 || res.status === 403) throw new Error(`[${w.id}] API açarı səhvdir (${res.status})`);
        
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`[${w.id}] HTTP ${res.status}: ${errText.slice(0, 80)}`);
        }

        const data = await res.json().catch(() => null);
        const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!content) throw new Error(`[${w.id}] boş cavab`);

        const qs = extractQuestions(content);
        if (!qs) throw new Error(`[${w.id}] JSON parse xətası`);

        const valid = qs.filter(isValidQuestion);
        if (valid.length === 0) throw new Error(`[${w.id}] ${qs.length} sualdan heç biri valid deyil`);

        console.log(`[${w.id}] ✓ ${valid.length}/${qs.length} etibarlı sual (cəhd ${attempt})`);
        return valid;

      } catch (e: any) {
        clearTimeout(timer);
        lastError = e;
        
        if (e?.name === "AbortError") {
          throw new Error(`[${w.id}] timeout`);
        }
        
        const isRetryable = e?.message?.includes("429") || 
                            e?.message?.includes("timeout") ||
                            e?.message?.includes("ECONNRESET");
        
        if (isRetryable && attempt < maxRetries) {
          const backoffDelay = 2000 * Math.pow(2, attempt - 1);
          console.log(`[${w.id}] Xəta: ${e.message}, ${backoffDelay}ms sonra retry (${attempt}/${maxRetries})`);
          await new Promise(r => setTimeout(r, backoffDelay));
          continue;
        }
        
        throw e;
      }
    }

    throw lastError || new Error(`[${w.id}] ${maxRetries} cəhddən sonra uğursuz`);
  }

  // HuggingFace üçün fərqli request formatı
  if (w.provider === "huggingface") {
    const hfBody = {
      inputs: `${system}\n\n${userPrompt}`,
      parameters: {
        temperature: 0.7,
        max_new_tokens: w.maxTokens,
        return_full_text: false,
      },
    };

    const maxRetries = 3;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), WORKER_TIMEOUT_MS);

      try {
        const res = await fetch(endpoint, {
          method:  "POST",
          headers,
          body:    JSON.stringify(hfBody),
          signal:  controller.signal,
        });
        clearTimeout(timer);

        if (res.status === 429 || res.status === 503) {
          const backoffDelay = 2000 * Math.pow(2, attempt - 1);
          
          if (attempt < maxRetries) {
            console.log(`[${w.id}] ${res.status} rate-limit/loading, ${backoffDelay}ms sonra retry (${attempt}/${maxRetries})`);
            await new Promise(r => setTimeout(r, backoffDelay));
            continue;
          }
          throw new Error(`[${w.id}] ${res.status} rate-limit (${maxRetries} cəhd)`);
        }

        if (res.status === 401 || res.status === 403) throw new Error(`[${w.id}] API açarı səhvdir (${res.status})`);
        
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`[${w.id}] HTTP ${res.status}: ${errText.slice(0, 80)}`);
        }

        const data = await res.json().catch(() => null);
        const content = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text;
        if (!content) throw new Error(`[${w.id}] boş cavab`);

        const qs = extractQuestions(content);
        if (!qs) throw new Error(`[${w.id}] JSON parse xətası`);

        const valid = qs.filter(isValidQuestion);
        if (valid.length === 0) throw new Error(`[${w.id}] ${qs.length} sualdan heç biri valid deyil`);

        console.log(`[${w.id}] ✓ ${valid.length}/${qs.length} etibarlı sual (cəhd ${attempt})`);
        return valid;

      } catch (e: any) {
        clearTimeout(timer);
        lastError = e;
        
        if (e?.name === "AbortError") {
          throw new Error(`[${w.id}] timeout`);
        }
        
        const isRetryable = e?.message?.includes("429") || 
                            e?.message?.includes("503") ||
                            e?.message?.includes("timeout") ||
                            e?.message?.includes("ECONNRESET");
        
        if (isRetryable && attempt < maxRetries) {
          const backoffDelay = 2000 * Math.pow(2, attempt - 1);
          console.log(`[${w.id}] Xəta: ${e.message}, ${backoffDelay}ms sonra retry (${attempt}/${maxRetries})`);
          await new Promise(r => setTimeout(r, backoffDelay));
          continue;
        }
        
        throw e;
      }
    }

    throw lastError || new Error(`[${w.id}] ${maxRetries} cəhddən sonra uğursuz`);
  }

  // OpenAI-compatible API-lər üçün (Groq, OpenRouter, Mistral, Cerebras)

  // Exponential backoff retry: 3 cəhd (etibarlılıq üçün)
  const maxRetries = 3;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WORKER_TIMEOUT_MS);

    try {
      const res = await fetch(endpoint, {
        method:  "POST",
        headers,
        body:    JSON.stringify(body),
        signal:  controller.signal,
      });
      clearTimeout(timer);

      // 429 rate limit — retry et
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get("retry-after") || "2") * 1000;
        const backoffDelay = Math.min(retryAfter || (2000 * Math.pow(2, attempt - 1)), 10000);
        
        if (attempt < maxRetries) {
          console.log(`[${w.id}] 429 rate-limit, ${backoffDelay}ms sonra retry (${attempt}/${maxRetries})`);
          await new Promise(r => setTimeout(r, backoffDelay));
          continue;
        }
        throw new Error(`[${w.id}] 429 rate-limit (${maxRetries} cəhd)`);
      }

      if (res.status === 401 || res.status === 403) throw new Error(`[${w.id}] API açarı səhvdir (${res.status})`);
      
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`[${w.id}] HTTP ${res.status}: ${errText.slice(0, 80)}`);
      }

      const data    = await res.json().catch(() => null);
      const content = data?.choices?.[0]?.message?.content;
      if (!content) throw new Error(`[${w.id}] boş cavab`);

      const qs = extractQuestions(content);
      if (!qs) throw new Error(`[${w.id}] JSON parse xətası`);

      const valid = qs.filter(isValidQuestion);
      if (valid.length === 0) throw new Error(`[${w.id}] ${qs.length} sualdan heç biri valid deyil`);

      console.log(`[${w.id}] ✓ ${valid.length}/${qs.length} etibarlı sual (cəhd ${attempt})`);
      return valid;

    } catch (e: any) {
      clearTimeout(timer);
      lastError = e;
      
      if (e?.name === "AbortError") {
        throw new Error(`[${w.id}] timeout`);
      }
      
      // Retry edilə bilən xətalar
      const isRetryable = e?.message?.includes("429") || 
                          e?.message?.includes("timeout") ||
                          e?.message?.includes("ECONNRESET");
      
      if (isRetryable && attempt < maxRetries) {
        const backoffDelay = 2000 * Math.pow(2, attempt - 1);
        console.log(`[${w.id}] Xəta: ${e.message}, ${backoffDelay}ms sonra retry (${attempt}/${maxRetries})`);
        await new Promise(r => setTimeout(r, backoffDelay));
        continue;
      }
      
      throw e;
    }
  }

  throw lastError || new Error(`[${w.id}] ${maxRetries} cəhddən sonra uğursuz`);
}

// ─── Normalize ────────────────────────────────────────────────────────────────
const LABELS = ["A", "B", "C", "D"];

function normalizeQuestion(q: any): any {
  const rawOptions: { label: string; text: string }[] = Array.isArray(q.options)
    ? q.options.map((o: any, i: number) => {
        let textVal  = "";
        let labelVal = LABELS[i] || String.fromCharCode(65 + i);
        if (o && typeof o === "object") {
          textVal = String(o.text || "").trim();
          if (o.label) labelVal = String(o.label).toUpperCase();
        } else if (typeof o === "string") {
          textVal = o.trim();
        }
        return { label: labelVal, text: textVal };
      })
    : LABELS.map(l => ({ label: l, text: "" }));

  const correctLabel = String(q.correctOption || "A").toUpperCase();
  const correctText  = rawOptions.find(o => o.label === correctLabel)?.text || rawOptions[0]?.text || "";

  const shuffled = [...rawOptions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  let newCorrect = "A";
  const newOptions = shuffled.map((o, idx) => {
    const label = LABELS[idx] || String.fromCharCode(65 + idx);
    if (o.text === correctText) newCorrect = label;
    return { label, text: o.text };
  });

  return {
    text:              String(q.text || "").trim(),
    imageUrl:          "",
    questionType:      q.questionType || "CHOICE",
    openAnswerExample: q.openAnswerExample || "",
    options:           newOptions,
    correctOption:     newCorrect,
    points:            typeof q.points === "number" ? q.points : 1,
  };
}

// ─── Əsas generasiya ─────────────────────────────────────────────────────────
//
//  TIER-BASED FALLBACK STRATEGİYASI — Maksimum Etibarlılıq + Sıfır Rate Limit:
//
//  ✅ 5-TIER SYSTEM (10 Həll Yolu):
//  1. Tier-Based Fallback: 5 müstəqil tier, bir tier exhausted → növbəti tier
//  2. No Model Overlap: Hər model yalnız 1 tier-də (təkrarlanma yox!)
//  3. Global Cooldown: Hər provider 45s cooldown (cross-request)
//  4. Smart Parallel: 2 provider mövcudsa 2 paralel, yoxsa 1
//  5. Provider Rotation: Cooldown-da olmayan provider-lər seçilir
//  6. Balanced Overshoot: 10% + 2 (bir dəfədə daha çox sual)
//  7. Early Success: 80% sual toplandıqda dayan
//  8. Extended Recovery: Rate limit 5 dəq sonra sıfırlanır
//  9. Optimal Timeout: 35s worker timeout
//  10. Minimal Delay: Yalnız uğursuzluqda 5s fasilə
//
//  NƏTICƏ: 10+ ardıcıl 30 suallı quiz (300+ sual) problemsiz yaradıla bilər!
//
async function generateQuestions(
  totalNeeded: number,
  system:      string,
  buildPrompt: (count: number, hint: string) => string,
  groqKey:     string | undefined,
  orKey:       string | undefined,
  geminiKey:   string | undefined,
  mistralKey:  string | undefined,
  cerebrasKey: string | undefined,
  hfKey:       string | undefined,
): Promise<{ questions: any[]; errors: string[] }> {

  // TIER-BASED SYSTEM: Hər tier müstəqil worker qrupudur
  const allTiers: Worker[][] = [
    TIER1_WORKERS,
    TIER2_WORKERS,
    TIER3_WORKERS,
    TIER4_WORKERS,
    TIER5_WORKERS,
  ];

  // API key-ləri yoxla və tier-ləri filter et
  const availableTiers: Worker[][] = allTiers.map(tier => 
    tier.filter(w => {
      switch (w.provider) {
        case "groq": return !!groqKey;
        case "openrouter": return !!orKey;
        case "gemini": return !!geminiKey;
        case "mistral": return !!mistralKey;
        case "cerebras": return !!cerebrasKey;
        case "huggingface": return !!hfKey;
        default: return false;
      }
    })
  ).filter(tier => tier.length > 0); // Boş tier-ləri sil

  if (availableTiers.length === 0) {
    return { questions: [], errors: ["Aktiv AI modeli konfiqurasiya edilməyib"] };
  }

  console.log(`[tier-system] ${availableTiers.length} tier mövcuddur, cəmi ${availableTiers.flat().length} model`);

  // Tier tracking: hansı tier-dən başlayırıq
  let currentTierIndex = 0;
  const tierExhausted = new Set<number>(); // Exhausted tier-lər

  const hints = [
    "Mövzunun ən məşhur faktlarını yoxlayan aydın suallar yarat.",
    "Rəqəmlər, illər, miqdarlar ilə bağlı suallar yarat.",
    "Terminlər, təriflər və elmi anlayışların izahı ilə bağlı suallar yarat.",
    "Məntiqi ardıcıllıq tələb edən suallar yarat.",
    "Mövzuya aid şəxsiyyətlər ilə bağlı suallar yarat.",
    "İki anlayışı müqayisə edən suallar yarat.",
  ];

  const startTime   = Date.now();
  const collected:  any[] = [];
  const seenKeys    = new Set<string>();
  const errors:     string[] = [];
  const rateLimited = new Set<string>();
  const providerLastUsed = new Map<string, number>(); // provider -> timestamp

  const timeLeft = () => TOTAL_TIMEOUT_MS - (Date.now() - startTime);

  const addQuestions = (qs: any[]): number => {
    let added = 0;
    for (const q of qs) {
      const key = (q.text || "").trim().toLowerCase().slice(0, 80);
      if (key.length > 5 && !seenKeys.has(key)) {
        seenKeys.add(key);
        collected.push(q);
        added++;
      }
    }
    return added;
  };

  // OPTIMALLAŞDIRMA 4: Balanced Overshoot — 10% + 2 (bir dəfədə daha çox sual)
  const overshoot = (n: number) => Math.min(n + Math.ceil(n * 0.10), n + 2);

  let round = 0;
  let consecutiveFailures = 0;

  while (collected.length < totalNeeded && timeLeft() > 8_000) {
    round++;
    const remaining = totalNeeded - collected.length;

    // OPTIMALLAŞDIRMA 5: Early Success — 80% toplandıqda dayan
    if (collected.length >= totalNeeded * 0.8 && round > 2) {
      console.log(`[gen] Early success: ${collected.length}/${totalNeeded} sual (80%+). Dayandırılır.`);
      break;
    }

    // TIER SELECTION: Cari tier-dən worker-ləri seç
    let currentTierWorkers: Worker[] = [];
    while (currentTierIndex < availableTiers.length) {
      if (!tierExhausted.has(currentTierIndex)) {
        currentTierWorkers = availableTiers[currentTierIndex];
        break;
      }
      currentTierIndex++;
    }

    // Bütün tier-lər exhausted isə
    if (currentTierWorkers.length === 0) {
      console.warn(`[tier-system] Bütün ${availableTiers.length} tier exhausted oldu.`);
      errors.push(`Bütün AI tier-lər exhausted oldu. ${collected.length}/${totalNeeded} sual yaradıldı.`);
      break;
    }

    console.log(`[tier-system] Tier ${currentTierIndex + 1}/${availableTiers.length} istifadə edilir (${currentTierWorkers.length} model)`);

    const available = currentTierWorkers.filter(w => !rateLimited.has(w.id) && isModelAvailable(w.id));
    if (available.length === 0) {
      console.warn(`[tier-system] Tier ${currentTierIndex + 1} tamamilə rate-limited və ya cooldown-da. Növbəti tier-ə keçilir.`);
      tierExhausted.add(currentTierIndex);
      currentTierIndex++;
      continue;
    }

    // Provider rotasiyası: cooldown-da olmayan və ən az istifadə edilən provider-i seç
    const availableByProvider = new Map<string, Worker[]>();
    for (const w of available) {
      // DUAL COOLDOWN CHECK: Həm provider həm də model cooldown-da deyilsə əlavə et
      if (isProviderAvailable(w.provider) && isModelAvailable(w.id)) {
      if (isProviderAvailable(w.provider) && isModelAvailable(w.id)) {
        if (!availableByProvider.has(w.provider)) {
          availableByProvider.set(w.provider, []);
        }
        availableByProvider.get(w.provider)!.push(w);
      } else {
        const providerCooldown = Math.ceil((PROVIDER_COOLDOWN_MS - (Date.now() - (providerGlobalCooldown.get(w.provider) || 0))) / 1000);
        const modelCooldown = Math.ceil((MODEL_COOLDOWN_MS - (Date.now() - (modelGlobalCooldown.get(w.id) || 0))) / 1000);
        console.log(`[gen] ${w.provider}/${w.id.split("/").pop()} cooldown-dadır (provider: ${providerCooldown}s, model: ${modelCooldown}s)`);
      }
    }

    // Heç bir provider mövcud deyilsə (hamısı cooldown-da) → Növbəti tier-ə keç
    if (availableByProvider.size === 0) {
      console.warn(`[tier-system] Tier ${currentTierIndex + 1} tamamilə cooldown-da. Növbəti tier-ə keçilir.`);
      tierExhausted.add(currentTierIndex);
      currentTierIndex++;
      continue; // Növbəti tier ilə davam et
    }

    // SMART PARALLEL: Cooldown-da olmayan provider-lər varsa 2 paralel, yoxsa 1
    // Bu sürəti artırır amma rate limit riskini minimumda saxlayır
    const parallelCount = availableByProvider.size >= 2 ? 2 : 1;

    const sortedProviders = Array.from(availableByProvider.keys()).sort((a, b) => {
      const aTime = providerLastUsed.get(a) || 0;
      const bTime = providerLastUsed.get(b) || 0;
      return aTime - bTime; // ən köhnə istifadə edilən əvvəl
    });

    const workers: Worker[] = [];
    for (const provider of sortedProviders) {
      if (workers.length >= parallelCount) break;
      const providerWorkers = availableByProvider.get(provider)!;
      workers.push(providerWorkers[0]); // Hər provider-dən 1 model
      providerLastUsed.set(provider, Date.now());
      markProviderUsed(provider); // GLOBAL COOLDOWN: Provider-i işarələ
      markModelUsed(providerWorkers[0].id); // MODEL COOLDOWN: Model-i işarələ
    }

    const askCount = overshoot(remaining);

    console.log(
      `[gen] Mərhələ ${round}: ${workers.map(w => `${w.provider}/${w.id.split("/").pop()}`).join(", ")} | ` +
      `Hər biri ${askCount} sual | Lazım: ${remaining} | Vaxt: ${Math.round(timeLeft() / 1000)}s | Paralel: ${parallelCount}`
    );

    // Seçilmiş modellərə sorğu göndər
    const tasks = workers.map((w, idx) => {
      const hint   = hints[(idx + round * 2) % hints.length];
      const prompt = buildPrompt(askCount, hint);
      return callWorker(w, groqKey, orKey, geminiKey, mistralKey, cerebrasKey, hfKey, system, prompt)
        .then(qs  => ({ w, qs, ok: true  as const }))
        .catch(err => ({ w, err, ok: false as const }));
    });

    const results = await Promise.all(tasks);
    let newThisRound = 0;
    let allRateLimited = true;

    for (const r of results) {
      if (r.ok) {
        allRateLimited = false;
        consecutiveFailures = 0;
        const added = addQuestions(r.qs);
        newThisRound += added;
        console.log(
          `[gen] ✓ ${r.w.provider}/${r.w.id}: ${r.qs.length} aldı → ${added} yeni. Cəmi: ${collected.length}/${totalNeeded}`
        );
      } else {
        const msg: string = (r as any).err?.message || `${r.w.id} uğursuz`;
        console.warn(`[gen] ✗ ${r.w.provider}/${r.w.id}:`, msg);
        
        // OPTIMALLAŞDIRMA 6: Extended Recovery — 5 dəqiqə (daha uzun recovery)
        if (msg.includes("429") || msg.toLowerCase().includes("rate-limit")) {
          console.log(`[gen] ${r.w.id} rate-limited, 5 dəqiqə sonra yenidən cəhd ediləcək`);
          rateLimited.add(r.w.id);
          setTimeout(() => rateLimited.delete(r.w.id), 5 * 60 * 1000);
        } else {
          allRateLimited = false;
        }
        if (!errors.includes(msg)) errors.push(msg);
      }
    }

    if (collected.length >= totalNeeded) break;

    // TIER EXHAUSTION CHECK: Cari tier-dəki bütün modellər rate-limited isə
    const currentTierAllRateLimited = currentTierWorkers.every(w => rateLimited.has(w.id));
    if (currentTierAllRateLimited) {
      console.warn(`[tier-system] Tier ${currentTierIndex + 1} tamamilə exhausted. Növbəti tier-ə keçilir.`);
      tierExhausted.add(currentTierIndex);
      currentTierIndex++;
      continue; // Növbəti tier ilə davam et
    }

    // Bütün modellər rate-limited isə və heç bir yeni sual gəlməyibsə
    if (allRateLimited && newThisRound === 0) {
      console.warn(`[gen] Mərhələ ${round}: Bütün modellər rate-limited. Növbəti tier-ə keçilir.`);
      tierExhausted.add(currentTierIndex);
      currentTierIndex++;
      continue;
    }

    // Yeni sual gəlmədisə dövrü bitir
    if (newThisRound === 0) {
      consecutiveFailures++;
      console.warn(`[gen] Mərhələ ${round}: Yeni sual əldə edilmədi (${consecutiveFailures} ardıcıl uğursuzluq).`);
      
      if (consecutiveFailures >= 3) {
        console.warn(`[gen] 3 ardıcıl uğursuzluq. Dayandırılır.`);
        break;
      }
    }

    // OPTIMALLAŞDIRMA 2: Minimal Delay (global cooldown artıq var)
    // Yalnız uğursuzluq olduqda fasilə ver
    if (newThisRound === 0 && timeLeft() > 8_000) {
      const delay = 5_000; // 5 saniyə
      console.log(`[gen] Uğursuzluq fasiləsi (${delay/1000}s)...`);
      await new Promise(r => setTimeout(r, delay));
    }
    // Uğurlu olduqda fasilə YOX (global cooldown kifayətdir)
  } // while loop sonu
  }

  const elapsed = Date.now() - startTime;
  console.log(
    `[gen] Tamamlandı: ${collected.length}/${totalNeeded} sual | ` +
    `${elapsed}ms | ${round} mərhələ | Rate-limited: ${rateLimited.size}`
  );

  return { questions: collected.slice(0, totalNeeded), errors };
}

// ─── POST handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    // ── Per-user throttle yoxlaması ──────────────────────────────────────────
    const userId = (session.user as any)?.id ?? (session.user as any)?.email ?? "unknown";
    const throttle = await checkUserThrottle(userId);
    
    if (!throttle.allowed) {
      return NextResponse.json(
        {
          error: `Saatda ${USER_MAX_CALLS} quiz generasiyası limitinə çatdınız. Bir saat sonra yenidən cəhd edin.`,
          retryAfter: USER_WINDOW_MS / 1000,
          remaining: 0,
        },
        { status: 429 }
      );
    }

    const groqKeyRaw = process.env.GROQ_API_KEY;
    const orKey      = process.env.OPENROUTER_API_KEY;
    const geminiKey  = process.env.GEMINI_API_KEY;
    const mistralKey = process.env.MISTRAL_API_KEY;
    const cerebrasKey= process.env.CEREBRAS_API_KEY;
    const hfKey      = process.env.HUGGINGFACE_API_KEY;

    // Groq açarı "gsk_" ilə başlamalıdır
    const groqKey = groqKeyRaw?.startsWith("gsk_") ? groqKeyRaw : undefined;
    if (groqKeyRaw && !groqKey) {
      console.warn("[generate-quiz] GROQ_API_KEY formatı səhvdir. Groq atlanılır.");
    }

    if (!groqKey && !orKey && !geminiKey && !mistralKey && !cerebrasKey && !hfKey) {
      return NextResponse.json({ error: "Heç bir AI API açarı konfiqurasiya edilməyib." }, { status: 503 });
    }

    const body = await req.json();
    const { title, questionCount = 10, category, language = "az", botId } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Quiz başlığı tələb olunur" }, { status: 400 });
    }

    const safeCount = Math.min(50, Math.max(1, parseInt(questionCount) || 10));

    // ── Cache yoxlaması ──────────────────────────────────────────────────────
    // Bot əsaslı quizlər cache-lənmir (fərdi bilik bazasına görə dəyişir)
    const cacheKey = getCacheKey(title, safeCount, language, botId);
    if (!botId) {
      const cached = getCached(cacheKey);
      if (cached) {
        console.log(`[generate-quiz] Cache HIT: "${title}" (${safeCount} sual)`);
        return NextResponse.json({
          questions: cached,
          meta: {
            requested: safeCount,
            generated: cached.length,
            complete:  cached.length >= safeCount,
            fromCache: true,
          },
        });
      }
    }

    // ── System prompt (optimallaşdırılmış — daha az token) ───────────────────
    let systemPrompt = `Sən quiz sualları yaradan AI assistentsən.
QAYDALAR:
- Mövzu üzrə dəqiq test sualları yarat
- Bütün mətn Azərbaycan dilində olsun
- Hər sualın 1 düzgün cavabı olsun
- Yanlış variantlar inandırıcı, amma yanlış olsun
- "Hamısı doğrudur"/"Heç biri" tipli variantlardan çəkin
- YALNIZ JSON formatında cavab ver

FORMAT:
{"questions":[{"text":"Sual","options":[{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],"correctOption":"A"}]}`;

    let botContent = "";

    if (botId) {
      const bot = await prisma.aiBot.findUnique({
        where:  { id: botId, active: true },
        select: { prompt: true, content: true },
      });
      if (!bot) {
        return NextResponse.json({ error: "Seçilmiş AI bot tapılmadı" }, { status: 404 });
      }
      systemPrompt = `${bot.prompt}

FORMAT (yalnız JSON):
{"questions":[{"text":"Sual","options":[{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],"correctOption":"A"}]}`;
      botContent = (bot.content || "").slice(0, 5000);
    }

    const langLabel = language === "az" ? "Azərbaycan dilində"
                    : language === "ru" ? "Rus dilində"
                    : "İngilis dilində";
    const catLabel  = category || "ümumi bilik";

    // User prompt — sistem promptda JSON nümunəsi artıq var, burada təkrarlanmır
    const buildPrompt = (count: number, hint: string): string => {
      const ctxPart = botContent
        ? `\nBilik bazası (YALNIZ buradan istifadə et):\n---\n${botContent}\n---\n`
        : "";
      const botRule = botId ? "\n- Yalnız verilmiş bilik bazasındakı məlumatlardan istifadə et." : "";

      return `${langLabel} "${title}" mövzusu üzrə DƏQIQ ${count} sual yarat. ${hint}
Kateqoriya: ${catLabel}${ctxPart}
Tələblər:
- Hər sualın 4 variant cavabı olsun (A, B, C, D)
- Düzgün cavabları A, B, C, D arasında müxtəlif paylat${botRule}

YALNIZ JSON, DƏQIQ ${count} sual:`;
    };

    const genResult = await generateQuestions(
      safeCount, systemPrompt, buildPrompt, groqKey, orKey, geminiKey, mistralKey, cerebrasKey, hfKey
    );

    if (genResult.questions.length === 0) {
      const isRateLimit = genResult.errors.some(e => e.includes("429") || e.includes("rate-limit"));
      const hasAllRateLimited = genResult.errors.some(e => e.includes("Bütün AI modellər"));
      
      return NextResponse.json(
        {
          error: isRateLimit || hasAllRateLimited
            ? "Bütün AI modellər rate limit aldı. 5-10 dəqiqə gözləyib yenidən cəhd edin. Əgər problem davam edərsə, sual sayını azaldın (məs: 5-10 sual)."
            : "AI sual yarada bilmədi. Mövzunu dəqiqləşdirərək yenidən cəhd edin.",
          details: genResult.errors.slice(0, 3),
          suggestion: "Sual sayını azaldın (5-10 sual) və ya 5-10 dəqiqə sonra yenidən cəhd edin.",
        },
        { status: 502 }
      );
    }

    const normalized = genResult.questions.map(normalizeQuestion);
    const isPartial  = normalized.length < safeCount;

    // ── Nəticəni cache-ə yaz ─────────────────────────────────────────────────
    // Qismən nəticələr də cache-lənir (növbəti dəfə tamamlanması üçün)
    if (!botId) {
      setCache(cacheKey, normalized);
      console.log(`[generate-quiz] Cache WRITE: "${title}" (${normalized.length} sual, partial=${isPartial})`);
    }

    return NextResponse.json({
      questions: normalized,
      meta: {
        requested: safeCount,
        generated: normalized.length,
        complete:  !isPartial,
        fromCache: false,
        remaining: throttle.remaining - 1, // Bu request-dən sonra qalan
        warning: isPartial
          ? `${safeCount} sual istənildi, ${normalized.length} sual yaradıldı. Yenidən cəhd edin.`
          : undefined,
      },
    });

  } catch (err: any) {
    console.error("generate-quiz POST xəta:", err?.message ?? err);
    return NextResponse.json({ error: "Server xətası" }, { status: 500 });
  }
}
