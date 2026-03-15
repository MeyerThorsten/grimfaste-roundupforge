import * as cheerio from 'cheerio';
import { ProductLink } from '@/types';

export function extractProductLinks(html: string, limit: number): ProductLink[] {
  const $ = cheerio.load(html);
  const results: ProductLink[] = [];
  const seenAsins = new Set<string>();

  $('[data-component-type="s-search-result"]').each((_, el) => {
    if (results.length >= limit) return false;

    const $el = $(el);
    const asin = $el.attr('data-asin') || '';
    if (!asin || seenAsins.has(asin)) return;
    seenAsins.add(asin);

    const $link = $el.find('h2 a').first();
    const href = $link.attr('href') || '';
    const title = $link.text().trim();
    if (!title) return;

    const url = href.startsWith('/') ? `https://www.amazon.com${href}` : href;
    const imageUrl = $el.find('.s-image').first().attr('src') || '';

    results.push({ url, title, asin, imageUrl, position: results.length + 1 });
  });

  return results;
}
