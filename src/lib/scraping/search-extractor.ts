import * as cheerio from 'cheerio';
import { ProductLink } from '@/types';

/**
 * Check if the HTML is a valid Amazon search page vs a captcha/block/error page.
 * Returns a reason string if blocked, or null if the page looks valid.
 */
export function detectBlockedPage(html: string): string | null {
  const lower = html.toLowerCase();
  if (lower.includes('captcha') && lower.includes('type the characters')) {
    return 'Amazon returned a CAPTCHA page';
  }
  if (lower.includes('sorry') && lower.includes('not a robot')) {
    return 'Amazon bot detection triggered';
  }
  if (html.length < 5000) {
    return `Page too short (${html.length} bytes) — likely blocked or error`;
  }
  return null;
}

export function extractProductLinks(html: string, limit: number, domain = 'amazon.com'): ProductLink[] {
  const $ = cheerio.load(html);
  const results: ProductLink[] = [];
  const seenAsins = new Set<string>();

  $('[data-component-type="s-search-result"]').each((_, el) => {
    if (results.length >= limit) return false;

    const $el = $(el);
    const asin = $el.attr('data-asin') || '';
    if (!asin || seenAsins.has(asin)) return;
    seenAsins.add(asin);

    // Title: try h2 > a first (old layout), then h2 > span (current layout)
    let title = '';
    const $h2Link = $el.find('h2 a').first();
    if ($h2Link.length && $h2Link.text().trim()) {
      title = $h2Link.text().trim();
    } else {
      title = $el.find('h2 span').first().text().trim();
    }
    if (!title) return;

    // URL: try h2 > a href, then any a[href*="/dp/"], then construct from ASIN
    let href = $h2Link.attr('href') || '';
    if (!href) {
      href = $el.find(`a[href*="/dp/${asin}"]`).first().attr('href') || '';
    }
    if (!href) {
      href = $el.find('a[href*="/dp/"]').first().attr('href') || '';
    }
    if (!href) {
      // Construct a direct product URL from the ASIN
      href = `/dp/${asin}`;
    }

    const url = href.startsWith('http') ? href : `https://www.${domain}${href}`;
    const imageUrl = $el.find('.s-image').first().attr('src') || '';

    results.push({ url, title, asin, imageUrl, position: results.length + 1 });
  });

  return results;
}
