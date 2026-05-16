import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
    }

    return NextResponse.json({
      GROQ_API_KEY: process.env.GROQ_API_KEY ? `SET (${process.env.GROQ_API_KEY.slice(0, 8)}...)` : "NOT SET",
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ? `SET (${process.env.OPENROUTER_API_KEY.slice(0, 8)}...)` : "NOT SET",
      NODE_ENV: process.env.NODE_ENV,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ? "SET" : "NOT SET",
      DATABASE_URL: process.env.DATABASE_URL ? "SET" : "NOT SET",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
