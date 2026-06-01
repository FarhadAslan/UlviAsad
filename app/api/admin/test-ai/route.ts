import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Groq test
async function testGroq(apiKey: string) {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: 'Say "ok" in JSON: {"msg":"ok"}' }],
        max_tokens: 30,
        response_format: { type: "json_object" },
      }),
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, content: data?.choices?.[0]?.message?.content?.slice(0, 80), error: data?.error?.message };
  } catch (e: any) {
    return { error: e?.message };
  }
}

// OpenRouter test
async function testOpenRouter(apiKey: string) {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://ulvi-asad-hnez.vercel.app",
        "X-Title": "Muellim Portal",
      },
      body: JSON.stringify({
        model: "openrouter/free",
        messages: [{ role: "user", content: 'Say "ok" in JSON: {"msg":"ok"}' }],
        max_tokens: 30,
      }),
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, content: data?.choices?.[0]?.message?.content?.slice(0, 80), error: data?.error?.message };
  } catch (e: any) {
    return { error: e?.message };
  }
}

// Google Gemini test
async function testGemini(apiKey: string) {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Say "ok" in JSON: {"msg":"ok"}' }] }],
          generationConfig: { maxOutputTokens: 30 },
        }),
      }
    );
    const data = await res.json().catch(() => null);
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return { status: res.status, ok: res.ok, content: content?.slice(0, 80), error: data?.error?.message };
  } catch (e: any) {
    return { error: e?.message };
  }
}

// Mistral test
async function testMistral(apiKey: string) {
  try {
    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [{ role: "user", content: 'Say "ok" in JSON: {"msg":"ok"}' }],
        max_tokens: 30,
      }),
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, content: data?.choices?.[0]?.message?.content?.slice(0, 80), error: data?.error?.message };
  } catch (e: any) {
    return { error: e?.message };
  }
}

// Cerebras test
async function testCerebras(apiKey: string) {
  try {
    const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-oss-120b",
        messages: [{ role: "user", content: 'Say "ok" in JSON: {"msg":"ok"}' }],
        max_tokens: 30,
      }),
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, content: data?.choices?.[0]?.message?.content?.slice(0, 80), error: data?.error?.message };
  } catch (e: any) {
    return { error: e?.message };
  }
}

// HuggingFace test
async function testHuggingFace(apiKey: string) {
  try {
    const res = await fetch(
      "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          inputs: 'Say "ok" in JSON: {"msg":"ok"}',
          parameters: { max_new_tokens: 30, return_full_text: false },
        }),
      }
    );
    const data = await res.json().catch(() => null);
    const content = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text;
    return { status: res.status, ok: res.ok, content: content?.slice(0, 80), error: data?.error };
  } catch (e: any) {
    return { error: e?.message };
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    const groqKey    = process.env.GROQ_API_KEY;
    const orKey      = process.env.OPENROUTER_API_KEY;
    const geminiKey  = process.env.GEMINI_API_KEY;
    const mistralKey = process.env.MISTRAL_API_KEY;
    const cerebrasKey= process.env.CEREBRAS_API_KEY;
    const hfKey      = process.env.HUGGINGFACE_API_KEY;

    const results: any = {
      env: {
        GROQ_API_KEY:        groqKey     ? `✅ SET (${groqKey.slice(0, 8)}...)`     : "❌ NOT SET",
        OPENROUTER_API_KEY:  orKey       ? `✅ SET (${orKey.slice(0, 8)}...)`       : "❌ NOT SET",
        GEMINI_API_KEY:      geminiKey   ? `✅ SET (${geminiKey.slice(0, 8)}...)`   : "❌ NOT SET",
        MISTRAL_API_KEY:     mistralKey  ? `✅ SET (${mistralKey.slice(0, 8)}...)`  : "❌ NOT SET",
        CEREBRAS_API_KEY:    cerebrasKey ? `✅ SET (${cerebrasKey.slice(0, 8)}...)` : "❌ NOT SET",
        HUGGINGFACE_API_KEY: hfKey       ? `✅ SET (${hfKey.slice(0, 8)}...)`       : "❌ NOT SET",
      },
      tests: {} as any,
    };

    // Paralel test et
    const [groqRes, orRes, geminiRes, mistralRes, cerebrasRes, hfRes] = await Promise.allSettled([
      groqKey     ? testGroq(groqKey)           : Promise.resolve(null),
      orKey       ? testOpenRouter(orKey)       : Promise.resolve(null),
      geminiKey   ? testGemini(geminiKey)       : Promise.resolve(null),
      mistralKey  ? testMistral(mistralKey)     : Promise.resolve(null),
      cerebrasKey ? testCerebras(cerebrasKey)   : Promise.resolve(null),
      hfKey       ? testHuggingFace(hfKey)      : Promise.resolve(null),
    ]);

    results.tests.groq       = groqRes.status     === "fulfilled" ? groqRes.value     : { error: (groqRes as any).reason?.message };
    results.tests.openrouter = orRes.status       === "fulfilled" ? orRes.value       : { error: (orRes as any).reason?.message };
    results.tests.gemini     = geminiRes.status   === "fulfilled" ? geminiRes.value   : { error: (geminiRes as any).reason?.message };
    results.tests.mistral    = mistralRes.status  === "fulfilled" ? mistralRes.value  : { error: (mistralRes as any).reason?.message };
    results.tests.cerebras   = cerebrasRes.status === "fulfilled" ? cerebrasRes.value : { error: (cerebrasRes as any).reason?.message };
    results.tests.huggingface= hfRes.status       === "fulfilled" ? hfRes.value       : { error: (hfRes as any).reason?.message };

    // Neçə provider aktiv olduğunu say
    const activeCount = Object.values(results.tests).filter((r: any) => r?.ok === true).length;
    results.summary = `${activeCount}/6 provider aktiv və işləyir`;

    return NextResponse.json(results);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
