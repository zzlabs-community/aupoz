export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/auth";

const createSchema = z.object({
  title: z.string().min(1),
  caption: z.string().min(1),
  platform: z.enum(["instagram", "twitter", "linkedin", "facebook", "tiktok", "youtube", "pinterest"]),
  companyId: z.string().min(1),
  imageUrl: z.string().url().optional(),
  imagePrompt: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  scheduledAt: z.string().optional(),
  status: z.enum(["idea", "draft", "scheduled", "published", "archived"]).optional(),
});

export async function GET(request: Request) {
  try {
    const sess = await getSession();
    if (!sess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const companyId = url.searchParams.get("companyId");
    const status = url.searchParams.get("status");
    const take = z.coerce.number().int().min(1).max(100).default(20).parse(url.searchParams.get("take") ?? undefined);

    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }

    // Verify ownership
    const company = await prisma.company.findFirst({
      where: { id: companyId, userId: sess.user.id },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const where: any = { companyId };
    if (status) {
      where.status = status;
    }

    const posts = await prisma.post.findMany({ 
      where, 
      orderBy: { scheduledAt: "desc" }, 
      take,
      include: { campaign: { select: { id: true, name: true } } }
    });

    return NextResponse.json(posts, { status: 200 });
  } catch (err) {
    console.error("GET /api/posts error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sess = await getSession();
    if (!sess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await request.json();
    const parsed = createSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
    }

    const { companyId, scheduledAt, hashtags, ...data } = parsed.data;

    // Verify ownership
    const company = await prisma.company.findFirst({
      where: { id: companyId, userId: sess.user.id },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const created = await prisma.post.create({
      data: {
        ...data,
        companyId,
        hashtags: hashtags || [],
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status: parsed.data.status || "draft",
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("POST /api/posts error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const sess = await getSession();
    if (!sess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await request.json();
    const { id, ...updateData } = json;

    if (!id) {
      return NextResponse.json({ error: "Post ID required" }, { status: 400 });
    }

    // Verify ownership via post
    const existingPost = await prisma.post.findUnique({
      where: { id },
      include: { company: true },
    });

    if (!existingPost || existingPost.company.userId !== sess.user.id) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const updated = await prisma.post.update({
      where: { id },
      data: {
        ...updateData,
        scheduledAt: updateData.scheduledAt ? new Date(updateData.scheduledAt) : undefined,
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    console.error("PUT /api/posts error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const sess = await getSession();
    if (!sess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Post ID required" }, { status: 400 });
    }

    // Verify ownership
    const existingPost = await prisma.post.findUnique({
      where: { id },
      include: { company: true },
    });

    if (!existingPost || existingPost.company.userId !== sess.user.id) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    await prisma.post.delete({ where: { id } });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/posts error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
