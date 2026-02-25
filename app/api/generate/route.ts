export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/prisma";

const CREATIVE_LAW = `You are a Senior Creative Director, Brand Strategist, Performance Marketer, SEO Specialist, and Commercial Visual Director.

Role: generate high-end, non-generic, strategically optimized social media content while keeping computational efficiency and cost control.

ALWAYS reflect: strategic intent, psychological persuasion, platform awareness, market positioning, premium execution, cost-aware visual construction. NEVER generic.

Pre-Generation (internal only, do not output):
1) objective, 2) audience, 3) platform, 4) emotional tone, 5) competition, 6) algorithm trends (2026 mindset).

If image or video direction is requested: produce one single-image professional visual direction, cost-efficient.
Cost rules: max 1024x1024 unless specified; avoid 4K/8K/RAW mentions; avoid GPU-heavy effects; simple lighting (1 key + subtle fill/rim); minimal environments unless strategic.

Visual direction must include: scene setup, camera ref (DSLR/Mirrorless, not cinema rigs), lens (35mm or 85mm), lighting structure, composition theory, realistic materials, emotional tone, color grading logic.

Product-based: keep product accurate (shape/logo/labels), materials realistic, clean studio/minimal env, premium global-campaign lighting, avoid oversaturation.
Human-based: natural posture, real skin texture, authentic micro-expressions, clean lighting, no filters/cartoon.

Caption requirements: deliver a scroll-stopping hook; persuasive copy; benefits; subtle storytelling; strategic CTA; SEO phrasing aligned to platform; hashtag mix (niche, authority, trend, discoverability); short-form alternative caption.
If sales-focused: use scarcity, urgency, authority, social proof, exclusivity.

Prohibited: generic phrases, shallow descriptions, weak hooks, irrelevant hashtags, over-rendered cinematic excess, artificial hype.

Quality: international-level campaigns; refine internally before delivering. Balance branding + marketing effectiveness + algorithm awareness + cost efficiency.
Output in Spanish.`;

