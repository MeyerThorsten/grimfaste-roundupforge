import { ScraperAdapter } from './adapter';
import { ScrapeOwlAdapter } from './scrapeowl.adapter';
import { ScraperApiAdapter } from './scraperapi.adapter';
import { ScrapingBeeAdapter } from './scrapingbee.adapter';
import { ZenRowsAdapter } from './zenrows.adapter';
import { PoolAdapter } from './pool.adapter';
import { logger } from '@/lib/utils/logger';

let instance: ScraperAdapter | null = null;

export function getScraper(): ScraperAdapter {
  if (instance) return instance;

  // Primary adapter — the one with the paid subscription
  let primary: ScraperAdapter | null = null;
  const fallbacks: ScraperAdapter[] = [];

  // ScrapeOwl is always primary when configured (paid subscription)
  if (process.env.SCRAPEOWL_API_KEY) {
    primary = new ScrapeOwlAdapter(process.env.SCRAPEOWL_API_KEY);
  }

  // Others are fallbacks (free tiers — only used when primary fails)
  if (process.env.SCRAPERAPI_API_KEY) {
    const adapter = new ScraperApiAdapter(process.env.SCRAPERAPI_API_KEY);
    if (!primary) primary = adapter;
    else fallbacks.push(adapter);
  }

  if (process.env.SCRAPINGBEE_API_KEY) {
    const adapter = new ScrapingBeeAdapter(process.env.SCRAPINGBEE_API_KEY);
    if (!primary) primary = adapter;
    else fallbacks.push(adapter);
  }

  if (process.env.ZENROWS_API_KEY) {
    const adapter = new ZenRowsAdapter(process.env.ZENROWS_API_KEY);
    if (!primary) primary = adapter;
    else fallbacks.push(adapter);
  }

  if (!primary) {
    throw new Error(
      'No scraper API keys configured. Set at least one of: ' +
      'SCRAPEOWL_API_KEY, SCRAPERAPI_API_KEY, SCRAPINGBEE_API_KEY, ZENROWS_API_KEY'
    );
  }

  if (fallbacks.length === 0) {
    instance = primary;
    logger.info('Using single scraper', { adapter: instance.getName() });
  } else {
    instance = new PoolAdapter(primary, fallbacks);
    logger.info('Using scraper pool', {
      primary: primary.getName(),
      fallbacks: fallbacks.map((a) => a.getName()),
    });
  }

  return instance;
}

export function resetScraper() {
  instance = null;
}
