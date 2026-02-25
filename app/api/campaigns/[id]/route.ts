export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/auth";

const updateCampaignSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  campaignType: z.enum(["carousel", "single_post", "story", "reel", "video"]).optional(),
  content: z.any().optional(),
  status: z.enum(["idea", "draft", "scheduled", "published", "archived"]).optional(),
});

// GET single campaign
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const sess = await getSession();
    if (!sess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;

    const campaign = await prisma.campaign.findFirst({
      where: { 
        id,
        company: { userId: sess.user.id }
      },
      include: {
        company: {
          select: { id: true, name: true, domain: true }
        },
        posts: true,
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json(campaign, { status: 200 });
  } catch (err) {
    console.error("GET /api/campaigns/[id] error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PATCH update campaign
export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const sess = await getSession();
    if (!sess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;

    // Verify ownership
    const existing = await prisma.campaign.findFirst({
      where: { 
        id,
        company: { userId: sess.user.id }
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
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
    console.error("PATCH /api/campaigns/[id] error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE campaign
export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const sess = await getSession();
    if (!sess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;

    // Verify ownership
    const existing = await prisma.campaign.findFirst({
      where: { 
        id,
        company: { userId: sess.user.id }
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    await prisma.campaign.delete({
      where: { id },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/campaigns/[id] error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
