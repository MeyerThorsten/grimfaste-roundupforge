import { ScraperAdapter, FetchOptions } from './adapter';
import { logger } from '@/lib/utils/logger';
import { classifyHttpError, TimeoutError, EmptyResponseError } from './errors';

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
    params.set('premium', 'true');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`https://api.scraperapi.com?${params}`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw classifyHttpError('ScraperAPI', response.status, body, response.headers.get('retry-after'));
      }

      const html = await response.text();
      const elapsed = Date.now() - startTime;
      logger.info('ScraperAPI response', { url: url.slice(0, 80), elapsed, htmlLength: html.length });

      if (!html || html.length < 1000) {
        throw new EmptyResponseError('ScraperAPI');
      }

      if (options?.onCredit) options.onCredit(1);
      return html;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new TimeoutError('ScraperAPI', url, this.timeoutMs);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}
