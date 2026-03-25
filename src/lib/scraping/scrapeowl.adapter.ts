import { ScraperAdapter, FetchOptions } from './adapter';
import { logger } from '@/lib/utils/logger';

const SCRAPEOWL_URL = 'https://api.scrapeowl.com/v1/scrape';
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 4000;

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

  async fetchPage(url: string, options?: FetchOptions): Promise<string> {
    const renderJs = options?.renderJs ?? false;
    const country = options?.country ?? 'us';
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
      try {
        return await this.doFetch(url, renderJs, attempt, country);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const isRetryable = lastError.message.includes('500') ||
                            lastError.message.includes('503') ||
                            lastError.message.includes('empty HTML');

        if (isRetryable && attempt <= MAX_RETRIES) {
          logger.warn('ScrapeOwl retrying', { url, attempt, error: lastError.message });
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          continue;
        }
        throw lastError;
      }
    }
    throw lastError!;
  }

  private async doFetch(url: string, renderJs: boolean, attempt: number, country = 'us'): Promise<string> {
    const startTime = Date.now();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(SCRAPEOWL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: this.apiKey,
          url,
          country,
          render_js: renderJs,
          json_response: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`ScrapeOwl returned ${response.status}: ${body.slice(0, 200)}`);
      }

      const data = await response.json();
      const elapsed = Date.now() - startTime;
      logger.info('ScrapeOwl response', { url: url.slice(0, 80), attempt, elapsed, renderJs, htmlLength: data.html?.length });

      if (!data.html) {
        throw new Error('ScrapeOwl returned empty HTML');
      }

      return data.html;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`ScrapeOwl timed out after ${this.timeoutMs}ms for ${url}`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}
