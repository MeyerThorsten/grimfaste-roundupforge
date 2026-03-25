import { KeywordWithProducts } from '@/types';

/**
 * Export in roundup format:
 *
 * Best OLED TV deals Holidays 2026
 * https://www.amazon.com/dp/B0DYQM4BDB
 * https://www.amazon.com/dp/B0FFWW5BZZ
 * ...
 */
function keywordToBlock(kw: KeywordWithProducts, domain = 'amazon.com'): string | null {
  if (kw.products.length === 0) return null;

  const lines: string[] = [kw.keyword];
  for (const p of kw.products) {
    if (p.asin) {
      lines.push(`https://www.${domain}/dp/${p.asin}`);
    } else if (p.productUrl) {
      lines.push(p.productUrl);
    }
  }
  return lines.join('\n');
}

/**
 * Single roundup text from all keywords.
 */
export function toRoundup(keywords: KeywordWithProducts[], domain = 'amazon.com'): string {
  const blocks = keywords
    .map((kw) => keywordToBlock(kw, domain))
    .filter((b): b is string => b !== null);
  return blocks.join('\n\n') + '\n';
}

/**
 * Split keywords into packs of `packSize` and return an array of roundup texts.
 * Each pack contains up to `packSize` keyword roundups.
 */
export function toRoundupPacks(keywords: KeywordWithProducts[], packSize: number, domain = 'amazon.com'): string[] {
  const withProducts = keywords.filter((kw) => kw.products.length > 0);

  if (withProducts.length === 0) return [];
  if (packSize <= 0 || withProducts.length <= packSize) {
    return [toRoundup(withProducts, domain)];
  }

  const packs: string[] = [];
  for (let i = 0; i < withProducts.length; i += packSize) {
    const chunk = withProducts.slice(i, i + packSize);
    const blocks = chunk
      .map((kw) => keywordToBlock(kw, domain))
      .filter((b): b is string => b !== null);
    packs.push(blocks.join('\n\n') + '\n');
  }

  return packs;
}
