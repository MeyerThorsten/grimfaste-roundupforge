import { KeywordWithProducts } from '@/types';

const HEADERS = [
  'keyword',
  'position',
  'title',
  'asin',
  'productUrl',
  'affiliateUrl',
  'imageUrl',
  'featureBullets',
  'productDescription',
  'productFacts',
  'techDetails',
  'reviews',
  'mergedText',
];

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCSV(keywords: KeywordWithProducts[]): string {
  const rows: string[] = [HEADERS.join(',')];

  for (const kw of keywords) {
    for (const p of kw.products.filter((p) => !p.excluded)) {
      const row = [
        kw.keyword,
        String(p.position),
        p.title,
        p.asin,
        p.productUrl,
        p.affiliateUrl,
        p.imageUrl,
        p.featureBullets,
        p.productDescription,
        p.productFacts,
        p.techDetails,
        p.reviews,
        p.mergedText,
      ].map(escapeCsv);
      rows.push(row.join(','));
    }
  }

  return rows.join('\n');
}
