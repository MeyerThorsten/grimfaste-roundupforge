import { ScraperAdapter } from './adapter';
import { ScrapeOwlAdapter } from './scrapeowl.adapter';
import { ScraperApiAdapter } from './scraperapi.adapter';
import { ScrapingBeeAdapter } from './scrapingbee.adapter';
import { ZenRowsAdapter } from './zenrows.adapter';
import { DataForSeoAdapter } from './dataforseo.adapter';
import { PoolAdapter } from './pool.adapter';
import { logger } from '@/lib/utils/logger';

let instance: ScraperAdapter | null = null;

function isEnabled(enabledVar: string): boolean {
  const val = process.env[enabledVar];
  if (val === undefined) return true; // default enabled if not set
  return val === 'true' || val === '1';
}

export function getScraper(): ScraperAdapter {
  if (instance) return instance;

  let primary: ScraperAdapter | null = null;
  const fallbacks: ScraperAdapter[] = [];

  // ScrapeOwl — always primary when configured and enabled
  if (process.env.SCRAPEOWL_API_KEY && isEnabled('SCRAPEOWL_ENABLED')) {
    primary = new ScrapeOwlAdapter(process.env.SCRAPEOWL_API_KEY);
  }

  // ScraperAPI
  if (process.env.SCRAPERAPI_API_KEY && isEnabled('SCRAPERAPI_ENABLED')) {
    const adapter = new ScraperApiAdapter(process.env.SCRAPERAPI_API_KEY);
    if (!primary) primary = adapter;
    else fallbacks.push(adapter);
  }

  // ScrapingBee
  if (process.env.SCRAPINGBEE_API_KEY && isEnabled('SCRAPINGBEE_ENABLED')) {
    const adapter = new ScrapingBeeAdapter(process.env.SCRAPINGBEE_API_KEY);
    if (!primary) primary = adapter;
    else fallbacks.push(adapter);
  }

  // ZenRows
  if (process.env.ZENROWS_API_KEY && isEnabled('ZENROWS_ENABLED')) {
    const adapter = new ZenRowsAdapter(process.env.ZENROWS_API_KEY);
    if (!primary) primary = adapter;
    else fallbacks.push(adapter);
  }

  // DataForSEO
  if (process.env.DATAFORSEO_API_LOGIN && process.env.DATAFORSEO_API_PASSWORD && isEnabled('DATAFORSEO_ENABLED')) {
    const adapter = new DataForSeoAdapter(process.env.DATAFORSEO_API_LOGIN, process.env.DATAFORSEO_API_PASSWORD);
    if (!primary) primary = adapter;
    else fallbacks.push(adapter);
  }

  if (!primary) {
    throw new Error(
      'No scraper API keys configured or all scrapers are disabled. ' +
      'Go to Settings to configure at least one scraper.'
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
