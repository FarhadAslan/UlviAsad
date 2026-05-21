import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 55;

async function callGroq(apiKey: string, model: string, jsonMode: boolean, count: number, maxTokens: number) {
  const body: any = {
    model,
    messages: [
      { role: "system", content: "Sən quiz sualları yaradan AI assistentsən. Cavabı YALNIZ JSON formatında ver." },
      { role: "user", content: `Azərbaycan dilində "Coğrafiya" mövzusu üzrə DƏQIQ ${count} ədəd test sualı yarat.\n\nCavabı YALNIZ JSON formatında ver, ${count} sual ilə:\n{"questions":[{"text":"Sual mətni","options":[{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],"correctOption":"A"}]}` },
    ],
    temperature: 0.7,
    max_tokens: maxTokens,
  };
  if (jsonMode) body.response_format = { type: "json_object" };

  const start = Date.now();
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
    const elapsed = Date.now() - start;
    const data = await res.json().catch(() => null);
    const content = data?.choices?.[0]?.message?.content || "";
    
    // Count questions in response
    let qCount = 0;
    try {
      const parsed = JSON.parse(content.replace(/^```json\s*/im,"").replace(/\s*```\s*$/im,"").trim());
      qCount = parsed?.questions?.length || 0;
    } catch { qCount = -1; }

    return {
      model,
      status: res.status,
      ok: res.ok,
      elapsed_ms: elapsed,
      questions_parsed: qCount,
      content_length: content.length,
      error: data?.error?.message || null,
      content_preview: content.slice(0, 200),
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
    if (!groqKey) return NextResponse.json({ error: "GROQ_API_KEY yoxdur" });

    // Test 1: 10 sual — llama-3.3-70b, max_tokens=8000
    const t10 = await callGroq(groqKey, "llama-3.3-70b-versatile", true, 10, 8000);
    
    await new Promise(r => setTimeout(r, 1000));
    
    // Test 2: 27 sual — llama-3.3-70b, max_tokens=8000
    const t27 = await callGroq(groqKey, "llama-3.3-70b-versatile", true, 27, 8000);

    await new Promise(r => setTimeout(r, 1000));

    // Test 3: llama-3.1-8b ilə 10 sual, max_tokens=4000
    const t25b = await callGroq(groqKey, "llama-3.1-8b-instant", false, 10, 4000);

    return NextResponse.json({
      test_10q: t10,
      test_27q: t27,
      test_25q_8b: t25b,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
