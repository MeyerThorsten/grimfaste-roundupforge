import { ScraperAdapter, FetchOptions } from './adapter';
import { logger } from '@/lib/utils/logger';

/**
 * Pool adapter with a primary adapter and fallback adapters.
 *
 * - Always tries the primary adapter first
 * - Only falls back to secondary adapters if the primary fails
 * - Secondary adapters are tried in order until one succeeds
 */
export class PoolAdapter implements ScraperAdapter {
  private primary: ScraperAdapter;
  private fallbacks: ScraperAdapter[];

  constructor(primary: ScraperAdapter, fallbacks: ScraperAdapter[]) {
    this.primary = primary;
    this.fallbacks = fallbacks;
    logger.info('PoolAdapter initialized', {
      primary: primary.getName(),
      fallbacks: fallbacks.map((a) => a.getName()),
    });
  }

  getName(): string {
    const names = [this.primary.getName(), ...this.fallbacks.map((a) => a.getName())];
    return `Pool(${names.join('+')})`;
  }

  async fetchPage(url: string, options?: FetchOptions): Promise<string> {
    // Always try primary first
    try {
      return await this.primary.fetchPage(url, options);
    } catch (err) {
      const primaryError = err instanceof Error ? err.message : String(err);
      logger.warn('Primary scraper failed, trying fallbacks', {
        primary: this.primary.getName(),
        error: primaryError.slice(0, 100),
        fallbackCount: this.fallbacks.length,
      });

      // Try each fallback in order
      const errors: string[] = [`${this.primary.getName()}: ${primaryError}`];

      for (const fallback of this.fallbacks) {
        try {
          const html = await fallback.fetchPage(url, options);
          logger.info('Fallback scraper succeeded', {
            adapter: fallback.getName(),
            url: url.slice(0, 80),
          });
          return html;
        } catch (fbErr) {
          const msg = fbErr instanceof Error ? fbErr.message : String(fbErr);
          errors.push(`${fallback.getName()}: ${msg}`);
          logger.warn('Fallback scraper also failed', {
            adapter: fallback.getName(),
            error: msg.slice(0, 100),
          });
        }
      }

      throw new Error(
        `All scrapers failed for ${url}:\n${errors.join('\n')}`
      );
    }
  }
}
