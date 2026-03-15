import { ScraperAdapter } from './adapter';
import { ScrapeOwlAdapter } from './scrapeowl.adapter';

let instance: ScraperAdapter | null = null;

export function getScraper(): ScraperAdapter {
  if (instance) return instance;

  const key = process.env.SCRAPEOWL_API_KEY;
  if (!key) throw new Error('SCRAPEOWL_API_KEY environment variable is not set');

  instance = new ScrapeOwlAdapter(key);
  return instance;
}
