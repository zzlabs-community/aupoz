export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/auth";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export async function GET(req: Request) {
  const sess = await getSession();
  if (!sess)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const dFrom = from ? new Date(from) : startOfDay(new Date());
  const dTo = to
    ? new Date(to)
    : endOfDay(
        new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
      );

  const items = await prisma.calendarEvent.findMany({
    where: {
      userId: sess.user.id,
      date: { gte: dFrom, lte: dTo },
    },
    orderBy: { date: "asc" },
    include: {
      attachments: {
        include: {
          asset: { select: { id: true } },
        },
      },
    },
  });

  return NextResponse.json({
    items: items.map((e: any) => ({
      ...e,
      assets: e.attachments.map((a: { assetId: string }) => ({
        id: a.assetId,
        url: `/api/assets/${a.assetId}`,
      })),
    })),
  });
}

export async function POST(req: Request) {
  const sess = await getSession();
  if (!sess)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | {
        date: string;
        title: string;
        notes?: string;
        color?: string;
        assetIds?: string[];
      }
    | null;

  if (!body?.date || !body?.title)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const ev = await prisma.calendarEvent.create({
    data: {
      userId: sess.user.id,
      date: new Date(body.date),
      title: body.title,
      notes: body.notes || null,
      color: body.color || "sky",
      attachments: body.assetIds?.length
        ? {
            createMany: {
              data: body.assetIds.map((id: string) => ({
                assetId: id,
              })),
            },
          }
        : undefined,
    },
  });

  return NextResponse.json({ id: ev.id }, { status: 201 });
}

export async function DELETE(req: Request) {
  const sess = await getSession();
  if (!sess)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id)
    return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await prisma.calendarEvent.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}