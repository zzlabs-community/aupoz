export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/auth";
import { encryptToBase64, decryptFromBase64 } from "@/src/lib/crypto";

export async function GET() {
  const sess = await getSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const s = await prisma.userSetting.findFirst({ where: { userId: sess.user.id } });
  if (!s) return NextResponse.json({ provider: "openai", model: "gpt-4o-mini", hasKey: false }, { status: 200 });
  
  const apiKey = decryptFromBase64(s.apiKeyEnc);
  const last4 = apiKey ? apiKey.slice(-4) : null;
  return NextResponse.json({ provider: s.provider, model: s.model, hasKey: !!apiKey, last4 }, { status: 200 });
}

const bodySchema = z.object({ 
  provider: z.string().default("openai"), 
  model: z.string().default("gpt-4o-mini"), 
  apiKey: z.string().optional() 
});

export async function POST(req: Request) {
  const sess = await getSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  
  const { provider, model, apiKey } = parsed.data;
  const data: { provider: string; model: string; apiKeyEnc?: string } = { provider, model };
  if (apiKey && apiKey.trim()) data.apiKeyEnc = encryptToBase64(apiKey.trim());
  
  // Check if exists, then update or create
  const existing = await prisma.userSetting.findFirst({ where: { userId: sess.user.id } });
  if (existing) {
    await prisma.userSetting.update({ where: { id: existing.id }, data });
  } else {
    await prisma.userSetting.create({ 
      data: { 
        userId: sess.user.id, 
        ...data, 
        apiKeyEnc: data.apiKeyEnc ?? encryptToBase64("") 
      } 
    });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
