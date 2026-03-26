import { extractAsin } from '@/lib/scraping/url-builder';

const AMAZON_URL_PATTERN = /^https?:\/\/(www\.)?amazon\.[\w.]+\/.*(\/dp\/|\/gp\/product\/)[A-Z0-9]{10}/i;

export interface KeywordGroup {
  keyword: string;
  urls: string[];
}

export interface ParseResult {
  groups: KeywordGroup[];
  errors: string[];
  keywordCount: number;
  productCount: number;
}

export function isAmazonUrl(line: string): boolean {
  return AMAZON_URL_PATTERN.test(line);
}

export function parseKeywordInput(text: string): ParseResult {
  const lines = text.split('\n');
  const groups: KeywordGroup[] = [];
  const errors: string[] = [];
  let currentGroup: KeywordGroup | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (isAmazonUrl(line)) {
      if (!currentGroup) {
        errors.push(`Line ${i + 1}: product URL has no keyword above it`);
        continue;
      }
      const asin = extractAsin(line);
      if (!asin) {
        errors.push(`Line ${i + 1}: could not extract ASIN from URL`);
        continue;
      }
      // Deduplicate by ASIN within group
      const existingAsins = currentGroup.urls.map((u) => extractAsin(u));
      if (!existingAsins.includes(asin)) {
        currentGroup.urls.push(line);
      }
    } else {
      currentGroup = { keyword: line, urls: [] };
      groups.push(currentGroup);
    }
  }

  const productCount = groups.reduce((sum, g) => sum + g.urls.length, 0);

  return {
    groups,
    errors,
    keywordCount: groups.length,
    productCount,
  };
}
