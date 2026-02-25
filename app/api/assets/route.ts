export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/auth";

export async function GET() {
  const sess = await getSession();

  if (!sess) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const items = await prisma.asset.findMany({
    where: { userId: sess.user.id },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true,
      mime: true,
      size: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    items: items.map((a: {
      id: string;
      mime: string | null;
      size: number | null;
      createdAt: Date;
    }) => ({
      id: a.id,
      url: `/api/assets/${a.id}`,
      mime: a.mime,
      size: a.size,
      createdAt: a.createdAt,
    })),
  });
}