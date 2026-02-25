export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/prisma";

// Validation schemas - more flexible to accept frontend data
const createRuleSchema = z.object({
  companyId: z.string().min(1, "companyId is required"),
  name: z.string().min(1, "name is required"),
  description: z.string().optional(),
  triggerType: z.enum(["new_product", "schedule", "manual", "low_stock", "price_change", "ai_content", "engagement", "trending"]).optional(),
  triggerConfig: z.record(z.string(), z.any()).optional(),
  actionConfig: z.record(z.string(), z.any()).optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().optional(),
});

const updateRuleSchema = z.object({
  id: z.string().min(1, "id is required"),
  name: z.string().optional(),
  description: z.string().optional(),
  triggerType: z.enum(["new_product", "schedule", "manual", "low_stock", "price_change", "ai_content", "engagement", "trending"]).optional(),
  triggerConfig: z.record(z.string(), z.any()).optional(),
  actionConfig: z.record(z.string(), z.any()).optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().optional(),
});

const AI_AUTOMATION_SYSTEM = `Eres un experto en marketing de contenidos para redes sociales y automatización.

Tu tarea es generar contenido automático de alta calidad para campañas de redes sociales.

REGLAS:
1. Genera contenido personalizado basado en el contexto de la empresa
2. Los hooks deben ser atractivos y específicos
3. Incluye hashtags relevantes y CTA efectivos
4. Adapta el tono al estilo de la marca
5. Para carrusel: genera 5-7 slides con estructura: hook, beneficio, prueba, CTA

Output EXACTO en JSON válido:
{
  "posts": [
    {
      "platform": "instagram",
      "caption": "",
      "hashtags": [],
      "cta": "",
      "image_prompt": ""
    }
  ]
}`;

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

