export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/prisma";

const querySchema = z.object({
  companyId: z.string().min(1, "companyId is required"),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      companyId: url.searchParams.get("companyId"),
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten() }, { status: 400 });
    }

    const { companyId } = parsed.data;

    // Get company products
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { products: true },
    });

    if (!company?.products) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    // Parse products from company text field
    const productList = company.products.split(',').map((title: string, idx: number) => ({
      id: `prod-${idx}`,
      title: title.trim(),
      handle: null,
      imageUrl: null,
      shopifyId: null,
      price: null,
      currency: null,
    }));

    return NextResponse.json({ items: productList }, { status: 200 });
  } catch (err) {
    console.error("GET /api/products/by-shopify-id error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
