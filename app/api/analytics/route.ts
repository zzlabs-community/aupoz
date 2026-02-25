export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

const AI_ANALYTICS_SYSTEM = `Eres un experto en análisis de marketing digital y tendencias de redes sociales.

Tu tarea es analizar dominios web y proporcionar:
1. Tendencias de búsqueda relevantes para el país
2. Recomendaciones para mejorar el dominio/web
3. Productos o servicios recomendados para la empresa

Responde en JSON válido con esta estructura exacta:
{
  "trends": [
    {
      "country": "USA",
      "topics": ["tema1", "tema2", "tema3", "tema4", "tema5"]
    },
    {
      "country": "Chile",
      "topics": ["tema1", "tema2", "tema3", "tema4", "tema5"]
    },
    {
      "country": "Peru",
      "topics": ["tema1", "tema2", "tema3", "tema4", "tema5"]
    },
    {
      "country": "Argentina",
      "topics": ["tema1", "tema2", "tema3", "tema4", "tema5"]
    },
    {
      "country": "Colombia",
      "topics": ["tema1", "tema2", "tema3", "tema4", "tema5"]
    }
  ],
  "domainRecommendations": ["recomendacion1", "recomendacion2", "recomendacion3", "recomendacion4", "recomendacion5"],
  "productRecommendations": ["producto1", "producto2", "producto3", "producto4", "producto5"]
}`;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const companyId = url.searchParams.get("companyId");
    const type = url.searchParams.get("type"); // "stats", "trends", "all"

    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { brandProfile: true }
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Get content creation stats
    const postsCount = await prisma.post.count({
      where: { companyId }
    });

    const campaignsCount = await prisma.campaign.count({
      where: { companyId }
    });

    // Get calendar stats
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const calendarEventsCount = await prisma.calendarEvent.count({
      where: {
        userId: company.userId,
        date: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      }
    });

    // Get platform distribution from posts
    const postsByPlatform = await prisma.post.groupBy({
      by: ['platform'],
      where: { companyId },
      _count: true
    });

    // Get automation stats
    const automationsCount = await prisma.automationRule.count({
      where: { companyId }
    });

    const activeAutomationsCount = await prisma.automationRule.count({
      where: { companyId, isActive: true }
    });

    // Get content status distribution
    const postsByStatus = await prisma.post.groupBy({
      by: ['status'],
      where: { companyId },
      _count: true
    });

    // Get recent posts
    const recentPosts = await prisma.post.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        title: true,
        platform: true,
        status: true,
        createdAt: true
      }
    });

    // Get scheduled posts count
    const scheduledPostsCount = await prisma.post.count({
      where: { 
        companyId,
        status: 'scheduled'
      }
    });

    // Get published posts count
    const publishedPostsCount = await prisma.post.count({
      where: { 
        companyId,
        status: 'published'
      }
    });

    const stats: any = {
      content: {
        totalPosts: postsCount,
        totalCampaigns: campaignsCount,
        scheduledPosts: scheduledPostsCount,
        publishedPosts: publishedPostsCount,
        byStatus: postsByStatus.map(p => ({
          status: p.status,
          count: p._count
        })),
        byPlatform: postsByPlatform.map(p => ({
          platform: p.platform,
          count: p._count
        }))
      },
      calendar: {
        totalEvents: calendarEventsCount,
        eventsThisMonth: calendarEventsCount
      },
      automations: {
        total: automationsCount,
        active: activeAutomationsCount
      },
      recentPosts
    };

    // If type is "trends" or "all", get AI analysis
    if (type === 'trends' || type === 'all') {
      const apiKey = process.env.OPENAI_API_KEY;
      
      if (apiKey && company.domain) {
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
                { role: "system", content: AI_ANALYTICS_SYSTEM },
                { 
                  role: "user", 
                  content: `Analiza el dominio: ${company.domain}
Empresa: ${company.name}
Industria: ${company.industry || 'No especificada'}
Descripción: ${company.description || 'No disponible'}
Productos/Servicios actuales: ${company.products || 'No especificados'}

Proporciona tendencias, recomendaciones de dominio y productos/servicios recomendados.`
                }
              ],
              max_tokens: 2000,
              temperature: 0.7,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const content = data.choices?.[0]?.message?.content ?? "";
            
            try {
              const jsonMatch = content.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const aiAnalysis = JSON.parse(jsonMatch[0]);
                stats.aiAnalysis = aiAnalysis;
              }
            } catch {
              // Ignore parsing errors
            }
          }
        } catch (error) {
          console.error("AI analysis error:", error);
        }
      }
    }

    return NextResponse.json(stats, { status: 200 });
  } catch (err) {
    console.error("GET /api/analytics error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
