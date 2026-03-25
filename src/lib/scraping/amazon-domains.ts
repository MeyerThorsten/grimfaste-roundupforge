/**
 * Amazon marketplace domains mapped to country codes and labels.
 */

export interface AmazonMarketplace {
  domain: string;
  country: string;  // ISO 2-letter for ScrapeOwl proxy routing
  label: string;
  lang: string;     // Accept-Language header value
}

export const AMAZON_MARKETPLACES: AmazonMarketplace[] = [
  { domain: 'amazon.com',    country: 'us', label: 'United States',  lang: 'en-US,en;q=0.9' },
  { domain: 'amazon.co.uk',  country: 'gb', label: 'United Kingdom', lang: 'en-GB,en;q=0.9' },
  { domain: 'amazon.de',     country: 'de', label: 'Germany',        lang: 'de-DE,de;q=0.9,en;q=0.5' },
  { domain: 'amazon.fr',     country: 'fr', label: 'France',         lang: 'fr-FR,fr;q=0.9,en;q=0.5' },
  { domain: 'amazon.it',     country: 'it', label: 'Italy',          lang: 'it-IT,it;q=0.9,en;q=0.5' },
  { domain: 'amazon.es',     country: 'es', label: 'Spain',          lang: 'es-ES,es;q=0.9,en;q=0.5' },
  { domain: 'amazon.ca',     country: 'ca', label: 'Canada',         lang: 'en-CA,en;q=0.9' },
  { domain: 'amazon.com.au', country: 'au', label: 'Australia',      lang: 'en-AU,en;q=0.9' },
  { domain: 'amazon.co.jp',  country: 'jp', label: 'Japan',          lang: 'ja-JP,ja;q=0.9,en;q=0.5' },
  { domain: 'amazon.in',     country: 'in', label: 'India',          lang: 'en-IN,en;q=0.9' },
  { domain: 'amazon.com.br', country: 'br', label: 'Brazil',         lang: 'pt-BR,pt;q=0.9,en;q=0.5' },
  { domain: 'amazon.com.mx', country: 'mx', label: 'Mexico',         lang: 'es-MX,es;q=0.9,en;q=0.5' },
  { domain: 'amazon.nl',     country: 'nl', label: 'Netherlands',    lang: 'nl-NL,nl;q=0.9,en;q=0.5' },
  { domain: 'amazon.se',     country: 'se', label: 'Sweden',         lang: 'sv-SE,sv;q=0.9,en;q=0.5' },
  { domain: 'amazon.pl',     country: 'pl', label: 'Poland',         lang: 'pl-PL,pl;q=0.9,en;q=0.5' },
  { domain: 'amazon.com.be', country: 'be', label: 'Belgium',        lang: 'nl-BE,nl;q=0.9,fr;q=0.7,en;q=0.5' },
  { domain: 'amazon.sg',     country: 'sg', label: 'Singapore',      lang: 'en-SG,en;q=0.9' },
  { domain: 'amazon.sa',     country: 'sa', label: 'Saudi Arabia',   lang: 'ar-SA,ar;q=0.9,en;q=0.5' },
  { domain: 'amazon.ae',     country: 'ae', label: 'UAE',            lang: 'en-AE,en;q=0.9' },
  { domain: 'amazon.com.tr', country: 'tr', label: 'Turkey',         lang: 'tr-TR,tr;q=0.9,en;q=0.5' },
  { domain: 'amazon.eg',     country: 'eg', label: 'Egypt',          lang: 'ar-EG,ar;q=0.9,en;q=0.5' },
];

export function getMarketplace(domain: string): AmazonMarketplace | undefined {
  return AMAZON_MARKETPLACES.find((m) => m.domain === domain);
}

export function getCountryForDomain(domain: string): string {
  return getMarketplace(domain)?.country || 'us';
}

export function getLangForDomain(domain: string): string {
  return getMarketplace(domain)?.lang || 'en-US,en;q=0.9';
}
