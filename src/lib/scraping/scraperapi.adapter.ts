import { ScraperAdapter, FetchOptions } from './adapter';
import { logger } from '@/lib/utils/logger';

/**
 * ScraperAPI adapter — https://www.scraperapi.com
 * Free tier: 5,000 credits/month, 5 concurrent requests
 * Amazon pages cost 10 credits each with render=true
 */
export class ScraperApiAdapter implements ScraperAdapter {
  private apiKey: string;
  private timeoutMs: number;

  constructor(apiKey: string, timeoutMs = 60_000) {
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  getName(): string {
    return 'ScraperAPI';
  }

  async fetchPage(url: string, options?: FetchOptions): Promise<string> {
    const renderJs = options?.renderJs ?? true;
    const startTime = Date.now();

    const params = new URLSearchParams({
      api_key: this.apiKey,
      url,
      country_code: options?.country || 'us',
    });
    if (renderJs) params.set('render', 'true');
    // Premium for Amazon
    params.set('premium', 'true');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`https://api.scraperapi.com?${params}`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`ScraperAPI returned ${response.status}: ${body.slice(0, 200)}`);
      }

      const html = await response.text();
      const elapsed = Date.now() - startTime;
      logger.info('ScraperAPI response', { url: url.slice(0, 80), elapsed, htmlLength: html.length });

      if (!html || html.length < 1000) {
        throw new Error('ScraperAPI returned insufficient HTML');
      }

      return html;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`ScraperAPI timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}
