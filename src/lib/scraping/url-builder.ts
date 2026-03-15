export function buildSearchUrl(keyword: string, domain: string): string {
  return `https://www.${domain}/s?k=${encodeURIComponent(keyword)}`;
}

export function extractAsin(url: string): string {
  const match = url.match(/\/dp\/([A-Z0-9]{10})/i) || url.match(/\/gp\/product\/([A-Z0-9]{10})/i);
  return match ? match[1] : '';
}

export function buildAffiliateUrl(productUrl: string, asin: string, affiliateCode: string): string {
  if (!affiliateCode) return productUrl;
  if (asin) {
    return `https://www.amazon.com/dp/${asin}?tag=${affiliateCode}`;
  }
  const separator = productUrl.includes('?') ? '&' : '?';
  return `${productUrl}${separator}tag=${affiliateCode}`;
}
