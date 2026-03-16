import * as cheerio from 'cheerio';
import { ScraperAdapter } from './adapter';
import { normalizeText, dedupeTexts, buildMergedText } from './normalizer';
import { extractAsin, buildAffiliateUrl } from './url-builder';
import { ScrapeProfileData, ExtractedProduct, ProductLink } from '@/types';
import { logger } from '@/lib/utils/logger';

export async function extractProduct(
  link: ProductLink,
  profile: ScrapeProfileData,
  scraper: ScraperAdapter
): Promise<ExtractedProduct> {
  const debug: Record<string, unknown> = { url: link.url };

  let html: string;
  try {
    html = await scraper.fetchPage(link.url, { renderJs: false });
    debug.htmlLength = html.length;
  } catch (err) {
    logger.error('Failed to fetch product page', { url: link.url, error: String(err) });
    debug.fetchError = String(err);
    return makeEmptyProduct(link, profile, debug);
  }

  const $ = cheerio.load(html);
  const asin = link.asin || extractAsin(link.url);

  // Title
  const pageTitle = normalizeText($(profile.titleSelector).first().text());
  const title = pageTitle || link.title;

  // Image
  const imageUrl = $(profile.imageSelector).first().attr('src') || link.imageUrl;

  // Extract text sections
  const sectionTexts: Record<string, string> = {};
  const reviewTexts: string[] = [];

  for (const entry of profile.textSelectors) {
    const text = normalizeText($(entry.selector).first().text());
    if (!text) continue;
    sectionTexts[entry.label] = text;
    if (entry.treatAsReview || profile.treatAsReview) {
      reviewTexts.push(text);
    }
  }

  debug.selectorsMatched = Object.keys(sectionTexts);

  // Map to named fields
  const featureBullets = sectionTexts['Feature Bullets'] || '';
  const productDescription = sectionTexts['Description'] || '';
  const productFacts = sectionTexts['Product Facts'] || '';
  const techDetails = sectionTexts['Product Details'] || sectionTexts['Tech Specs'] || '';
  const reviews = reviewTexts.length > 0
    ? reviewTexts.join('\n\n')
    : (sectionTexts['Reviews'] || '');

  const allTexts = dedupeTexts(Object.values(sectionTexts));
  const mergedText = buildMergedText(allTexts);

  const affiliateUrl = buildAffiliateUrl(link.url, asin, profile.affiliateCode);

  return {
    title,
    asin,
    productUrl: link.url,
    affiliateUrl,
    imageUrl,
    featureBullets,
    productDescription,
    productFacts,
    techDetails,
    reviews,
    mergedText,
    scrapeDebug: debug,
    position: link.position,
  };
}

function makeEmptyProduct(
  link: ProductLink,
  profile: ScrapeProfileData,
  scrapeDebug: Record<string, unknown>
): ExtractedProduct {
  const asin = link.asin || extractAsin(link.url);
  return {
    title: link.title,
    asin,
    productUrl: link.url,
    affiliateUrl: buildAffiliateUrl(link.url, asin, profile.affiliateCode),
    imageUrl: link.imageUrl,
    featureBullets: '',
    productDescription: '',
    productFacts: '',
    techDetails: '',
    reviews: '',
    mergedText: '',
    scrapeDebug,
    position: link.position,
  };
}