const bodySchema = z.object({
  prompt: z.string().min(5, "prompt must be at least 5 characters").optional(),
  productIds: z.array(z.string()).min(1).optional(),
  workspaceId: z.string().optional(),
  tone: z.enum(["neutral", "friendly", "professional", "playful"]).default("neutral"),
  platform: z.enum(["twitter", "instagram", "linkedin", "tiktok", "facebook"]).optional(),
  // when JSON; if using multipart we read from form-data instead
  imageBase64: z.string().optional(),
  productUrl: z.string().url().optional(),
});

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let parsed = null;
    let prompt = "";
    let productIds: string[] | undefined;
    let workspaceId: string | undefined;
    let tone: z.infer<typeof bodySchema>["tone"] = "neutral";
    let platform: z.infer<typeof bodySchema>["platform"];
    let imageBase64: string | undefined;
    let productUrl: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const image = form.get("image");
      const text = form.get("prompt");
      const toneVal = (form.get("tone") as string) || "neutral";
      const platformVal = (form.get("platform") as string) || undefined;
      const productUrlVal = (form.get("productUrl") as string) || undefined;
      if (image instanceof Blob) {
        const arr = new Uint8Array(await image.arrayBuffer());
        const base64 = Buffer.from(arr).toString("base64");
        const ext = (image.type?.split("/")[1] || "png").toLowerCase();
        imageBase64 = `data:${image.type || "image/png"};base64,${base64}`;
      }
      const json = { prompt: typeof text === "string" ? text : undefined, tone: toneVal, platform: platformVal, imageBase64, productUrl: productUrlVal };
      parsed = bodySchema.safeParse(json);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid form data", details: parsed.error.flatten() }, { status: 400 });
      }
      ({ prompt = "", tone, platform, imageBase64, productUrl } = parsed.data);
    } else {
      const json = await request.json().catch(() => ({}));
      parsed = bodySchema.safeParse(json);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
      }
      ({ prompt = "", productIds, workspaceId, tone, platform, imageBase64, productUrl } = parsed.data);
    }

    const apiKey = process.env.OPENAI_API_KEY;

    // Compose prompt from company products if provided
    let finalPrompt = prompt ?? "";
    if (!finalPrompt && productIds && productIds.length && workspaceId) {
      // Get company by workspaceId to find products
      const company = await prisma.company.findFirst({
        where: { id: workspaceId },
      });
      if (company?.products) {
        const productList = company.products.split(',').slice(0, 5);
        finalPrompt = `Genera una publicación breve para redes sociales destacando: ${productList.join(', ')}`;
      }
    }

    // If a product URL is provided, enrich prompt with metadata scraped from the page
    let scrapedImageUrl: string | undefined;
    if (productUrl) {
      try {
        const meta = await scrapeProduct(productUrl);
        if (meta) {
          const { title, description, price, currency, brand, image } = meta;
          const parts: string[] = [];
          if (!finalPrompt) parts.push(`Escribe un post que destaque el siguiente producto.`);
          if (title) parts.push(`Producto: ${title}`);
          if (brand) parts.push(`Marca: ${brand}`);
          if (typeof price !== 'undefined') parts.push(`Precio: ${price}${currency ? ' ' + currency : ''}`);
          if (description) parts.push(`Descripción: ${stripHtml(description).slice(0, 300)}`);
          parts.push(`URL: ${productUrl}`);
          finalPrompt = `${finalPrompt ? finalPrompt + '\n' : ''}${parts.join('\n')}`;
          scrapedImageUrl = image;
        }
      } catch {
        // ignore scraping errors
      }
    }

    if (!finalPrompt) {
      return NextResponse.json({ error: "prompt or productIds is required" }, { status: 400 });
    }

    // If no API key, return a simple mocked text so the UI works offline
    if (!apiKey) {
      const mocked = `Borrador de post (${platform ?? "genérico"}, ${tone}): ${finalPrompt.substring(0, 180)}... #Aupoz`;
      return NextResponse.json({ text: mocked, mock: true }, { status: 200 });
    }

    // Build a multimodal input if image provided
    const userContent: any[] = [];
    userContent.push({ type: "input_text", text: finalPrompt });
    if (imageBase64) {
      userContent.push({ type: "input_image", image_url: imageBase64 });
    } else if (scrapedImageUrl) {
      userContent.push({ type: "input_image", image_url: scrapedImageUrl });
    }

    const systemContent = `${CREATIVE_LAW}\n\nAdaptación: plataforma ${platform ?? "genérico"}, tono ${tone}. Realiza el análisis previo de forma interna (no lo muestres). Responde SOLO en JSON válido con el siguiente esquema y en español neutro.`;

    const jsonSchema = {
      name: "AupozCreative",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          caption: { type: "string", description: "Texto final para la publicación" },
          image_prompt: { type: "string", description: "Descripción visual profesional para generar UNA imagen siguiendo reglas de coste" },
          alt_caption: { type: "string", description: "Versión breve optimizada para Reels/TikTok" }
        },
        required: ["caption", "image_prompt"],
      },
      strict: true,
    } as const;

    // Try Responses API first
    let aiText = "";
    let imagePrompt = "";
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [
          { role: "system", content: systemContent },
          { role: "user", content: [
            { type: "input_text", text: `Contexto:\nPlataforma: ${platform ?? "genérico"}.\nTono: ${tone}.\nIdioma: español.\nSi se incluye imagen o URL, úsala como referencia sin inventar.\nDevuelve JSON con { caption, image_prompt, alt_caption }.` },
            ...userContent,
          ] },
        ],
        response_format: { type: "json_schema", json_schema: jsonSchema },
        max_output_tokens: 640,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const raw = data?.output?.[0]?.content?.[0]?.text ?? "";
      try {
        const j = JSON.parse(raw);
        aiText = j?.caption || raw;
        imagePrompt = j?.image_prompt || "";
        if (!j?.alt_caption && aiText) {
          // derive quick short version
          const short = aiText.slice(0, 160);
          imagePrompt = imagePrompt;
        }
      } catch { aiText = raw; }
    } else {
      // If unauthorized or forbidden, degrade to mock output so UI keeps working
      if (res.status === 401 || res.status === 403) {
        const mocked = `Borrador de post (${platform ?? "genérico"}, ${tone}): ${finalPrompt.substring(0, 180)}... #Aupoz`;
        return NextResponse.json({ text: mocked, imagePrompt: "", mock: true }, { status: 200 });
      }
      // Fallback to chat.completions if Responses is not available
      const chat = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: `${systemContent} Devuelve SOLO JSON válido: {\"caption\": string, \"image_prompt\": string, \"alt_caption\": string}` },
            {
              role: "user",
              content: [ { type: "text", text: `Plataforma: ${platform ?? "genérico"}. Tono: ${tone}.\n${finalPrompt}` }, ...(imageBase64 ? [{ type: "image_url", image_url: { url: imageBase64 } }] : []) ],
            },
          ],
          max_tokens: 640,
        }),
      });
      if (!chat.ok) {
        if (chat.status === 401 || chat.status === 403) {
          const mocked = `Borrador de post (${platform ?? "genérico"}, ${tone}): ${finalPrompt.substring(0, 180)}... #Aupoz`;
          return NextResponse.json({ text: mocked, imagePrompt: "", mock: true }, { status: 200 });
        }
        const txt = await chat.text();
        return NextResponse.json({ error: "OpenAI request failed", status: chat.status, body: txt }, { status: 502 });
      }
      const data = await chat.json();
      const raw = data?.choices?.[0]?.message?.content ?? "";
      try { const j = JSON.parse(raw); aiText = j?.caption || raw; imagePrompt = j?.image_prompt || ""; } catch { aiText = raw; }
    }

    return NextResponse.json({ text: aiText, imagePrompt, usedLaw: true }, { status: 200 });
  } catch (err) {
    console.error("POST /api/generate error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// --- helpers ---
function stripHtml(html?: string) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function scrapeProduct(url: string): Promise<{
  title?: string;
  description?: string;
  image?: string;
  price?: string | number;
  currency?: string;
  brand?: string;
} | null> {
  const res = await fetch(url, { headers: { "User-Agent": "AupozBot/1.0 (+https://example.com)" }, cache: "no-store" });
  if (!res.ok) return null;
  const html = await res.text();
  const getMeta = (name: string) =>
    matchMeta(html, name) || matchMeta(html, `og:${name}`) || matchMeta(html, `twitter:${name}`);
  const title = getMeta("title") || matchTitle(html);
  const description = getMeta("description");
  const image = matchMeta(html, "og:image") || matchMeta(html, "twitter:image");
  const { price, currency, brand } = extractJsonLd(html) || {};
  return { title: title || undefined, description: description || undefined, image: image || undefined, price, currency, brand };
}

function matchMeta(html: string, key: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=[\"']${key}[\"'][^>]*content=[\"']([^\"']+)[\"'][^>]*>`, "i");
  const m = html.match(re);
  if (m) return m[1];
  const re2 = new RegExp(`<meta[^>]+content=[\"']([^\"']+)[\"'][^>]*(?:property|name)=[\"']${key}[\"'][^>]*>`, "i");
  const m2 = html.match(re2);
  return m2 ? m2[1] : null;
}

function matchTitle(html: string): string | null {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : null;
}

function extractJsonLd(html: string): { price?: string | number; currency?: string; brand?: string } | null {
  const scriptRe = /<script[^>]+type=[\"']application\/ld\+json[\"'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = scriptRe.exec(html))) {
    try {
      const json = JSON.parse(m[1]);
      const items = Array.isArray(json) ? json : [json];
      for (const it of items) {
        if (!it) continue;
        const type = (it["@type"] || it.type || "").toString().toLowerCase();
        if (type.includes("product")) {
          const offers = Array.isArray(it.offers) ? it.offers[0] : it.offers;
          const price = offers?.price || offers?.priceSpecification?.price;
          const currency = offers?.priceCurrency || offers?.priceSpecification?.priceCurrency;
          const brand = typeof it.brand === 'string' ? it.brand : it.brand?.name;
          return { price, currency, brand };
        }
      }
    } catch {}
  }
  // Fallback to Open Graph product price tags
  const price = matchMeta(html, 'product:price:amount') || undefined;
  const currency = matchMeta(html, 'product:price:currency') || undefined;
  if (price || currency) return { price, currency } as any;
  return null;
}
