export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/auth";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sess = await getSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const ev = await prisma.calendarEvent.findFirst({ where: { id, userId: sess.user.id }, include: { attachments: { include: { asset: true } } } });
  if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ id: ev.id, date: ev.date, time: ev.time, title: ev.title, caption: ev.caption, notes: ev.notes, color: ev.color, platform: ev.platform, status: ev.status, linkUrl: ev.linkUrl, hashtags: ev.hashtags, labels: ev.labels, assets: ev.attachments.map(a=> ({ id: a.assetId, url: `/api/assets/${a.assetId}` })) });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sess = await getSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const json = await req.json().catch(()=>null) as { title?: string, caption?: string, notes?: string, color?: string, date?: string, time?: string, platform?: string, status?: string, linkUrl?: string, hashtags?: string, labels?: string[], assetIds?: string[] } | null;
  if (!json) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const data: any = {};
  if (typeof json.title === 'string') data.title = json.title;
  if (typeof json.caption === 'string') data.caption = json.caption;
  if (typeof json.notes === 'string') data.notes = json.notes;
  if (typeof json.color === 'string') data.color = json.color;
  if (typeof json.date === 'string') data.date = new Date(json.date);
  if (typeof json.time === 'string') data.time = json.time;
  if (typeof json.platform === 'string') data.platform = json.platform as any;
  if (typeof json.status === 'string') data.status = json.status as any;
  if (typeof json.linkUrl === 'string') data.linkUrl = json.linkUrl;
  if (typeof json.hashtags === 'string') data.hashtags = json.hashtags;
  if (Array.isArray(json.labels)) data.labels = json.labels;
  const { id } = await ctx.params;
  const updated = await prisma.$transaction(async (tx)=>{
    const ev = await tx.calendarEvent.update({ where: { id }, data });
    if (Array.isArray(json.assetIds)) {
      await tx.calendarEventAsset.deleteMany({ where: { eventId: id } });
      if (json.assetIds.length) {
        await tx.calendarEventAsset.createMany({ data: json.assetIds.map(aid=> ({ eventId: id, assetId: aid })) });
      }
    }
    return ev;
  });
  return NextResponse.json({ ok: true, id: updated.id });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sess = await getSession();
  if (!sess) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  await prisma.calendarEvent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
