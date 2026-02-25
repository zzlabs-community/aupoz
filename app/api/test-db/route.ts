export const runtime = "nodejs";

import { prisma } from "@/src/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const companies = await prisma.company.findMany();
  return NextResponse.json(companies);
}
