import pLimit from 'p-limit';
import { logger } from '@/lib/utils/logger';
import { getProfile } from '@/lib/services/profile.service';
import {
  getProject,
  updateProjectStatus,
  incrementProjectProgress,
  updateKeywordResult,
  getPendingKeywords,
  resetFailedKeywords,
} from '@/lib/services/project.service';
import { insertProduct, deleteProductsByKeyword } from '@/lib/services/product.service';
import { buildSearchUrl } from '@/lib/scraping/url-builder';
import { extractProductLinks, detectBlockedPage } from '@/lib/scraping/search-extractor';
import { extractProduct } from '@/lib/scraping/product-extractor';
import { getScraper } from '@/lib/scraping/get-scraper';
import { getProjectWithKeywords } from '@/lib/services/project.service';
import { writeResults, writeStatusSheet, isConfigured } from '@/lib/sheets/google-sheets';
import { isCancelled, clearCancellation } from '@/lib/jobs/cancel';
import { ScrapeProfileData } from '@/types';

const DELAY_MS = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runProject(projectId: number, retryOnly = false, sheetsSpreadsheetId?: string) {
  // Clear any previous cancellation for this project (in case of re-run)
  clearCancellation(projectId);

  const project = await getProject(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);

  const profile = await getProfile(project.profileId);
  if (!profile) throw new Error(`Profile ${project.profileId} not found`);

  if (retryOnly) {
    await resetFailedKeywords(projectId);
  }

  await updateProjectStatus(projectId, 'running');
  logger.info('Project started', { projectId, retryOnly });

  const keywords = await getPendingKeywords(projectId);
  if (keywords.length === 0) {
    await updateProjectStatus(projectId, 'completed');
    logger.info('Project completed — no pending keywords', { projectId });
    return;
  }

  const concurrency = project.concurrency || 20;
  logger.info('Runner concurrency', { concurrency, projectId });
  const limiter = pLimit(concurrency);
  const scraper = getScraper();

  const isFastMode = project.scrapeMode === 'fast';
  const tasks = keywords.map((kw) =>
    limiter(async () => {
      if (isCancelled(projectId)) return;
      // Determine product count: random between 5 and max, or fixed
      const maxProducts = project.randomProducts
        ? Math.floor(Math.random() * (project.productsPerKeyword - 5 + 1)) + 5
        : project.productsPerKeyword;
      await processKeyword(kw.id, kw.keyword, profile, maxProducts, projectId, scraper, isFastMode);
      await delay(DELAY_MS);
    })
  );

  await Promise.all(tasks);

  // Clean up cancellation flag
  const wasCancelled = isCancelled(projectId);
  clearCancellation(projectId);

  if (wasCancelled) {
    // Reset any keywords still marked "running" back to "pending"
    const { resetCount } = await resetRunningKeywords(projectId);
    await updateProjectStatus(projectId, 'failed');
    logger.info('Project stopped by user', { projectId, keywordsReset: resetCount });
    return;
  }

  // Determine final status
  const updated = await getProject(projectId);
  const finalStatus = updated && updated.failedKeywords > 0 ? 'failed' : 'completed';
  await updateProjectStatus(projectId, finalStatus);
  logger.info('Project finished', { projectId, status: finalStatus });

  // Auto-sync to Google Sheets if configured
  const targetSheet = sheetsSpreadsheetId || process.env.GOOGLE_SHEET_ID;
  if (targetSheet && isConfigured()) {
    try {
      const fullProject = await getProjectWithKeywords(projectId);
      if (fullProject) {
        await writeResults(targetSheet, fullProject.project.name, fullProject.keywords);
        await writeStatusSheet(targetSheet, fullProject.project.name, fullProject.keywords);
        logger.info('Auto-synced results to Google Sheets', { projectId, spreadsheetId: targetSheet });
      }
    } catch (err) {
      logger.error('Failed to auto-sync to Google Sheets', { projectId, error: String(err) });
    }
  }
}

