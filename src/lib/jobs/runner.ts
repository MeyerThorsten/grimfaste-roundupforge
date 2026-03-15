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
import { extractProductLinks } from '@/lib/scraping/search-extractor';
import { extractProduct } from '@/lib/scraping/product-extractor';
import { getScraper } from '@/lib/scraping/get-scraper';
import { getProjectWithKeywords } from '@/lib/services/project.service';
import { writeResults, writeStatusSheet, isConfigured } from '@/lib/sheets/google-sheets';
import { ScrapeProfileData } from '@/types';

const CONCURRENCY = 2;
const DELAY_MS = 1500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runProject(projectId: number, retryOnly = false, sheetsSpreadsheetId?: string) {
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

  const limiter = pLimit(CONCURRENCY);
  const scraper = getScraper();

  const tasks = keywords.map((kw) =>
    limiter(async () => {
      await processKeyword(kw.id, kw.keyword, profile, project.productsPerKeyword, projectId, scraper);
      await delay(DELAY_MS);
    })
  );

  await Promise.all(tasks);

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
      // Don't fail the batch because of a Sheets sync error
    }
  }
}

async function processKeyword(
  kwId: number,
  keyword: string,
  profile: ScrapeProfileData,
  maxProducts: number,
  projectId: number,
  scraper: ReturnType<typeof getScraper>
) {
  const startTime = Date.now();
  logger.info('Processing keyword', { kwId, keyword });

  try {
    await updateKeywordResult(kwId, { status: 'running' });

    // Build search URL
    const searchUrl = buildSearchUrl(keyword, profile.domain);
    await updateKeywordResult(kwId, { searchUrl });

    // Fetch search results
    const searchHtml = await scraper.fetchPage(searchUrl);
    const links = extractProductLinks(searchHtml, maxProducts);
    logger.info('Found product links', { kwId, count: links.length });

    if (links.length === 0) {
      await updateKeywordResult(kwId, { status: 'success', errorMessage: 'No products found in search results' });
      await incrementProjectProgress(projectId, true);
      return;
    }

    // Clear old products for retry scenarios
    await deleteProductsByKeyword(kwId);

    // Extract each product
    for (const link of links) {
      try {
        const product = await extractProduct(link, profile, scraper);
        await insertProduct(kwId, product);
        await delay(DELAY_MS);
      } catch (err) {
        logger.error('Product extraction failed', { kwId, url: link.url, error: String(err) });
      }
    }

    await updateKeywordResult(kwId, { status: 'success' });
    await incrementProjectProgress(projectId, true);
    logger.info('Keyword completed', { kwId, elapsed: Date.now() - startTime });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('Keyword failed', { kwId, error: errorMessage });
    await updateKeywordResult(kwId, { status: 'failed', errorMessage });
    await incrementProjectProgress(projectId, false);
  }
}
