export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/prisma";

// Validation schemas
const createRuleSchema = z.object({
  companyId: z.string().min(1, "companyId is required"),
  name: z.string().min(1, "name is required"),
  description: z.string().optional(),
  triggerType: z.enum(["new_product", "schedule", "manual", "low_stock", "price_change"]),
  triggerConfig: z.object({}).optional().default({}),
  actionConfig: z.object({}).optional().default({}),
  isActive: z.boolean().optional().default(true),
  priority: z.number().int().optional().default(0),
});

const updateRuleSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  triggerType: z.enum(["new_product", "schedule", "manual", "low_stock", "price_change"]).optional(),
  triggerConfig: z.object({}).optional(),
  actionConfig: z.object({}).optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().optional(),
});

// GET - List automation rules for a company
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const companyId = url.searchParams.get("companyId");
    const isActive = url.searchParams.get("isActive");

    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }

    const where: any = { companyId };
    if (isActive !== null) {
      where.isActive = isActive === "true";
    }

    const rules = await prisma.automationRule.findMany({
      where,
      orderBy: { priority: "desc" },
    });

    return NextResponse.json(rules, { status: 200 });
  } catch (err) {
    console.error("GET /api/automation-rules error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST - Create a new automation rule
export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = createRuleSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ 
        error: "Invalid body", 
        details: parsed.error.flatten() 
      }, { status: 400 });
    }

    const { companyId, ...data } = parsed.data;

    // Verify company exists
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const rule = await prisma.automationRule.create({
      data: {
        ...data,
        companyId,
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (err) {
    console.error("POST /api/automation-rules error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PUT - Update an automation rule
export async function PUT(request: Request) {
  try {
    const json = await request.json();
    const { id, ...updateData } = json;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const parsed = updateRuleSchema.partial().safeParse(updateData);
    if (!parsed.success) {
      return NextResponse.json({ 
        error: "Invalid body", 
        details: parsed.error.flatten() 
      }, { status: 400 });
    }

    const rule = await prisma.automationRule.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json(rule, { status: 200 });
  } catch (err) {
    console.error("PUT /api/automation-rules error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE - Delete an automation rule
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await prisma.automationRule.delete({
      where: { id },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/automation-rules error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PATCH - Execute an automation rule (manual trigger)
export async function PATCH(request: Request) {
  try {
    const json = await request.json();
    const { id, action } = json;

    if (!id || action !== "execute") {
      return NextResponse.json({ error: "id and action=execute required" }, { status: 400 });
    }

    const rule = await prisma.automationRule.findUnique({
      where: { id },
      include: { company: true },
    });

    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    // Execute the rule based on trigger type
    const result = await executeAutomationRule(rule);

    // Update execution stats
    await prisma.automationRule.update({
      where: { id },
      data: {
        lastExecutedAt: new Date(),
        executionCount: { increment: 1 },
      },
    });

    return NextResponse.json({ success: true, result }, { status: 200 });
  } catch (err) {
    console.error("PATCH /api/automation-rules error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Helper function to execute automation rules
async function executeAutomationRule(rule: any) {
  const { triggerType, actionConfig, companyId } = rule;
  
  switch (triggerType) {
    case "manual":
      // For manual triggers, just generate content based on action config
      return await generateContentForRule(companyId, actionConfig);
    
    case "new_product":
      // Check for new products and generate content
      return await handleNewProductTrigger(companyId, actionConfig);
    
    case "schedule":
      // Handle scheduled triggers
      return await handleScheduleTrigger(companyId, actionConfig);
    
    case "low_stock":
    case "price_change":
      // These would need product monitoring logic
      return { message: "Trigger type not yet implemented" };
    
    default:
      return { message: "Unknown trigger type" };
  }
}

async function generateContentForRule(companyId: string, actionConfig: any) {
  // Get company and brand profile
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { brandProfile: true },
  });

  if (!company) {
    throw new Error("Company not found");
  }

  // Get products
  let products: any[] = [];
  if (company.products) {
    try {
      products = typeof company.products === "string" 
        ? JSON.parse(company.products) 
        : company.products;
    } catch {}
  }

  const platforms = actionConfig.platforms || ["instagram"];
  const campaignType = actionConfig.campaignType || "carousel";
  const count = actionConfig.count || 4;

  // Create posts based on action config
  const posts = [];
  for (let i = 0; i < Math.min(count, platforms.length); i++) {
    const post = await prisma.post.create({
      data: {
        title: `Automation - ${new Date().toISOString()}`,
        caption: `Contenido generado automáticamente para ${company.name}`,
        hashtags: ["#Automation", "#Aupoz"],
        imagePrompt: "Professional product photography",
        platform: platforms[i % platforms.length] as any,
        status: "draft",
        companyId,
      },
    });
    posts.push(post);
  }

  return { generated: posts.length, posts };
}

async function handleNewProductTrigger(companyId: string, actionConfig: any) {
  // This would typically check for new products since last run
  return { message: "New product trigger executed" };
}

async function handleScheduleTrigger(companyId: string, actionConfig: any) {
  // This would run scheduled content generation
  return { message: "Schedule trigger executed" };
}
