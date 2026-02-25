export const runtime = "nodejs";

import { NextResponse } from "next/server";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import crypto from "node:crypto";
import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/auth";

export async function POST(request: Request) {
  try {
    const ct = request.headers.get("content-type") || "";
    if (!ct.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
    }
    const form = await request.formData();
    const prompt = String(form.get("prompt") || "Imagen para post");
    const size = String(form.get("size") || "1024x1024");
    const image = form.get("image");
    // If user provides a reference image, convert to PNG (from WebP/JPG) to keep compatibility
    let refPngBase64: string | undefined;
    if (image instanceof Blob) {
      try {
        const buf = Buffer.from(new Uint8Array(await image.arrayBuffer()));
        const png = await sharp(buf).png().toBuffer();
        refPngBase64 = `data:image/png;base64,${png.toString("base64")}`;
      } catch {
        // ignore; we'll still generate from prompt
      }
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      // Return a mock data-URL SVG so UI can preview algo
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024'>
        <defs>
          <linearGradient id='g' x1='0' x2='1' y1='0' y2='1'>
            <stop stop-color='#0b0f1a' offset='0'/>
            <stop stop-color='#173154' offset='1'/>
          </linearGradient>
        </defs>
        <rect width='100%' height='100%' fill='url(#g)'/>
        <text x='50%' y='50%' font-family='sans-serif' font-size='42' fill='#cfe3ff' text-anchor='middle'>Mock image</text>
      </svg>`;
      const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
      return NextResponse.json({ url: dataUrl, mock: true }, { status: 200 });
    }

    // Choose model by size: use DALL·E 3 for non-square sizes, gpt-image-1 for square
    const [wStr, hStr] = size.split("x");
    const w = Number(wStr), h = Number(hStr);
    const nonSquare = w !== h;

    // We skip variations for now to improve reliability; always generate from prompt.

    // Generation path
    async function generateWith(model: string) {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 60000); // allow up to 60s for images
      const resp = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        // Pass the reference image as a hint, when available, to improve fidelity (not all models honor it)
        body: JSON.stringify({ model, prompt: refPngBase64 ? `${prompt}\nReferencia visual incluida (no alterar proporciones ni tipografía).` : prompt, size, n: 1 }),
        signal: ac.signal,
      });
      clearTimeout(t);
      return resp;
    }

    // Prefer dall-e-3 (supports 1:1, 16:9, 9:16). Fallback to gpt-image-1.
    let gen = await generateWith("dall-e-3");
    if (!gen.ok && gen.status >= 400 && gen.status < 500) {
      // retry with gpt-image-1 in case the account doesn't have DALL·E enabled
      gen = await generateWith("gpt-image-1");
    }
    if (!gen.ok) {
      if (gen.status === 401 || gen.status === 403) {
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024'><rect width='100%' height='100%' fill='#0b0f1a'/><text x='50%' y='50%' fill='#cfe3ff' font-size='36' font-family='sans-serif' text-anchor='middle'>Mock image</text></svg>`;
        const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
        return NextResponse.json({ url: dataUrl, mock: true }, { status: 200 });
      }
      const txt = await gen.text();
      return NextResponse.json({ error: "Image generation failed", status: gen.status, body: txt }, { status: 502 });
    }
    const out = await gen.json();
    const item = out?.data?.[0] ?? {};
    const b64 = item?.b64_json as string | undefined;
    const extUrl = item?.url as string | undefined;

    // Get session once for userId
    const sess = await getSession().catch(() => null);
    const userId = sess?.user?.id;
    console.log('generate-image session:', sess ? 'found' : 'null', 'userId:', userId);

    // If we have a real API key but no user session, we cannot save to library.
    // Return 401 to prompt re‑authentication, unless we are in a mock scenario.
    if (apiKey && !userId) {
      console.warn('generate-image: authenticated generation requested but no session');
      return NextResponse.json(
        { error: 'Authentication required to save images to your library' },
        { status: 401 }
      );
    }

    if (b64) {
      const url = await saveBase64Png(b64, userId, prompt, size);
      return NextResponse.json({ url }, { status: 200 });
    }
    if (extUrl) {
      // Download image and save as Asset
      const url = await downloadAndSaveImage(extUrl, userId, prompt, size);
      return NextResponse.json({ url }, { status: 200 });
    }
    // As last resort, return a mock so UI doesn't block
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024'><rect width='100%' height='100%' fill='#0b0f1a'/><text x='50%' y='50%' fill='#cfe3ff' font-size='36' font-family='sans-serif' text-anchor='middle'>Mock image</text></svg>`;
    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
    return NextResponse.json({ url: dataUrl, mock: true }, { status: 200 });
  } catch (err: any) {
    console.error("POST /api/generate-image error:", err);
    // Graceful fallback on abort/timeouts or client errors so UI doesn't block
    const msg = String(err?.message || "");
    if (err?.name === "AbortError" || msg.includes("aborted") || msg.includes("timeout")) {
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024'><rect width='100%' height='100%' fill='#0b0f1a'/><text x='50%' y='50%' fill='#cfe3ff' font-size='36' font-family='sans-serif' text-anchor='middle'>Mock image</text></svg>`;
      const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
      return NextResponse.json({ url: dataUrl, mock: true }, { status: 200 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

async function saveBase64Png(b64: string, userId?: string, prompt?: string, size?: string) {
  const buf = Buffer.from(b64, "base64");
  return saveImageBuffer(buf, "image/png", userId, prompt, size);
}

async function downloadAndSaveImage(imageUrl: string, userId?: string, prompt?: string, size?: string) {
  let buf: Buffer | null = null;
  let mime = "image/png";
  const maxAttempts = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) }); // 10s timeout
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      buf = Buffer.from(arrayBuffer);
      mime = response.headers.get("content-type") || "image/png";
      break; // success
    } catch (error) {
      lastError = error as Error;
      console.warn(`Attempt ${attempt} failed to download ${imageUrl}:`, error);
      if (attempt < maxAttempts) {
        // Exponential backoff: wait 500ms, then 1s, then 2s
        await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt - 1)));
        continue;
      }
    }
  }

  if (!buf) {
    // All attempts failed; create an error placeholder SVG
    console.error(`Failed to download image after ${maxAttempts} attempts:`, lastError);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
      <rect width="100%" height="100%" fill="#1a1f2e"/>
      <text x="50%" y="50%" font-family="sans-serif" font-size="32" fill="#ff6b6b" text-anchor="middle">
        Failed to download generated image
      </text>
      <text x="50%" y="60%" font-family="sans-serif" font-size="24" fill="#cbd5e1" text-anchor="middle">
        ${prompt ? `Prompt: ${prompt.substring(0, 80)}${prompt.length > 80 ? '…' : ''}` : 'No prompt'}
      </text>
    </svg>`;
    buf = Buffer.from(svg, 'utf-8');
    mime = "image/svg+xml";
  }

  // Save the buffer (real image or error placeholder) as an asset
  return saveImageBuffer(buf, mime, userId, prompt, size);
}

async function saveImageBuffer(buf: Buffer, mime: string, userId?: string, prompt?: string, size?: string) {
  const sha = crypto.createHash("sha256").update(buf).digest("hex");
  // Convert Buffer to Uint8Array for Prisma compatibility
  const bytes = Uint8Array.from(buf);
  // Try to reuse if asset already exists (dedupe)
  const existing = await prisma.asset.findUnique({ where: { sha256: sha } }).catch(() => null);
  if (existing) {
    // If asset exists, still create a generation record for this user if needed
    if (userId && prompt) {
      await prisma.generation.create({
        data: {
          caption: prompt,
          imagePrompt: prompt,
          size: size || null,
          assetId: existing.id,
          userId,
        },
      }).catch(() => null); // ignore duplicate generation errors
    }
    return `/api/assets/${existing.id}`;
  }
  const created = await prisma.asset.create({
    data: {
      mime,
      bytes,
      size: buf.length,
      sha256: sha,
      userId: userId || null,
    },
  });
  // Create generation record
  if (userId && prompt) {
    await prisma.generation.create({
      data: {
        caption: prompt,
        imagePrompt: prompt,
        size: size || null,
        assetId: created.id,
        userId,
      },
    }).catch(() => null);
  }
  return `/api/assets/${created.id}`;
}
