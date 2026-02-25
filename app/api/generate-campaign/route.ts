export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/auth";

// Validation schemas
const generateCampaignSchema = z.object({
  companyId: z.string().min(1, "companyId is required"),
  prompt: z.string().min(5).optional(),
  campaignType: z.enum(["carousel", "single_post", "story", "reel", "video"]).default("carousel"),
  platform: z.enum(["instagram", "twitter", "linkedin", "facebook", "tiktok", "pinterest"]).default("instagram"),
  saveToDb: z.boolean().optional().default(true),
});

// Campaign generation system prompt
const CAMPAIGN_GENERATOR_SYSTEM = `Eres un Senior Creative Director y Performance Marketer especializado en ecommerce.

Tu tarea es generar campañas de contenido para redes sociales que maximicen conversiones y engagement.

REGLAS ESTRICTAS:
1. Cada slide debe tener: hook (gancho), headline, body, image_prompt
2. Los hooks deben ser específicos, no genéricos
3. Los image_prompts deben seguir reglas de coste: max 1024x1024, iluminación simple
4. El caption debe incluir: hook, storytelling, beneficios, CTA estratégico, hashtags
5. Enfoque siempre en BENEFICIOS para el cliente

Output EXACTO en JSON válido:
{
  "campaign_type": "carousel",
  "slides": [
    { "hook": "", "headline": "", "body": "", "image_prompt": "" }
  ],
  "caption": "",
  "hashtags": [],
  "cta": "",
  "visual_style_desc": ""
}`;

export async function POST(request: Request) {
  try {
    const sess = await getSession();
    if (!sess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await request.json();
    const parsed = generateCampaignSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ 
        error: "Invalid body", 
        details: parsed.error.flatten() 
      }, { status: 400 });
    }

    const { 
      companyId, 
      prompt, 
      campaignType, 
      platform,
      saveToDb 
    } = parsed.data;

    // Verify company belongs to user
    const company = await prisma.company.findFirst({
      where: { id: companyId, userId: sess.user.id },
      include: { brandProfile: true },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const brandProfile = company.brandProfile;

    // Build context for AI - use brand profile if available, otherwise use defaults
    let brandContext = "";
    if (brandProfile) {
      brandContext = `
BRAND PROFILE:
- Voice: ${brandProfile.brandVoice}
- Audience: ${brandProfile.targetAudience}
- Style: ${brandProfile.style}
- Positioning: ${brandProfile.positioning}
- Tone: ${brandProfile.tone}
- Key Messages: ${brandProfile.keyMessages?.join(", ") || "N/A"}
- Colors: ${brandProfile.colorPalette?.join(", ") || "N/A"}
`.trim();
    } else {
      brandContext = `
BRAND PROFILE (Default):
- Voice: Professional yet friendly
- Audience: General consumers interested in products/services
- Style: Modern, clean, minimalist
- Positioning: Premium quality at accessible prices
- Tone: Approachable and professional
- Key Messages: Quality, value, innovation
- Colors: Blue, white, gray
`.trim();
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      // Return mock campaign if no API key
      const mockCampaign = {
        campaign_type: campaignType,
        slides: [
          { hook: "¡Transforma tu estilo hoy!", headline: "Nueva Colección", body: "Descubre productos diseñados para ti", image_prompt: "Professional product showcase" },
          { hook: "Calidad premium", headline: "Materiales Exclusivos", body: "Cada detalle pensado para ti", image_prompt: "Close-up product detail" },
          { hook: "Envío gratis", headline: "Compra Sin Comisiones", body: "Delivery incluido", image_prompt: "Fast shipping visualization" },
        ],
        caption: "¡Hola! Te traemos algo especial\n\n👆 Swipea para ver detalles\n\n#Nuevo #Moda",
        hashtags: ["#Nuevo", "#Moda", "#Tendencias"],
        cta: "Comprar ahora",
        visual_style_desc: "Clean, minimalist, premium feel"
      };

      if (saveToDb) {
        await prisma.campaign.create({
          data: {
            name: `Campaign - ${new Date().toISOString().split("T")[0]}`,
            campaignType: campaignType as any,
            content: mockCampaign,
            status: "draft",
            companyId,
          },
        });
      }

      return NextResponse.json(mockCampaign, { status: 200 });
    }

    // Call OpenAI
    const slideCount = campaignType === "carousel" ? 5 : 1;
    const userPrompt = `
${brandContext}

EMPRESA: ${company.name}
DOMINIO: ${company.domain}
INDUSTRIA: ${company.industry || 'N/A'}

PLATFORM: ${platform}
CAMPAIGN TYPE: ${campaignType}
SLIDES: ${slideCount}
${prompt ? `CUSTOM INSTRUCTIONS: ${prompt}` : ""}

Genera la campaña completa en JSON válido.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: CAMPAIGN_GENERATOR_SYSTEM },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ 
        error: "OpenAI request failed", 
        details: errorText 
      }, { status: 502 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";

    let campaign;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        campaign = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found");
      }
    } catch (parseErr) {
      return NextResponse.json({ 
        error: "Failed to parse AI response", 
        raw: content.substring(0, 500) 
      }, { status: 500 });
    }

    // Validate campaign structure
    const validatedCampaign = {
      campaign_type: campaign.campaign_type || campaignType,
      slides: Array.isArray(campaign.slides) ? campaign.slides : [],
      caption: campaign.caption || "",
      hashtags: Array.isArray(campaign.hashtags) ? campaign.hashtags : [],
      cta: campaign.cta || "Learn more",
      visual_style_desc: campaign.visual_style_desc || "Modern, clean style",
    };

    // Save to DB if requested
    if (saveToDb) {
      const created = await prisma.campaign.create({
        data: {
          name: `Campaign - ${new Date().toISOString().split("T")[0]}`,
          campaignType: validatedCampaign.campaign_type as any,
          content: validatedCampaign,
          status: "draft",
          companyId,
        },
      });

      return NextResponse.json({
        ...validatedCampaign,
        id: created.id,
        saved: true,
      }, { status: 200 });
    }

    return NextResponse.json(validatedCampaign, { status: 200 });
  } catch (err) {
    console.error("POST /api/generate-campaign error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// GET campaigns for company
export async function GET(request: Request) {
  try {
    const sess = await getSession();
    if (!sess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const companyId = url.searchParams.get("companyId");

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

    const campaigns = await prisma.campaign.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json(campaigns, { status: 200 });
  } catch (err) {
    console.error("GET /api/generate-campaign error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
