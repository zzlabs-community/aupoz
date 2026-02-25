export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/prisma";

const querySchema = z.object({
  companyId: z.string().min(1, "companyId is required"),
  q: z.string().optional(),
  take: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      companyId: url.searchParams.get("companyId"),
      q: url.searchParams.get("q") ?? undefined,
      take: url.searchParams.get("take") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten() }, { status: 400 });
    }

    const { companyId, q, take } = parsed.data;

    // Get company to access products (stored as text in Company model)
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { products: true, name: true, description: true },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Parse products from company text field
    let products: any[] = [];
    if (company.products) {
      const productList = company.products.split(',').map(p => p.trim()).filter(Boolean);
      products = productList.slice(0, take).map((title, idx) => ({
        id: `prod-${idx}`,
        title: title,
        handle: null,
        imageUrl: null,
        shopifyId: null,
        price: null,
        currency: null,
        createdAt: new Date(),
      }));
    }

    // Filter by query if provided
    if (q) {
      products = products.filter(p => p.title.toLowerCase().includes(q.toLowerCase()));
    }

    const nextCursor = products.length === take ? products[products.length - 1].id : null;
    return NextResponse.json({ items: products, nextCursor }, { status: 200 });
  } catch (err) {
    console.error("GET /api/products error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