export async function POST(request: Request) {
  try {
    const json = await request.json();
    
    // Validate required fields
    if (!json.companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }
    
    // Check if company exists
    const company = await prisma.company.findUnique({ where: { id: json.companyId } });
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Create the rule with flexible data handling
    const ruleData: any = {
      companyId: json.companyId,
      name: json.name || "Nueva regla",
      description: json.description || null,
      triggerType: json.triggerType || "manual",
      triggerConfig: json.triggerConfig || {},
      actionConfig: json.actionConfig || {},
      isActive: json.isActive !== false,
      priority: json.priority || 0,
    };

    const rule = await prisma.automationRule.create({
      data: ruleData,
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (err) {
    console.error("POST /api/automation-rules error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const json = await request.json();
    const { id } = json;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Check if rule exists
    const existingRule = await prisma.automationRule.findUnique({ where: { id } });
    if (!existingRule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    // Build update data with flexible handling
    const updateData: any = {};
    
    if (json.name !== undefined) updateData.name = json.name;
    if (json.description !== undefined) updateData.description = json.description;
    if (json.triggerType !== undefined) updateData.triggerType = json.triggerType;
    if (json.triggerConfig !== undefined) updateData.triggerConfig = json.triggerConfig || {};
    if (json.actionConfig !== undefined) updateData.actionConfig = json.actionConfig || {};
    if (json.isActive !== undefined) updateData.isActive = json.isActive;
    if (json.priority !== undefined) updateData.priority = json.priority;

    const rule = await prisma.automationRule.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(rule, { status: 200 });
  } catch (err) {
    console.error("PUT /api/automation-rules error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

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

    const result = await executeAutomationRule(rule);

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

async function executeAutomationRule(rule: any) {
  const { triggerType, actionConfig, companyId } = rule;
  const useAI = actionConfig?.useAI ?? true;
  
  switch (triggerType) {
    case "manual":
    case "ai_content":
      if (useAI) {
        return await generateAIContentForRule(companyId, actionConfig);
      }
      return await generateContentForRule(companyId, actionConfig);
    case "new_product":
      return await handleNewProductTrigger(companyId, actionConfig);
    case "schedule":
      return await handleScheduleTrigger(companyId, actionConfig);
    case "engagement":
      return await handleEngagementTrigger(companyId, actionConfig);
    case "trending":
      return await handleTrendingTrigger(companyId, actionConfig);
    default:
      return { message: "Unknown trigger type" };
  }
}

async function generateAIContentForRule(companyId: string, actionConfig: any) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { brandProfile: true },
  });

  if (!company) {
    throw new Error("Company not found");
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const platforms = actionConfig?.platforms || ["instagram"];
  const contentType = actionConfig?.contentType || "carousel";
  const count = actionConfig?.postCount || 4;
  const customPrompt = actionConfig?.customPrompt || "";

  let brandContext = "";
  if (company.brandProfile) {
    const bp = company.brandProfile;
    brandContext = `
EMPRESA: ${company.name}
DOMINIO: ${company.domain}
INDUSTRIA: ${company.industry || 'General'}

PERFIL DE MARCA:
- Voz: ${bp.brandVoice}
- Audiencia: ${bp.targetAudience}
- Estilo: ${bp.style}
- Posicionamiento: ${bp.positioning}
- Tono: ${bp.tone}
`;
  } else {
    brandContext = `EMPRESA: ${company.name} - DOMINIO: ${company.domain}`;
  }

  if (!apiKey) {
    return await generateContentForRule(companyId, actionConfig);
  }

  try {
    const userPrompt = `
${brandContext}

SOLICITUD: ${customPrompt || `Genera contenido automático de tipo ${contentType} para ${company.name}`}

CONFIGURACIÓN:
- Plataformas: ${platforms.join(", ")}
- Tipo: ${contentType}
- Cantidad: ${count}

Genera contenido en JSON válido.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: AI_AUTOMATION_SYSTEM },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      return await generateContentForRule(companyId, actionConfig);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";

    let generatedContent;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        generatedContent = JSON.parse(jsonMatch[0]);
      }
    } catch {
      return await generateContentForRule(companyId, actionConfig);
    }

    const posts = [];
    const postsData = generatedContent.posts || generatedContent.slides || [];
    
    for (const postData of postsData.slice(0, count)) {
      const post = await prisma.post.create({
        data: {
          title: `Automation AI - ${new Date().toISOString()}`,
          caption: postData.caption || "",
          hashtags: actionConfig?.includeHashtags ? (postData.hashtags || []) : [],
          imagePrompt: postData.image_prompt || "Professional product photography",
          platform: postData.platform || platforms[0],
          status: "draft",
          companyId,
        },
      });
      posts.push(post);
    }

    return { generated: posts.length, posts, aiGenerated: true };
  } catch (error) {
    console.error("AI generation error:", error);
    return await generateContentForRule(companyId, actionConfig);
  }
}

async function generateContentForRule(companyId: string, actionConfig: any) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new Error("Company not found");

  const platforms = actionConfig?.platforms || ["instagram"];
  const count = actionConfig?.postCount || 4;

  const posts = [];
  for (let i = 0; i < Math.min(count, platforms.length); i++) {
    const post = await prisma.post.create({
      data: {
        title: `Automation - ${new Date().toISOString()}`,
        caption: `Contenido generado automáticamente para ${company.name}`,
        hashtags: actionConfig?.includeHashtags !== false ? ["#Automation", "#Aupoz"] : [],
        imagePrompt: "Professional product photography",
        platform: platforms[i % platforms.length] as any,
        status: "draft",
        companyId,
      },
    });
    posts.push(post);
  }

  return { generated: posts.length, posts, aiGenerated: false };
}

async function handleNewProductTrigger(companyId: string, actionConfig: any) {
  return await generateAIContentForRule(companyId, { ...actionConfig, customPrompt: "Nuevo producto" });
}

async function handleScheduleTrigger(companyId: string, actionConfig: any) {
  return await generateAIContentForRule(companyId, { ...actionConfig, customPrompt: "Contenido programado" });
}

async function handleEngagementTrigger(companyId: string, actionConfig: any) {
  return await generateAIContentForRule(companyId, { ...actionConfig, customPrompt: "Contenido para engagement" });
}

async function handleTrendingTrigger(companyId: string, actionConfig: any) {
  return await generateAIContentForRule(companyId, { ...actionConfig, customPrompt: "Contenido trending" });
}
