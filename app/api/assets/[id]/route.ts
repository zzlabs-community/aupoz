export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const headers = new Headers();
  headers.set("Content-Type", asset.mime || "application/octet-stream");
  headers.set("Content-Length", String(asset.size));
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("ETag", `W/\"${asset.sha256}\"`);
  return new NextResponse(asset.bytes as unknown as BodyInit, { status: 200, headers });
}
