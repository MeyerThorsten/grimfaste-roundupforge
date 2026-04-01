/**
 * Scraper plugin registry — extensible scraper backend system.
 */

import { ScraperAdapter } from './adapter';
import { logger } from '@/lib/utils/logger';

export interface ScraperPlugin {
  name: string;
  envVars: string[];
  enabledVar: string;
  isConfigured(): boolean;
  isEnabled(): boolean;
  createAdapter(): ScraperAdapter;
}

const registry: ScraperPlugin[] = [];

export function registerScraper(plugin: ScraperPlugin) {
  registry.push(plugin);
  logger.debug('Registered scraper plugin', { name: plugin.name });
}

export function getRegisteredScrapers(): ScraperPlugin[] {
  return [...registry];
}

export function getConfiguredScrapers(): ScraperPlugin[] {
  return registry.filter((p) => p.isConfigured() && p.isEnabled());
}

function isEnvEnabled(envVar: string): boolean {
  const val = process.env[envVar];
  if (val === undefined) return true;
  return val === 'true' || val === '1';
}

// Register all built-in scrapers
import { ScrapeOwlAdapter } from './scrapeowl.adapter';
import { ScraperApiAdapter } from './scraperapi.adapter';
import { ScrapingBeeAdapter } from './scrapingbee.adapter';
import { ZenRowsAdapter } from './zenrows.adapter';
import { DataForSeoAdapter } from './dataforseo.adapter';

registerScraper({
  name: 'ScrapeOwl',
  envVars: ['SCRAPEOWL_API_KEY'],
  enabledVar: 'SCRAPEOWL_ENABLED',
  isConfigured: () => !!process.env.SCRAPEOWL_API_KEY,
  isEnabled: () => isEnvEnabled('SCRAPEOWL_ENABLED'),
  createAdapter: () => new ScrapeOwlAdapter(process.env.SCRAPEOWL_API_KEY!),
});

registerScraper({
  name: 'ScraperAPI',
  envVars: ['SCRAPERAPI_API_KEY'],
  enabledVar: 'SCRAPERAPI_ENABLED',
  isConfigured: () => !!process.env.SCRAPERAPI_API_KEY,
  isEnabled: () => isEnvEnabled('SCRAPERAPI_ENABLED'),
  createAdapter: () => new ScraperApiAdapter(process.env.SCRAPERAPI_API_KEY!),
});

registerScraper({
  name: 'ScrapingBee',
  envVars: ['SCRAPINGBEE_API_KEY'],
  enabledVar: 'SCRAPINGBEE_ENABLED',
  isConfigured: () => !!process.env.SCRAPINGBEE_API_KEY,
  isEnabled: () => isEnvEnabled('SCRAPINGBEE_ENABLED'),
  createAdapter: () => new ScrapingBeeAdapter(process.env.SCRAPINGBEE_API_KEY!),
});

registerScraper({
  name: 'ZenRows',
  envVars: ['ZENROWS_API_KEY'],
  enabledVar: 'ZENROWS_ENABLED',
  isConfigured: () => !!process.env.ZENROWS_API_KEY,
  isEnabled: () => isEnvEnabled('ZENROWS_ENABLED'),
  createAdapter: () => new ZenRowsAdapter(process.env.ZENROWS_API_KEY!),
});

registerScraper({
  name: 'DataForSEO',
  envVars: ['DATAFORSEO_API_LOGIN', 'DATAFORSEO_API_PASSWORD'],
  enabledVar: 'DATAFORSEO_ENABLED',
  isConfigured: () => !!(process.env.DATAFORSEO_API_LOGIN && process.env.DATAFORSEO_API_PASSWORD),
  isEnabled: () => isEnvEnabled('DATAFORSEO_ENABLED'),
  createAdapter: () => new DataForSeoAdapter(process.env.DATAFORSEO_API_LOGIN!, process.env.DATAFORSEO_API_PASSWORD!),
});
