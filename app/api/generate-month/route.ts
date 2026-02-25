export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/prisma";

// Validation schema
const generateMonthSchema = z.object({
  companyId: z.string().min(1, "companyId is required"),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2024).max(2030).optional(),
  postCount: z.coerce.number().int().min(4).max(20).default(10),
  platforms: z.array(z.enum(["instagram", "twitter", "linkedin", "facebook", "tiktok", "pinterest"])).optional(),
});

// System prompt for monthly content generation
const MONTHLY_CALENDAR_SYSTEM = `Eres un Content Strategist para ecommerce.

Tu tarea es generar un calendario de contenido mensual para redes sociales.

REGLAS:
1. Genera entre 8-12 posts distribuidos en el mes
2. Cada post debe tener: fecha, plataforma, caption, hashtags, image_prompt
3. Los hooks deben ser variados y estratégicos
4. Incluye diferentes tipos de contenido: producto, testimonial, behind-the-scenes, tips, promotions
5. Distribuye el contenido de forma estratégica (no todos juntos)
6. Caption debe incluir: hook, cuerpo, CTA, hashtags

Output JSON válido:
{
  "posts": [
    {
      "day": 1,
      "platform": "instagram",
      "caption": "",
      "hashtags": [],
      "image_prompt": "",
      "content_type": "product_showcase"
    }
  ]
}`;

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = generateMonthSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ 
        error: "Invalid body", 
        details: parsed.error.flatten() 
      }, { status: 400 });
    }

    const { 
      companyId, 
      month, 
      year, 
      postCount, 
      platforms 
    } = parsed.data;

    const targetMonth = month ?? new Date().getMonth() + 1;
    const targetYear = year ?? new Date().getFullYear();
    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();

    // Fetch company with brand profile
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { brandProfile: true },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Get products from company
    let products: any[] = [];
    if (company.products) {
      try {
        products = typeof company.products === "string" 
          ? JSON.parse(company.products) 
          : company.products;
      } catch {}
    }

    // Build context for AI
    const brandContext = company.brandProfile ? `
BRAND:
- Voice: ${company.brandProfile.brandVoice}
- Audience: ${company.brandProfile.targetAudience}
- Style: ${company.brandProfile.style}
- Tone: ${company.brandProfile.tone}
` : "";

    const productsContext = products.length > 0 ? `
PRODUCTS:
${products.slice(0, 5).map((p: any) => `- ${p.title}`).join("\n")}
` : "";

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      // Generate mock calendar
      const mockPosts = [];
      const contentTypes = ["product_showcase", "tips", "behind_scenes", "promotion", "testimonial"];
      const defaultPlatforms = platforms || ["instagram", "twitter"];
      
      for (let i = 0; i < postCount; i++) {
        const day = Math.floor((i * daysInMonth) / postCount) + 1;
        mockPosts.push({
          day,
          platform: defaultPlatforms[i % defaultPlatforms.length],
          caption: `Contenido generado para el día ${day} del mes`,
          hashtags: ["#Aupoz", "#Contenido", "#Ecommerce"],
          image_prompt: "Professional product photography",
          content_type: contentTypes[i % contentTypes.length],
        });
      }

      // Save posts to DB
      const savedPosts = await prisma.post.createManyAndReturn({
        data: mockPosts.map((p) => ({
          title: `Post ${p.day}/${targetMonth}`,
          caption: p.caption,
          hashtags: p.hashtags,
          imagePrompt: p.image_prompt,
          platform: p.platform as any,
          status: "draft",
          companyId,
          scheduledAt: new Date(targetYear, targetMonth - 1, p.day),
        })),
      });

      return NextResponse.json({
        month: targetMonth,
        year: targetYear,
        posts: savedPosts,
        total: savedPosts.length,
      }, { status: 200 });
    }

    // Call OpenAI
    const userPrompt = `
${brandContext}
${productsContext}

MES: ${targetMonth}/${targetYear}
DÍAS DEL MES: ${daysInMonth}
NÚMERO DE POSTS: ${postCount}
PLATAFORMAS: ${(platforms || ["instagram"]).join(", ")}

Genera el calendario en JSON válido.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: MONTHLY_CALENDAR_SYSTEM },
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

    let calendar;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        calendar = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found");
      }
    } catch (parseErr) {
      return NextResponse.json({ 
        error: "Failed to parse AI response", 
        raw: content.substring(0, 500) 
      }, { status: 500 });
    }

    const posts = calendar.posts || [];

    // Save posts to DB
    const savedPosts = await prisma.post.createManyAndReturn({
      data: posts.map((p: any) => ({
        title: `Post ${p.day}/${targetMonth}`,
        caption: p.caption || "",
        hashtags: p.hashtags || [],
        imagePrompt: p.image_prompt || "",
        platform: p.platform || "instagram",
        status: "draft",
        companyId,
        scheduledAt: new Date(targetYear, targetMonth - 1, p.day),
      })),
    });

    return NextResponse.json({
      month: targetMonth,
      year: targetYear,
      posts: savedPosts,
      total: savedPosts.length,
    }, { status: 200 });
  } catch (err) {
    console.error("POST /api/generate-month error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// GET posts for a month
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const companyId = url.searchParams.get("companyId");
    const month = z.coerce.number().int().parse(url.searchParams.get("month") ?? String(new Date().getMonth() + 1));
    const year = z.coerce.number().int().parse(url.searchParams.get("year") ?? String(new Date().getFullYear()));

    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const posts = await prisma.post.findMany({
      where: {
        companyId,
        scheduledAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { scheduledAt: "asc" },
    });

    return NextResponse.json({
      month,
      year,
      posts,
      total: posts.length,
    }, { status: 200 });
  } catch (err) {
    console.error("GET /api/generate-month error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
