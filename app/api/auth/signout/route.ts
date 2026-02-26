export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  // Get the origin from the request headers, fallback to localhost for development
  const origin = req.headers.get("origin") || "http://localhost:3000";
  
  // Redirect to /access using the request's origin
  const res = NextResponse.redirect(new URL("/access", origin));
  const cookieStore = await cookies();
  if (cookieStore.get("sid")) res.headers.set("Set-Cookie", `sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return res;
}
