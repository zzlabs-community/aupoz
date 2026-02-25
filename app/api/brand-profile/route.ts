export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/auth";

// Zod schemas for validation
const analyzeSchema = z.object({
  companyId: z.string().min(1, "companyId is required"),
});

const updateSchema = z.object({
  companyId: z.string().min(1),
  brandVoice: z.string().optional(),
  targetAudience: z.string().optional(),
  style: z.string().optional(),
  positioning: z.string().optional(),
  keyMessages: z.array(z.string()).optional(),
  colorPalette: z.array(z.string()).optional(),
  tone: z.string().optional(),
});

// AI system prompt for brand analysis
const BRAND_ANALYZER_SYSTEM = `Eres un Brand Strategist senior especializado en analisis de empresas y marketing digital.

Tu tarea es analizar la informacion de una empresa y generar un perfil de marca completo.

Analiza:
1. BRAND VOICE: Como habla la marca? (formal, casual, premium, friendly, authoritative)
2. TARGET AUDIENCE: Quien es el cliente ideal? (edad, intereses, comportamiento)
3. STYLE: Cual es el estilo visual y comunicacional?
4. POSITIONING: Como se diferencia de la competencia?
5. KEY MESSAGES: Cuales son los mensajes clave?
6. COLOR PALETTE: Que colores representan la marca?
7. TONE: Tono general de comunicacion

Responde SOLO en JSON:
{
  "brandVoice": "string",
  "targetAudience": "string", 
  "style": "string",
  "positioning": "string",
  "keyMessages": ["string"],
  "colorPalette": ["#hex"],
  "tone": "string"
}`;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const companyId = url.searchParams.get("companyId");

    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }

    const profile = await prisma.brandProfile.findUnique({
      where: { companyId },
    });

    if (!profile) {
      return NextResponse.json({ error: "Brand profile not found" }, { status: 404 });
    }

    return NextResponse.json(profile, { status: 200 });
  } catch (err) {
    console.error("GET /api/brand-profile error:", err);
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
    const parsed = analyzeSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
    }

    const { companyId } = parsed.data;

    // Verify company belongs to user
    const company = await prisma.company.findFirst({
      where: { id: companyId, userId: sess.user.id },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Use company info for analysis
    const companyInfo = {
      name: company.name,
      domain: company.domain,
      description: company.description,
      industry: company.industry,
      products: company.products,
      targetAudience: company.targetAudience,
    };

    // Call OpenAI for analysis
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      // Return mock data if no API key
      const mockProfile = {
        brandVoice: "Professional yet approachable",
        targetAudience: companyInfo.targetAudience || "Ecommerce shoppers",
        style: "Clean, modern, minimalist",
        positioning: "Premium quality at accessible prices",
        keyMessages: ["Quality", "Value", "Innovation"],
        colorPalette: company.brandColors?.length ? company.brandColors : ["#000000", "#FFFFFF", "#6366F1"],
        tone: "professional",
      };

      const created = await prisma.brandProfile.upsert({
        where: { companyId },
        update: { ...mockProfile, analyzedAt: new Date() },
        create: { companyId, ...mockProfile },
      });

      return NextResponse.json(created, { status: 200 });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: BRAND_ANALYZER_SYSTEM },
          { 
            role: "user", 
            content: `Analiza esta empresa:\n\nNombre: ${companyInfo.name}\nDominio: ${companyInfo.domain}\nDescripcion: ${companyInfo.description || 'N/A'}\nIndustria: ${companyInfo.industry || 'N/A'}\nProductos: ${companyInfo.products || 'N/A'}\nAudiencia: ${companyInfo.targetAudience || 'N/A'}\n\nResponde en JSON.` 
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: "OpenAI request failed", details: errorText }, { status: 502 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";

    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response", raw: content }, { status: 500 });
    }

    // Validate and map AI response to schema
    const profileData = {
      brandVoice: analysis.brandVoice || "Professional",
      targetAudience: analysis.targetAudience || companyInfo.targetAudience || "General audience",
      style: analysis.style || "Modern",
      positioning: analysis.positioning || "Quality products",
      keyMessages: analysis.keyMessages || [],
      colorPalette: analysis.colorPalette || company.brandColors || [],
      tone: analysis.tone || "professional",
    };

    // Upsert brand profile
    const created = await prisma.brandProfile.upsert({
      where: { companyId },
      update: { ...profileData, analyzedAt: new Date() },
      create: { companyId, ...profileData },
    });

    return NextResponse.json(created, { status: 200 });
  } catch (err) {
    console.error("POST /api/brand-profile error:", err);
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
    const parsed = updateSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
    }

    const { companyId, ...updateData } = parsed.data;

    // Verify ownership
    const company = await prisma.company.findFirst({
      where: { id: companyId, userId: sess.user.id },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const updated = await prisma.brandProfile.update({
      where: { companyId },
      data: updateData,
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    console.error("PUT /api/brand-profile error:", err);
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

    await prisma.brandProfile.delete({
      where: { companyId },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/brand-profile error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
