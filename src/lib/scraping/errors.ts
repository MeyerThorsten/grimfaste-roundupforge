/**
 * Typed scraper errors for intelligent retry strategies.
 */

export class ScraperError extends Error {
  constructor(message: string, public readonly scraperName: string) {
    super(message);
    this.name = 'ScraperError';
  }
}

export class RateLimitError extends ScraperError {
  public readonly retryAfterMs: number | null;

  constructor(scraperName: string, message: string, retryAfterMs: number | null = null) {
    super(message, scraperName);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class BlockedError extends ScraperError {
  constructor(scraperName: string, message: string) {
    super(message, scraperName);
    this.name = 'BlockedError';
  }
}

export class TimeoutError extends ScraperError {
  constructor(scraperName: string, url: string, timeoutMs: number) {
    super(`${scraperName} timed out after ${timeoutMs}ms for ${url}`, scraperName);
    this.name = 'TimeoutError';
  }
}

export class ParseError extends ScraperError {
  constructor(scraperName: string, message: string) {
    super(message, scraperName);
    this.name = 'ParseError';
  }
}

export class AuthError extends ScraperError {
  constructor(scraperName: string, message: string) {
    super(message, scraperName);
    this.name = 'AuthError';
  }
}

export class EmptyResponseError extends ScraperError {
  constructor(scraperName: string) {
    super(`${scraperName} returned empty HTML`, scraperName);
    this.name = 'EmptyResponseError';
  }
}

/**
 * Classify an HTTP status code into a typed error.
 */
export function classifyHttpError(scraperName: string, status: number, body: string, retryAfterHeader?: string | null): ScraperError {
  if (status === 429) {
    const retryAfterMs = retryAfterHeader ? parseRetryAfter(retryAfterHeader) : null;
    return new RateLimitError(scraperName, `Rate limited (429): ${body.slice(0, 200)}`, retryAfterMs);
  }
  if (status === 401 || status === 403) {
    return new AuthError(scraperName, `Authentication failed (${status}): ${body.slice(0, 200)}`);
  }
  if (status === 529) {
    return new RateLimitError(scraperName, `API overloaded (529): ${body.slice(0, 200)}`, 30000);
  }
  return new ScraperError(`${scraperName} returned ${status}: ${body.slice(0, 200)}`, scraperName);
}

function parseRetryAfter(header: string): number {
  const seconds = parseInt(header, 10);
  if (!isNaN(seconds)) return seconds * 1000;
  const date = new Date(header);
  if (!isNaN(date.getTime())) return Math.max(0, date.getTime() - Date.now());
  return 30000;
}

/**
 * Check if an error is retryable.
 */
export function isRetryableError(err: unknown): boolean {
  if (err instanceof RateLimitError) return true;
  if (err instanceof TimeoutError) return true;
  if (err instanceof EmptyResponseError) return true;
  if (err instanceof ScraperError) {
    return err.message.includes('500') || err.message.includes('503');
  }
  return false;
}

/**
 * Get recommended retry delay for an error.
 */
export function getRetryDelay(err: unknown, attempt: number): number {
  if (err instanceof RateLimitError && err.retryAfterMs) {
    return err.retryAfterMs;
  }
  // Exponential backoff with jitter: min(baseDelay * 2^attempt + jitter, maxDelay)
  const baseDelay = 2000;
  const maxDelay = 30000;
  const jitter = Math.random() * 1000;
  return Math.min(baseDelay * Math.pow(2, attempt - 1) + jitter, maxDelay);
}
