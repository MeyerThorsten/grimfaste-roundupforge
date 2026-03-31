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
import { insertProduct, deleteProductsByKeyword, countProductsByKeyword } from '@/lib/services/product.service';
import { buildSearchUrl, extractAsin } from '@/lib/scraping/url-builder';
import { extractProductLinks, detectBlockedPage } from '@/lib/scraping/search-extractor';
import { getCountryForDomain } from '@/lib/scraping/amazon-domains';
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

  const runStartTime = Date.now();
  await updateProjectStatus(projectId, 'running');
  logger.info('Project started', { projectId, retryOnly });

  const keywords = await getPendingKeywords(projectId);
  if (keywords.length === 0) {
    await updateProjectStatus(projectId, 'completed');
    logger.info('Project completed — no pending keywords', { projectId });
    return;
  }

  const maxConcurrency = parseInt(process.env.MAX_CONCURRENCY || '45', 10);
  const concurrency = Math.min(project.concurrency || 20, maxConcurrency);
  logger.info('Runner concurrency', { concurrency, maxConcurrency, projectId });
  const limiter = pLimit(concurrency);
  const scraper = getScraper();

  const isFastMode = project.scrapeMode === 'fast';
  const rMin = project.randomMin || 5;
  const tasks = keywords.map((kw) =>
    limiter(async () => {
      if (isCancelled(projectId)) return;
      const hasDirectUrls = !!kw.productUrls;
      // For direct-URL keywords, ignore productsPerKeyword and randomProducts
      const maxProducts = hasDirectUrls
        ? 0 // unused — direct mode scrapes all provided URLs
        : project.randomProducts
          ? Math.floor(Math.random() * (project.productsPerKeyword - rMin + 1)) + rMin
          : project.productsPerKeyword;
      await processKeyword(kw.id, kw.keyword, profile, maxProducts, projectId, scraper, isFastMode, kw.productUrls);
      await delay(DELAY_MS);
    })
  );

  await Promise.all(tasks);

  // Clean up cancellation flag
  const wasCancelled = isCancelled(projectId);
  clearCancellation(projectId);

  // Accumulate elapsed time from this run
  const runElapsed = Date.now() - runStartTime;
  await addElapsedTime(projectId, runElapsed);

  if (wasCancelled) {
    const { resetCount } = await resetRunningKeywords(projectId);
    await updateProjectStatus(projectId, 'failed');
    logger.info('Project stopped by user', { projectId, keywordsReset: resetCount, runElapsed });
    return;
  }

  // Auto-retry failed keywords
  const maxRetries = parseInt(process.env.RETRY_FAILED_COUNT || '4', 10);
  let updated = await getProject(projectId);
  let lastCheckpoint = Date.now();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (!updated || updated.failedKeywords === 0) break;
    if (isCancelled(projectId)) break;

    logger.info(`Retry ${attempt}/${maxRetries}: ${updated.failedKeywords} failed keywords, waiting 30s`, { projectId });
    await updateProjectStatus(projectId, `retrying ${attempt}/${maxRetries}`);

    // Wait 30 seconds before retry
    for (let s = 0; s < 30; s++) {
      if (isCancelled(projectId)) break;
      await delay(1000);
    }
    if (isCancelled(projectId)) break;

    // Reset failed keywords and re-process them
    await resetFailedKeywords(projectId);
    await updateProjectStatus(projectId, 'running');

    const retryKeywords = await getPendingKeywords(projectId);
    if (retryKeywords.length === 0) break;

    const retryTasks = retryKeywords.map((kw) =>
      limiter(async () => {
        if (isCancelled(projectId)) return;
        const hasDirectUrls = !!kw.productUrls;
        const maxProducts = hasDirectUrls
          ? 0
          : project.randomProducts
            ? Math.floor(Math.random() * (project.productsPerKeyword - rMin + 1)) + rMin
            : project.productsPerKeyword;
        await processKeyword(kw.id, kw.keyword, profile, maxProducts, projectId, scraper, isFastMode, kw.productUrls);
        await delay(DELAY_MS);
      })
    );

    await Promise.all(retryTasks);

    const now = Date.now();
    await addElapsedTime(projectId, now - lastCheckpoint);
    lastCheckpoint = now;

    updated = await getProject(projectId);
    logger.info(`Retry ${attempt}/${maxRetries} finished`, { projectId, remainingFailed: updated?.failedKeywords });
  }

  // Clean up if cancelled during retry
  if (isCancelled(projectId)) {
    clearCancellation(projectId);
    const { resetCount } = await resetRunningKeywords(projectId);
    await updateProjectStatus(projectId, 'failed');
    logger.info('Project stopped by user during retry', { projectId, keywordsReset: resetCount });
    return;
  }

  // Determine final status
  updated = await getProject(projectId);
  const finalStatus = updated && updated.failedKeywords > 0 ? 'failed' : 'completed';
  await updateProjectStatus(projectId, finalStatus);
  logger.info('Project finished', { projectId, status: finalStatus, totalElapsed: updated?.elapsedMs || 0 });

  // Advance the queue — start next queued project if any
  try {
    const { processQueue } = await import('@/lib/jobs/queue-processor');
    await processQueue();
  } catch (err) {
    logger.error('Failed to advance queue', { projectId, error: String(err) });
  }

  // Auto-sync to Google Sheets if configured
  const projectRecord = await getProject(projectId);
  const targetSheet = sheetsSpreadsheetId || projectRecord?.sheetsSpreadsheetId || process.env.GOOGLE_SHEET_ID;
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

