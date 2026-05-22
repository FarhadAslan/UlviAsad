import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 55;

const PROMPT_SYS = "Sən quiz sualları yaradan AI assistentsən. Cavabı YALNIZ JSON formatında ver.";
const PROMPT_USER = (n: number) =>
  `Azərbaycan dilində "Coğrafiya" mövzusu üzrə DƏQIQ ${n} ədəd test sualı yarat.\nCavabı YALNIZ JSON formatında ver:\n{"questions":[{"text":"Sual","options":[{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],"correctOption":"A"}]}`;

async function testModel(
  endpoint: string,
  apiKey: string,
  model: string,
  jsonMode: boolean,
  maxTokens: number,
  count: number,
  extraHeaders: Record<string, string> = {},
) {
  const body: any = {
    model,
    messages: [
      { role: "system", content: PROMPT_SYS },
      { role: "user",   content: PROMPT_USER(count) },
    ],
    temperature: 0.7,
    max_tokens: maxTokens,
  };
  if (jsonMode) body.response_format = { type: "json_object" };

  const start = Date.now();
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}`, ...extraHeaders },
      body: JSON.stringify(body),
    });
    const elapsed = Date.now() - start;
    const data = await res.json().catch(() => null);
    const content: string = data?.choices?.[0]?.message?.content || "";

    let qCount = 0;
    try {
      const t = content.replace(/^```json\s*/im, "").replace(/\s*```\s*$/im, "").trim();
      const p = JSON.parse(t);
      qCount = p?.questions?.length || (Array.isArray(p) ? p.length : 0);
    } catch { qCount = -1; }

    return {
      model,
      status: res.status,
      ok: res.ok,
      elapsed_ms: elapsed,
      questions_parsed: qCount,
      error: data?.error?.message || null,
    };
  } catch (e: any) {
    return { model, error: e?.message, elapsed_ms: Date.now() - start };
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
    const results: any = { env: { groq: !!groqKey, openrouter: !!orKey } };

    // Groq test
    if (groqKey) {
      results.groq = await testModel(
        "https://api.groq.com/openai/v1/chat/completions",
        groqKey, "llama-3.3-70b-versatile", true, 8000, 5,
      );
      await new Promise(r => setTimeout(r, 1000));
    }

    // OpenRouter tests
    if (orKey) {
      const orHeaders = { "HTTP-Referer": "https://ulvi-asad-hnez.vercel.app", "X-Title": "Muellim Portal" };
      const orModels = [
        "meta-llama/llama-3.3-70b-instruct:free",
        "openai/gpt-oss-120b:free",
        "openai/gpt-oss-20b:free",
        "qwen/qwen3-coder:free",
        "z-ai/glm-4.5-air:free",
      ];
      results.openrouter = {};
      for (const m of orModels) {
        results.openrouter[m] = await testModel(
          "https://openrouter.ai/api/v1/chat/completions",
          orKey, m, false, 8000, 5, orHeaders,
        );
        await new Promise(r => setTimeout(r, 300));
      }
    }

    return NextResponse.json(results);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
