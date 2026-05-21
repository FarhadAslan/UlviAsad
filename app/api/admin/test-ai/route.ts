import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Groq-u birbaşa test et
async function testGroq(apiKey: string) {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: 'Return exactly: {"questions":[{"text":"Test?","options":[{"label":"A","text":"Yes"},{"label":"B","text":"No"},{"label":"C","text":"Maybe"},{"label":"D","text":"Never"}],"correctOption":"A"}]}' }],
        max_tokens: 200,
        response_format: { type: "json_object" },
      }),
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, content: data?.choices?.[0]?.message?.content?.slice(0, 100) };
  } catch (e: any) {
    return { error: e?.message };
  }
}

// OpenRouter-i birbaşa test et
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
        model: "meta-llama/llama-3.1-8b-instruct:free",
        messages: [{ role: "user", content: 'Say "hello" in JSON: {"msg":"hello"}' }],
        max_tokens: 50,
      }),
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, content: data?.choices?.[0]?.message?.content?.slice(0, 100), error: data?.error };
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
