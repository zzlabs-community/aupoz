export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getSession } from "@/src/lib/auth";

// Schema for creating a company (replaces workspace)
const CreateCompanySchema = z.object({
  name: z.string().min(2, "name must be at least 2 characters"),
  domain: z.string().min(1, "domain is required"),
});

export async function GET(request: Request) {
  try {
    const sess = await getSession();
    if (!sess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const takeParam = searchParams.get("take");

    let take = 20;
    if (takeParam !== null) {
      const parsed = z.coerce.number().int().min(1).safeParse(takeParam);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid query param 'take'" },
          { status: 400 }
        );
      }
      take = parsed.data;
    }

    // Get companies for current user
    const companies = await prisma.company.findMany({
      where: { userId: sess.user.id },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        brandProfile: true,
        _count: {
          select: {
            posts: true,
            campaigns: true,
            automations: true,
          },
        },
      },
    });
    return NextResponse.json(companies, { status: 200 });
  } catch (err) {
    console.error("GET /api/workspaces error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sess = await getSession();
    if (!sess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = CreateCompanySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, domain } = parsed.data;

    // Check if user already has max 5 companies
    const count = await prisma.company.count({
      where: { userId: sess.user.id },
    });

    if (count >= 5) {
      return NextResponse.json(
        { error: "Maximum of 5 companies per user reached" },
        { status: 400 }
      );
    }

    // Check if domain already exists for this user
    const existing = await prisma.company.findFirst({
      where: { userId: sess.user.id, domain },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Company with this domain already exists" },
        { status: 409 }
      );
    }

    const created = await prisma.company.create({
      data: {
        name,
        domain,
        userId: sess.user.id,
        socialLinks: {},
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Unique constraint violated", details: err.meta },
        { status: 409 }
      );
    }
    console.error("POST /api/workspaces error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
