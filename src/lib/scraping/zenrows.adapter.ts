import { ScraperAdapter, FetchOptions } from './adapter';
import { logger } from '@/lib/utils/logger';

/**
 * ZenRows adapter — https://www.zenrows.com
 * Free tier: 1,000 credits
 * Premium proxy requests cost 5-25 credits
 */
export class ZenRowsAdapter implements ScraperAdapter {
  private apiKey: string;
  private timeoutMs: number;

  constructor(apiKey: string, timeoutMs = 60_000) {
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  getName(): string {
    return 'ZenRows';
  }

  async fetchPage(url: string, options?: FetchOptions): Promise<string> {
    const renderJs = options?.renderJs ?? true;
    const startTime = Date.now();

    const params = new URLSearchParams({
      apikey: this.apiKey,
      url,
    });
    if (renderJs) params.set('js_render', 'true');
    params.set('premium_proxy', 'true');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`https://api.zenrows.com/v1/?${params}`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`ZenRows returned ${response.status}: ${body.slice(0, 200)}`);
      }

      const html = await response.text();
      const elapsed = Date.now() - startTime;
      logger.info('ZenRows response', { url: url.slice(0, 80), elapsed, htmlLength: html.length });

      if (!html || html.length < 1000) {
        throw new Error('ZenRows returned insufficient HTML');
      }

      return html;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`ZenRows timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}