async function addElapsedTime(projectId: number, ms: number) {
  const { prisma } = await import('@/lib/prisma');
  await prisma.project.update({
    where: { id: projectId },
    data: { elapsedMs: { increment: ms } },
  });
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
  fastMode = false,
  productUrls: string | null = null
) {
  if (isCancelled(projectId)) return;

  const startTime = Date.now();
  logger.info('Processing keyword', { kwId, keyword });

  try {
    await updateKeywordResult(kwId, { status: 'running' });

    // Direct-URL mode: skip Amazon search, scrape provided product URLs
    if (productUrls) {
      const urls: string[] = JSON.parse(productUrls);
      const links = urls.map((url, i) => ({
        url,
        title: '',
        asin: extractAsin(url),
        imageUrl: '',
        position: i + 1,
      })).filter((link) => link.asin);

      logger.info('Direct-URL mode', { kwId, count: links.length });

      if (links.length === 0) {
        await updateKeywordResult(kwId, { status: 'failed', errorMessage: 'No valid ASINs found in provided URLs' });
        await incrementProjectProgress(projectId, false);
        return;
      }

      await deleteProductsByKeyword(kwId);

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

      if (isCancelled(projectId)) {
        await updateKeywordResult(kwId, { status: 'pending' });
        return;
      }

      const directProductCount = await countProductsByKeyword(kwId);
      if (directProductCount === 0) {
        await updateKeywordResult(kwId, { status: 'failed', errorMessage: 'All product extractions failed — 0 products saved' });
        await incrementProjectProgress(projectId, false);
      } else {
        await updateKeywordResult(kwId, { status: 'success' });
        await incrementProjectProgress(projectId, true);
      }
      logger.info('Keyword completed (direct)', { kwId, products: directProductCount, elapsed: Date.now() - startTime });
      return;
    }

    // Build search URL
    const searchUrl = buildSearchUrl(keyword, profile.domain);
    await updateKeywordResult(kwId, { searchUrl });

    if (isCancelled(projectId)) {
      await updateKeywordResult(kwId, { status: 'pending' });
      return;
    }

    // Fetch search results (with retry on blocked pages)
    const country = getCountryForDomain(profile.domain);
    let searchHtml = await scraper.fetchPage(searchUrl, { country });
    let blocked = detectBlockedPage(searchHtml);
    if (blocked) {
      logger.warn('Blocked page detected, retrying', { kwId, reason: blocked });
      await new Promise((r) => setTimeout(r, 5000));
      searchHtml = await scraper.fetchPage(searchUrl, { country });
      blocked = detectBlockedPage(searchHtml);
    }
    if (blocked) {
      await updateKeywordResult(kwId, { status: 'failed', errorMessage: blocked });
      await incrementProjectProgress(projectId, false);
      return;
    }

    const links = extractProductLinks(searchHtml, maxProducts, profile.domain);
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
          ? `https://www.${profile.domain}/dp/${link.asin}?tag=${profile.affiliateCode}`
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

    const productCount = await countProductsByKeyword(kwId);
    if (productCount === 0) {
      await updateKeywordResult(kwId, { status: 'failed', errorMessage: 'All product extractions failed — 0 products saved' });
      await incrementProjectProgress(projectId, false);
    } else {
      await updateKeywordResult(kwId, { status: 'success' });
      await incrementProjectProgress(projectId, true);
    }
    logger.info('Keyword completed', { kwId, products: productCount, elapsed: Date.now() - startTime });
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
