import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { filterByRelevance } from "@/lib/relevance-filter";
import { logger } from "@/lib/utils/logger";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectId = parseInt(id);
  const body = await request.json();
  const { keyword, threshold = 50, mode } = body;

  // Auto mode: run per-keyword filter for all keywords with progress tracking
  if (mode === "auto") {
    try {
      return await handleAutoRelevance(projectId);
    } catch (err) {
      console.error("Auto-relevance error:", err);
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

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

async function handleAutoRelevance(projectId: number) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (!project.relevanceFilter) {
    return NextResponse.json({ error: "Relevance filter not enabled" }, { status: 400 });
  }

  if (project.relevanceStatus === "running") {
    return NextResponse.json({ error: "Relevance filter already running" }, { status: 409 });
  }

  const keywordResults = await prisma.keywordResult.findMany({
    where: { projectId },
    include: { products: { where: { excluded: false } } },
  });

  const keywordsWithProducts = keywordResults.filter((kw) => kw.products.length > 0);
  await prisma.project.update({
    where: { id: projectId },
    data: { relevanceStatus: "running", relevanceProgress: 0, relevanceTotal: keywordsWithProducts.length, relevanceError: "" },
  });
  logger.info("Running auto-relevance filter", { projectId, threshold: project.relevanceThreshold, totalKeywords: keywordsWithProducts.length });

  let totalDropped = 0;
  let progress = 0;
  let failedKeywords = 0;
  let lastError = "";

  for (const kw of keywordsWithProducts) {
    try {
      const products = kw.products.map((p) => ({ id: p.id, asin: p.asin, title: p.title }));
      const result = await filterByRelevance(kw.keyword, products, project.relevanceThreshold);
      if (result.dropped.length > 0) {
        await prisma.product.updateMany({
          where: { id: { in: result.dropped.map((p) => p.id) } },
          data: { excluded: true },
        });
        totalDropped += result.dropped.length;
      }
    } catch (kwErr) {
      failedKeywords++;
      lastError = String(kwErr);
      logger.warn("Relevance filter failed for keyword", { projectId, keyword: kw.keyword, error: lastError });
    }
    progress++;
    await prisma.project.update({
      where: { id: projectId },
      data: { relevanceProgress: progress },
    });
  }

  if (failedKeywords > 0 && failedKeywords === keywordsWithProducts.length) {
    await prisma.project.update({
      where: { id: projectId },
      data: { relevanceStatus: "failed", relevanceDropped: totalDropped, relevanceError: lastError },
    });
    logger.error("Auto-relevance filter failed for all keywords", { projectId, error: lastError });
    return NextResponse.json({ ok: false, error: lastError, dropped: totalDropped });
  }

  await prisma.project.update({
    where: { id: projectId },
    data: {
      relevanceStatus: "done",
      relevanceDropped: totalDropped,
      relevanceError: failedKeywords > 0 ? `${failedKeywords} keyword(s) failed: ${lastError}` : "",
    },
  });
  logger.info("Auto-relevance filter completed", { projectId, dropped: totalDropped, failedKeywords });
  return NextResponse.json({ ok: true, dropped: totalDropped, failedKeywords });
}
