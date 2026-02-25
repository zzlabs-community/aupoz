export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/auth";

export async function GET() {
  const sess = await getSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { user } = sess;
  return NextResponse.json({ id: user.id, email: user.email, name: user.name ?? null }, { status: 200 });
}

