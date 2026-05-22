import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    const groqKey = process.env.GROQ_API_KEY;
    const orKey   = process.env.OPENROUTER_API_KEY;

    // Sadəcə env var-ları yoxla, heç bir API çağırışı etmə
    return NextResponse.json({
      env: {
        GROQ_API_KEY:       groqKey ? `SET (${groqKey.slice(0, 8)}...)` : "NOT SET",
        OPENROUTER_API_KEY: orKey   ? `SET (${orKey.slice(0, 8)}...)`   : "NOT SET",
      },
      region: process.env.VERCEL_REGION || "unknown",
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
