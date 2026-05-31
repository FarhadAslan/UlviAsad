import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    const groqKeyRaw = process.env.GROQ_API_KEY;
    const orKey   = process.env.OPENROUTER_API_KEY;
    
    // Groq açarı "gsk_" ilə başlamalıdır
    const groqKey = groqKeyRaw?.startsWith("gsk_") ? groqKeyRaw : undefined;
    
    const results: any = {
      config: {
        groqKeyValid: !!groqKey,
        groqKeyFormat: groqKeyRaw?.slice(0, 4) === "gsk_" ? "✓ Valid" : "✗ Invalid (must start with gsk_)",
        openRouterKeyValid: !!orKey,
        parallelCount: 2,
        overshoot: "8% + 3",
        userMaxCalls: 10,
        cacheEnabled: true,
      }
    };

    // Groq — çox kiçik sorğu (max_tokens=50)
    if (groqKey) {
      const t1 = Date.now();
      try {
        const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqKey}` },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: 'Return this exact JSON: {"ok":true}' }],
            max_tokens: 50,
            response_format: { type: "json_object" },
          }),
          signal: AbortSignal.timeout(10000), // 10s timeout
        });
        const d = await r.json().catch(() => null);
        results.groq = {
          status: r.status,
          ok: r.ok,
          ms: Date.now() - t1,
          content: d?.choices?.[0]?.message?.content?.slice(0, 80),
          error: d?.error?.message?.slice(0, 150),
          rateLimit: r.status === 429 ? "⚠️ Rate limited" : "✓ OK",
        };
      } catch (e: any) {
        results.groq = { error: e?.message, ms: Date.now() - t1 };
      }
    } else {
      results.groq = { error: "Groq API key not configured or invalid format" };
    }

    // OpenRouter — çox kiçik sorğu
    if (orKey) {
      const t2 = Date.now();
      try {
        const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${orKey}`,
            "HTTP-Referer": "https://ulvi-asad-hnez.vercel.app",
            "X-Title": "Muellim Portal",
          },
          body: JSON.stringify({
            model: "meta-llama/llama-4-scout:free",
            messages: [{ role: "user", content: 'Reply with: {"ok":true}' }],
            max_tokens: 50,
          }),
          signal: AbortSignal.timeout(10000),
        });
        const d = await r.json().catch(() => null);
        results.openrouter = {
          status: r.status,
          ok: r.ok,
          ms: Date.now() - t2,
          content: d?.choices?.[0]?.message?.content?.slice(0, 80),
          error: d?.error?.message?.slice(0, 150),
          rateLimit: r.status === 429 ? "⚠️ Rate limited" : "✓ OK",
        };
      } catch (e: any) {
        results.openrouter = { error: e?.message, ms: Date.now() - t2 };
      }
    } else {
      results.openrouter = { error: "OpenRouter API key not configured" };
    }

    return NextResponse.json(results);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
