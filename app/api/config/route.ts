export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function GET() {
  const ai = process.env.OPENAI_API_KEY ? "real" : "mock";
  return NextResponse.json({ ai }, { status: 200 });
}

