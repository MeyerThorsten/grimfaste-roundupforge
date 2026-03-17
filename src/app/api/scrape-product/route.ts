import { NextRequest, NextResponse } from "next/server";
import { extractProduct } from "@/lib/scraping/product-extractor";
import { getScraper } from "@/lib/scraping/get-scraper";
import { prisma } from "@/lib/prisma";
import type { ProductLink, ScrapeProfileData } from "@/types";

/**
 * POST /api/scrape-product
 *
 * Scrapes a single Amazon product page and returns extracted data.
 * Used by DojoClaw to enrich products that were scraped in fast mode.
 *
 * Body: {
 *   url: string,           // Amazon product URL
 *   asin: string,          // Product ASIN
 *   title?: string,        // Product title (fallback)
 *   imageUrl?: string,     // Product image (fallback)
 *   profileId?: number,    // Scrape profile ID (default: first enabled)
 * }
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { url, asin, title, imageUrl, profileId } = body;

  if (!url || !asin) {
    return NextResponse.json(
      { error: "url and asin are required" },
      { status: 400 }
    );
  }

  try {
    // Get scrape profile
    let profile;
    if (profileId) {
      profile = await prisma.scrapeProfile.findUnique({ where: { id: profileId } });
    } else {
      profile = await prisma.scrapeProfile.findFirst({ where: { enabled: true } });
    }

    if (!profile) {
      return NextResponse.json(
        { error: "No scrape profile found" },
        { status: 404 }
      );
    }

    // Parse textSelectors from JSON string
    const profileData: ScrapeProfileData = {
      ...profile,
      textSelectors: JSON.parse(profile.textSelectors),
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };

    // Get scraper adapter
    const scraper = getScraper();

    // Build product link
    const link: ProductLink = {
      url,
      asin,
      title: title || "",
      imageUrl: imageUrl || "",
      position: 0,
    };

    // Extract product data
    const product = await extractProduct(link, profileData, scraper);

    return NextResponse.json(product);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Scrape failed" },
      { status: 500 }
    );
  }
}