async function resetRunningKeywords(projectId: number): Promise<{ resetCount: number }> {
  const { prisma } = await import('@/lib/prisma');
  const result = await prisma.keywordResult.updateMany({
    where: { projectId, status: 'running' },
    data: { status: 'pending', errorMessage: null },
  });
  return { resetCount: result.count };
}

async function processKeyword(
  kwId: number,
  keyword: string,
  profile: ScrapeProfileData,
  maxProducts: number,
  projectId: number,
  scraper: ReturnType<typeof getScraper>,
  fastMode = false
) {
  if (isCancelled(projectId)) return;

  const startTime = Date.now();
  logger.info('Processing keyword', { kwId, keyword });

  try {
    await updateKeywordResult(kwId, { status: 'running' });

    // Build search URL
    const searchUrl = buildSearchUrl(keyword, profile.domain);
    await updateKeywordResult(kwId, { searchUrl });

    if (isCancelled(projectId)) {
      await updateKeywordResult(kwId, { status: 'pending' });
      return;
    }

    // Fetch search results (with retry on blocked pages)
    let searchHtml = await scraper.fetchPage(searchUrl);
    let blocked = detectBlockedPage(searchHtml);
    if (blocked) {
      logger.warn('Blocked page detected, retrying', { kwId, reason: blocked });
      await new Promise((r) => setTimeout(r, 5000));
      searchHtml = await scraper.fetchPage(searchUrl);
      blocked = detectBlockedPage(searchHtml);
    }
    if (blocked) {
      await updateKeywordResult(kwId, { status: 'failed', errorMessage: blocked });
      await incrementProjectProgress(projectId, false);
      return;
    }

    const links = extractProductLinks(searchHtml, maxProducts);
    logger.info('Found product links', { kwId, count: links.length });

    if (links.length === 0) {
      await updateKeywordResult(kwId, { status: 'failed', errorMessage: 'Search page loaded but no products found — Amazon may have returned an unusual layout' });
      await incrementProjectProgress(projectId, false);
      return;
    }

    // Clear old products for retry scenarios
    await deleteProductsByKeyword(kwId);

    if (fastMode) {
      // Fast mode: use search result data only — no product page visits
      for (const link of links) {
        const affiliateUrl = profile.affiliateCode
          ? `https://www.amazon.com/dp/${link.asin}?tag=${profile.affiliateCode}`
          : link.url;
        await insertProduct(kwId, {
          title: link.title,
          asin: link.asin,
          productUrl: link.url,
          affiliateUrl,
          imageUrl: link.imageUrl,
          featureBullets: '',
          productDescription: '',
          productFacts: '',
          techDetails: '',
          reviews: '',
          mergedText: '',
          scrapeDebug: { mode: 'fast', source: 'search-result' },
          position: link.position,
        });
      }
    } else {
      // Full mode: visit each product page for detailed extraction
      const productLimiter = pLimit(5);
      await Promise.all(
        links.map((link) =>
          productLimiter(async () => {
            if (isCancelled(projectId)) return;
            try {
              const product = await extractProduct(link, profile, scraper);
              await insertProduct(kwId, product);
            } catch (err) {
              logger.error('Product extraction failed', { kwId, url: link.url, error: String(err) });
            }
          })
        )
      );
    }

    if (isCancelled(projectId)) {
      await updateKeywordResult(kwId, { status: 'pending' });
      return;
    }

    await updateKeywordResult(kwId, { status: 'success' });
    await incrementProjectProgress(projectId, true);
    logger.info('Keyword completed', { kwId, elapsed: Date.now() - startTime });
  } catch (err) {
    if (isCancelled(projectId)) {
      await updateKeywordResult(kwId, { status: 'pending' });
      return;
    }
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('Keyword failed', { kwId, error: errorMessage });
    await updateKeywordResult(kwId, { status: 'failed', errorMessage });
    await incrementProjectProgress(projectId, false);
  }
}
