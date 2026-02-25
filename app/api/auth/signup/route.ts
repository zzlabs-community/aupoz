export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/prisma";
import { randomBytes, scryptSync, randomUUID } from "node:crypto";

const schema = z.object({ email: z.string().email(), password: z.string().min(8), name: z.string().optional() });

export async function POST(req: Request) {
  const body = await req.json().catch(()=>null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { email, password, name } = parsed.data;
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  try {
    // Raw SQL to avoid client model mismatch issues
    const userId = randomUUID();
    const token = randomBytes(24).toString("hex");
    const expires = new Date(Date.now() + 1000*60*60*24*30);
    await prisma.$executeRawUnsafe(
      'INSERT INTO "User" ("id","email","name","passwordHash","createdAt") VALUES ($1,$2,$3,$4,now())',
      userId,
      email,
      name ?? null,
      `${salt}:${hash}`,
    );
    await prisma.$executeRawUnsafe(
      'INSERT INTO "Session" ("id","userId","token","createdAt","expiresAt") VALUES ($1,$2,$3,now(),$4)',
      randomUUID(),
      userId,
      token,
      expires,
    );
    const res = NextResponse.json({ ok: true }, { status: 200 });
    res.headers.set("Set-Cookie", `sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60*60*24*30}`);
    return res;
  } catch (e: any) {
    console.error('signup error:', e);
    // Handle duplicate key error (PostgreSQL error code 23505 or Prisma error P2002/P2010)
    const errorMessage = String(e?.message || '');
    const errorCode = String(e?.code || '');
    if (errorCode === "P2002" || errorCode === "P2010" || errorMessage.includes('duplicate key value violates unique constraint')) {
      return NextResponse.json({ error: "Email ya registrado" }, { status: 409 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
