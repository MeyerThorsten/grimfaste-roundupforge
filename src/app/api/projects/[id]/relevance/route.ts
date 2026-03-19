import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { filterByRelevance } from "@/lib/relevance-filter";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectId = parseInt(id);
  const body = await request.json();
  const { keyword, threshold = 50 } = body;

  if (!keyword) {
    return NextResponse.json({ error: "keyword is required" }, { status: 400 });
  }

  // Get all non-excluded products for this project
  const keywordResults = await prisma.keywordResult.findMany({
    where: { projectId },
    include: {
      products: {
        where: { excluded: false },
      },
    },
  });

  const products = keywordResults.flatMap((kw) =>
    kw.products.map((p) => ({
      id: p.id,
      asin: p.asin,
      title: p.title,
    }))
  );

  if (products.length === 0) {
    return NextResponse.json({ kept: 0, dropped: 0, message: "No products to filter" });
  }

  const result = await filterByRelevance(keyword, products, threshold);

  // Auto-exclude dropped products
  if (result.dropped.length > 0) {
    await prisma.product.updateMany({
      where: {
        id: { in: result.dropped.map((p) => p.id) },
      },
      data: { excluded: true },
    });
  }

  return NextResponse.json({
    kept: result.kept.length,
    dropped: result.dropped.length,
    droppedProducts: result.dropped.map((p) => ({
      id: p.id,
      title: p.title,
      asin: p.asin,
    })),
  });
}
