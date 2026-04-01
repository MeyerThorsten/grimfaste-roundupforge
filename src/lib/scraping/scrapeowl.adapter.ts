import { ScraperAdapter, FetchOptions } from './adapter';
import { logger } from '@/lib/utils/logger';
import {
  classifyHttpError, TimeoutError, EmptyResponseError,
  isRetryableError, getRetryDelay,
} from './errors';

const SCRAPEOWL_URL = 'https://api.scrapeowl.com/v1/scrape';
const MAX_RETRIES = 2;

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
        const html = await this.doFetch(url, renderJs, attempt, country);

        // Track credits (1 per base request)
        if (options?.onCredit) options.onCredit(1);

        return html;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (isRetryableError(err) && attempt <= MAX_RETRIES) {
          const delay = getRetryDelay(err, attempt);
          logger.warn('ScrapeOwl retrying', { url: url.slice(0, 80), attempt, error: lastError.message, delayMs: Math.round(delay) });
          await new Promise((r) => setTimeout(r, delay));
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
        const retryAfter = response.headers.get('retry-after');
        throw classifyHttpError('ScrapeOwl', response.status, body, retryAfter);
      }

      const data = await response.json();
      const elapsed = Date.now() - startTime;
      logger.info('ScrapeOwl response', { url: url.slice(0, 80), attempt, elapsed, renderJs, htmlLength: data.html?.length });

      if (!data.html) {
        throw new EmptyResponseError('ScrapeOwl');
      }

      return data.html;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new TimeoutError('ScrapeOwl', url, this.timeoutMs);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}
