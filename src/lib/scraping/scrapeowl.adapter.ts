import { ScraperAdapter } from './adapter';
import { logger } from '@/lib/utils/logger';

const SCRAPEOWL_URL = 'https://api.scrapeowl.com/v1/scrape';

export class ScrapeOwlAdapter implements ScraperAdapter {
  private apiKey: string;
  private timeoutMs: number;

  constructor(apiKey: string, timeoutMs = 60_000) {
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  getName(): string {
    return 'ScrapeOwl';
  }

  async fetchPage(url: string): Promise<string> {
    const startTime = Date.now();
    logger.info('ScrapeOwl request', { url });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(SCRAPEOWL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: this.apiKey,
          url,
          render_js: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`ScrapeOwl returned ${response.status}: ${body.slice(0, 200)}`);
      }

      const data = await response.json();
      const elapsed = Date.now() - startTime;
      logger.info('ScrapeOwl response', { url, elapsed, htmlLength: data.html?.length });

      if (!data.html) {
        throw new Error('ScrapeOwl returned empty HTML');
      }

      return data.html;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`ScrapeOwl request timed out after ${this.timeoutMs}ms for ${url}`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}
