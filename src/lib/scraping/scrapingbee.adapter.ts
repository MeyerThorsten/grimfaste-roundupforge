import { ScraperAdapter, FetchOptions } from './adapter';
import { logger } from '@/lib/utils/logger';

/**
 * ScrapingBee adapter — https://www.scrapingbee.com
 * Free trial: 1,000 credits
 * Premium proxy + JS rendering costs 25 credits per request
 */
export class ScrapingBeeAdapter implements ScraperAdapter {
  private apiKey: string;
  private timeoutMs: number;

  constructor(apiKey: string, timeoutMs = 60_000) {
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  getName(): string {
    return 'ScrapingBee';
  }

  async fetchPage(url: string, options?: FetchOptions): Promise<string> {
    const renderJs = options?.renderJs ?? true;
    const startTime = Date.now();

    const params = new URLSearchParams({
      api_key: this.apiKey,
      url,
      country_code: 'us',
      premium_proxy: 'true',
    });
    if (renderJs) params.set('render_js', 'true');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`https://app.scrapingbee.com/api/v1?${params}`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`ScrapingBee returned ${response.status}: ${body.slice(0, 200)}`);
      }

      const html = await response.text();
      const elapsed = Date.now() - startTime;
      logger.info('ScrapingBee response', { url: url.slice(0, 80), elapsed, htmlLength: html.length });

      if (!html || html.length < 1000) {
        throw new Error('ScrapingBee returned insufficient HTML');
      }

      return html;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`ScrapingBee timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}
