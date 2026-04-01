/**
 * Scrape lifecycle hooks — extensible event system for the scraping pipeline.
 *
 * Hooks are called at key points in the scraping process:
 * - preScrape: before each keyword is processed (can skip)
 * - postScrape: after each keyword completes with results
 * - onFailure: when a keyword fails with error context
 */

import { logger } from '@/lib/utils/logger';

export interface ScrapeHookContext {
  projectId: number;
  keywordId: number;
  keyword: string;
}

export interface PostScrapeContext extends ScrapeHookContext {
  productsFound: number;
  elapsed: number;
}

export interface FailureContext extends ScrapeHookContext {
  error: string;
  errorType: string;
}

export interface ScrapeHooks {
  preScrape?: (ctx: ScrapeHookContext) => Promise<{ skip?: boolean } | void>;
  postScrape?: (ctx: PostScrapeContext) => Promise<void>;
  onFailure?: (ctx: FailureContext) => Promise<void>;
}

// Default hooks — logging only
const defaultHooks: ScrapeHooks = {
  postScrape: async (ctx) => {
    logger.debug('Hook: keyword completed', {
      projectId: ctx.projectId,
      keyword: ctx.keyword,
      products: ctx.productsFound,
      elapsed: ctx.elapsed,
    });
  },
  onFailure: async (ctx) => {
    logger.debug('Hook: keyword failed', {
      projectId: ctx.projectId,
      keyword: ctx.keyword,
      errorType: ctx.errorType,
      error: ctx.error,
    });
  },
};

let activeHooks: ScrapeHooks = { ...defaultHooks };

export function setHooks(hooks: Partial<ScrapeHooks>) {
  activeHooks = { ...defaultHooks, ...hooks };
}

export function getHooks(): ScrapeHooks {
  return activeHooks;
}

export async function callPreScrape(ctx: ScrapeHookContext): Promise<boolean> {
  if (!activeHooks.preScrape) return true; // proceed
  try {
    const result = await activeHooks.preScrape(ctx);
    if (result?.skip) {
      logger.info('Hook: preScrape skipped keyword', { projectId: ctx.projectId, keyword: ctx.keyword });
      return false;
    }
  } catch (err) {
    logger.warn('Hook: preScrape error (continuing)', { error: String(err) });
  }
  return true;
}

export async function callPostScrape(ctx: PostScrapeContext): Promise<void> {
  if (!activeHooks.postScrape) return;
  try {
    await activeHooks.postScrape(ctx);
  } catch (err) {
    logger.warn('Hook: postScrape error', { error: String(err) });
  }
}

export async function callOnFailure(ctx: FailureContext): Promise<void> {
  if (!activeHooks.onFailure) return;
  try {
    await activeHooks.onFailure(ctx);
  } catch (err) {
    logger.warn('Hook: onFailure error', { error: String(err) });
  }
}
