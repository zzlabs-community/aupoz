export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/prisma";
import { scryptSync } from "node:crypto";

const schema = z.object({ email: z.string().email(), password: z.string().min(8) });

export async function POST(req: Request) {
  const body = await req.json().catch(()=>null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
  const [salt, stored] = user.passwordHash.split(":");
  const hash = scryptSync(password, salt, 64).toString("hex");
  if (hash !== stored) return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
  const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const session = await prisma.session.create({ data: { userId: user.id, token, expiresAt: new Date(Date.now() + 1000*60*60*24*30) } });
  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.headers.set("Set-Cookie", `sid=${session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60*60*24*30}`);
  return res;
}
