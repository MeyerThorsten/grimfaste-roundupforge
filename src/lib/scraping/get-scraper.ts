import { ScraperAdapter } from './adapter';
import { PoolAdapter } from './pool.adapter';
import { getConfiguredScrapers } from './registry';
import { logger } from '@/lib/utils/logger';

let instance: ScraperAdapter | null = null;

export function getScraper(): ScraperAdapter {
  if (instance) return instance;

  const configured = getConfiguredScrapers();

  if (configured.length === 0) {
    throw new Error(
      'No scraper API keys configured or all scrapers are disabled. ' +
      'Go to Settings to configure at least one scraper.'
    );
  }

  const adapters = configured.map((p) => p.createAdapter());
  const primary = adapters[0];
  const fallbacks = adapters.slice(1);

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
