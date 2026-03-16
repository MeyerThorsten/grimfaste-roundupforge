import { ScraperAdapter, FetchOptions } from './adapter';
import { logger } from '@/lib/utils/logger';

/**
 * DataForSEO adapter — https://dataforseo.com
 * Uses the On-Page API to fetch rendered HTML.
 * Auth: login + password (API credentials from dashboard).
 * Stored as DATAFORSEO_API_LOGIN and DATAFORSEO_API_PASSWORD.
 */
export class DataForSeoAdapter implements ScraperAdapter {
  private login: string;
  private password: string;
  private timeoutMs: number;

  constructor(login: string, password: string, timeoutMs = 60_000) {
    this.login = login;
    this.password = password;
    this.timeoutMs = timeoutMs;
  }

  getName(): string {
    return 'DataForSEO';
  }

  async fetchPage(url: string, options?: FetchOptions): Promise<string> {
    const startTime = Date.now();
    const auth = Buffer.from(`${this.login}:${this.password}`).toString('base64');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      // Use the On-Page API instant pages endpoint
      const response = await fetch('https://api.dataforseo.com/v3/on_page/instant_pages', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          {
            url,
            enable_javascript: options?.renderJs ?? true,
            custom_user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        ]),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`DataForSEO returned ${response.status}: ${body.slice(0, 200)}`);
      }

      const data = await response.json();
      const elapsed = Date.now() - startTime;

      // Navigate the DataForSEO response structure
      const task = data?.tasks?.[0];
      if (!task || task.status_code !== 20000) {
        const msg = task?.status_message || 'Unknown error';
        throw new Error(`DataForSEO task error: ${msg}`);
      }

      const result = task.result?.[0];
      const html = result?.items?.[0]?.page_content || result?.items?.[0]?.html || '';

      logger.info('DataForSEO response', { url: url.slice(0, 80), elapsed, htmlLength: html.length });

      if (!html || html.length < 1000) {
        throw new Error('DataForSEO returned insufficient HTML');
      }

      return html;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`DataForSEO timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}
