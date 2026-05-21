import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Groq-u birbaşa test et — json_object olmadan
async function testGroq(apiKey: string) {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: 'Return exactly this JSON and nothing else: {"questions":[{"text":"Test?","options":[{"label":"A","text":"Yes"},{"label":"B","text":"No"},{"label":"C","text":"Maybe"},{"label":"D","text":"Never"}],"correctOption":"A"}]}' }],
        max_tokens: 300,
        response_format: { type: "json_object" },
      }),
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, content: data?.choices?.[0]?.message?.content?.slice(0, 150), error: data?.error?.message };
  } catch (e: any) {
    return { error: e?.message };
  }
}

// OpenRouter-i birbaşa test et
async function testOpenRouter(apiKey: string) {
  const models = [
    "meta-llama/llama-3.3-70b-instruct:free",
    "deepseek/deepseek-chat-v3-0324:free",
    "mistralai/mistral-small-3.1-24b-instruct:free",
  ];
  const results: any = {};
  for (const model of models) {
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
          model,
          messages: [{ role: "user", content: 'Say "ok" in JSON: {"msg":"ok"}' }],
          max_tokens: 30,
        }),
      });
      const data = await res.json().catch(() => null);
      results[model] = { status: res.status, ok: res.ok, content: data?.choices?.[0]?.message?.content?.slice(0, 80), error: data?.error?.message };
    } catch (e: any) {
      results[model] = { error: e?.message };
    }
  }
  return results;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    const groqKey = process.env.GROQ_API_KEY;
    const orKey   = process.env.OPENROUTER_API_KEY;

    const results: any = {
      env: {
        GROQ_API_KEY:       groqKey ? `SET (${groqKey.slice(0, 8)}...)` : "NOT SET",
        OPENROUTER_API_KEY: orKey   ? `SET (${orKey.slice(0, 8)}...)`   : "NOT SET",
      },
    };

    if (groqKey) {
      results.groq = await testGroq(groqKey);
    }
    if (orKey) {
      results.openrouter = await testOpenRouter(orKey);
    }

    return NextResponse.json(results);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
