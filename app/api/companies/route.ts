export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/auth";

// Validation schemas
const createCompanySchema = z.object({
  name: z.string().min(1, "name is required"),
  domain: z.string().min(1, "domain is required").regex(/^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/, "invalid domain format"),
});

const scanDomainSchema = z.object({
  companyId: z.string().min(1),
});

// AI system prompt for domain scanning
const DOMAIN_SCANNER_SYSTEM = `Eres un experto en análisis de marcas y empresas. Tu tarea es escanear un dominio web y extraer información de la empresa para crear contenido de marketing.

Analiza y responde en JSON con:
{
  "name": "Nombre de la empresa",
  "description": "Descripción breve de qué hace la empresa",
  "industry": "Industria o sector (ej: tecnología, moda, alimentación, etc)",
  "products": "Lista de productos o servicios principales separados por comas",
  "targetAudience": "Descripción del público objetivo",
  "brandColors": ["#color1", "#color2", ...],
  "socialLinks": {
    "twitter": "url o null",
    "instagram": "url o null", 
    "linkedin": "url o null",
    "facebook": "url o null"
  }
}`;

async function scrapeDomain(domain: string) {
  const url = `https://${domain}`;
  const headers = { "User-Agent": "AupozBot/1.0 (+https://aupoz.com)" };
  
  try {
    const res = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    
    const html = await res.text();
    
    // Extract meta tags
    const getMeta = (name: string) => {
      const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']+)["']`, "i");
      const m = html.match(re);
      return m ? m[1] : null;
    };
    
    const title = getMeta("og:title") || getMeta("title") || /<title>([^<]+)<\/title>/i.exec(html)?.[1];
    const description = getMeta("og:description") || getMeta("description");
    const image = getMeta("og:image");
    
    // Extract links
    const twitter = html.match(/twitter\.com\/([a-zA-Z0-9_]+)/i)?.[0] || null;
    const instagram = html.match(/instagram\.com\/([a-zA-Z0-9_]+)/i)?.[0] || null;
    const linkedin = html.match(/linkedin\.com\/company\/([a-zA-Z0-9-]+)/i)?.[0] || null;
    const facebook = html.match(/facebook\.com\/([a-zA-Z0-9.]+)/i)?.[0] || null;
    
    return { title, description, image, socialLinks: { twitter, instagram, linkedin, facebook } };
  } catch (error) {
    console.error("Scrape error:", error);
    return null;
  }
}

export async function GET(request: Request) {
  const sess = await getSession();
  if (!sess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const companyId = url.searchParams.get("id");

  try {
    if (companyId) {
      const company = await prisma.company.findFirst({
        where: { id: companyId, userId: sess.user.id },
        include: { brandProfile: true },
      });
      
      if (!company) {
        return NextResponse.json({ error: "Company not found" }, { status: 404 });
      }
      
      return NextResponse.json(company, { status: 200 });
    }

    // Get all companies for user
    const companies = await prisma.company.findMany({
      where: { userId: sess.user.id },
      orderBy: { createdAt: "desc" },
      include: { brandProfile: true },
    });

    return NextResponse.json(companies, { status: 200 });
  } catch (err) {
    console.error("GET /api/companies error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const sess = await getSession();
  if (!sess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const json = await request.json();
    const parsed = createCompanySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
    }

    const { name, domain } = parsed.data;

    // Check max 5 companies per user
    const count = await prisma.company.count({
      where: { userId: sess.user.id },
    });

    if (count >= 5) {
      return NextResponse.json({ error: "Maximum 5 companies allowed" }, { status: 400 });
    }

    // Check if domain already exists for this user
    const existing = await prisma.company.findFirst({
      where: { userId: sess.user.id, domain },
    });

    if (existing) {
      return NextResponse.json({ error: "Domain already added" }, { status: 400 });
    }

    // Create company
    const company = await prisma.company.create({
      data: {
        name,
        domain,
        userId: sess.user.id,
        socialLinks: {},
      },
    });

    return NextResponse.json(company, { status: 201 });
  } catch (err) {
    console.error("POST /api/companies error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Scan domain with AI
export async function PUT(request: Request) {
  const sess = await getSession();
  if (!sess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const json = await request.json();
    const parsed = scanDomainSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
    }

    const { companyId } = parsed.data;

    // Get company
    const company = await prisma.company.findFirst({
      where: { id: companyId, userId: sess.user.id },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Scrape domain
    const scraped = await scrapeDomain(company.domain);
    
    // Call AI for analysis
    const apiKey = process.env.OPENAI_API_KEY;
    let aiAnalysis = null;
    
    if (apiKey) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: DOMAIN_SCANNER_SYSTEM },
              { 
                role: "user", 
                content: `Analiza el dominio: ${company.domain}\n\nTítulo: ${scraped?.title || 'N/A'}\nDescripción: ${scraped?.description || 'N/A'}\n\nResponde en JSON.` 
              }
            ],
            max_tokens: 500,
            temperature: 0.7,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            try {
              aiAnalysis = JSON.parse(content);
            } catch {}
          }
        }
      } catch (err) {
        console.error("AI analysis error:", err);
      }
    }

    // Update company with scraped + AI data
    const updated = await prisma.company.update({
      where: { id: companyId },
      data: {
        description: aiAnalysis?.description || scraped?.description || null,
        industry: aiAnalysis?.industry || null,
        products: aiAnalysis?.products || null,
        targetAudience: aiAnalysis?.targetAudience || null,
        brandColors: aiAnalysis?.brandColors || [],
        socialLinks: scraped?.socialLinks || {},
        isScanned: true,
        scannedAt: new Date(),
      },
    });

    // Create brand profile
    if (aiAnalysis) {
      await prisma.brandProfile.upsert({
        where: { companyId },
        update: {
          brandVoice: aiAnalysis.brandVoice || "Professional",
          targetAudience: aiAnalysis.targetAudience || "General audience",
          style: aiAnalysis.style || "Modern",
          positioning: aiAnalysis.positioning || "Quality products",
          keyMessages: aiAnalysis.keyMessages || [],
          colorPalette: aiAnalysis.colorPalette || [],
          tone: aiAnalysis.tone || "professional",
          analyzedAt: new Date(),
        },
        create: {
          companyId,
          brandVoice: aiAnalysis.brandVoice || "Professional",
          targetAudience: aiAnalysis.targetAudience || "General audience",
          style: aiAnalysis.style || "Modern",
          positioning: aiAnalysis.positioning || "Quality products",
          keyMessages: aiAnalysis.keyMessages || [],
          colorPalette: aiAnalysis.colorPalette || [],
          tone: aiAnalysis.tone || "professional",
        },
      });
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    console.error("PUT /api/companies error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const sess = await getSession();
  if (!sess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const companyId = url.searchParams.get("id");

  if (!companyId) {
    return NextResponse.json({ error: "Company ID required" }, { status: 400 });
  }

  try {
    await prisma.company.deleteMany({
      where: { id: companyId, userId: sess.user.id },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/companies error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
