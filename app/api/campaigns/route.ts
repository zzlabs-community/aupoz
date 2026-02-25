export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/prisma";

// Zod schemas
const createCampaignSchema = z.object({
  companyId: z.string().min(1, "companyId is required"),
  name: z.string().min(1),
  description: z.string().optional(),
  campaignType: z.enum(["carousel", "single_post", "story", "reel", "video"]).default("single_post"),
  content: z.any(),
  status: z.enum(["idea", "draft", "scheduled", "published", "archived"]).optional().default("draft"),
});

const updateCampaignSchema = createCampaignSchema.partial().omit({ companyId: true });

// GET campaigns
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const companyId = url.searchParams.get("companyId");
    const status = url.searchParams.get("status");

    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }

    const where: any = { companyId };
    if (status) where.status = status;

    const campaigns = await prisma.campaign.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        posts: {
          select: { id: true, scheduledAt: true, status: true },
        },
        _count: {
          select: { posts: true },
        },
      },
    });

    return NextResponse.json(campaigns, { status: 200 });
  } catch (err) {
    console.error("GET /api/campaigns error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST create campaign
export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = createCampaignSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ 
        error: "Invalid body", 
        details: parsed.error.flatten() 
      }, { status: 400 });
    }

    const { companyId, content, ...campaignData } = parsed.data;

    const campaign = await prisma.campaign.create({
      data: {
        ...campaignData,
        companyId,
        content: content as any,
      },
    });

    return NextResponse.json(campaign, { status: 201 });
  } catch (err) {
    console.error("POST /api/campaigns error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PUT update campaign
export async function PUT(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const json = await request.json();
    const parsed = updateCampaignSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ 
        error: "Invalid body", 
        details: parsed.error.flatten() 
      }, { status: 400 });
    }

    const { content, ...updateData } = parsed.data;

    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        ...updateData,
        ...(content !== undefined && { content: content as any }),
      },
    });

    return NextResponse.json(campaign, { status: 200 });
  } catch (err) {
    console.error("PUT /api/campaigns error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE campaign
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await prisma.campaign.delete({
      where: { id },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/campaigns error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
