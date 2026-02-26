export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://aupoz.vercel.app";
  const res = NextResponse.redirect(new URL("/access", baseUrl));
  const cookieStore = await cookies();
  if (cookieStore.get("sid")) res.headers.set("Set-Cookie", `sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return res;
}
