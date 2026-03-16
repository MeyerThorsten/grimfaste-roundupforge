import { NextResponse } from 'next/server';

export async function GET() {
  const scrapers = [
    { name: 'ScrapeOwl', envVar: 'SCRAPEOWL_API_KEY', configured: Boolean(process.env.SCRAPEOWL_API_KEY) },
    { name: 'ScraperAPI', envVar: 'SCRAPERAPI_API_KEY', configured: Boolean(process.env.SCRAPERAPI_API_KEY) },
    { name: 'ScrapingBee', envVar: 'SCRAPINGBEE_API_KEY', configured: Boolean(process.env.SCRAPINGBEE_API_KEY) },
    { name: 'ZenRows', envVar: 'ZENROWS_API_KEY', configured: Boolean(process.env.ZENROWS_API_KEY) },
  ];

  const active = scrapers.filter((s) => s.configured);

  return NextResponse.json({
    mode: active.length > 1 ? 'pool' : 'single',
    activeCount: active.length,
    scrapers,
  });
}
