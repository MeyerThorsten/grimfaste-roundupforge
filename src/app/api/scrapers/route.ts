import { NextResponse } from 'next/server';
import { SCRAPEOWL_PLANS } from '@/app/api/settings/scrapers/route';

export async function GET() {
  const planId = process.env.SCRAPEOWL_PLAN || 'startup';
  const plan = SCRAPEOWL_PLANS.find((p) => p.id === planId) || SCRAPEOWL_PLANS[3]; // default startup

  const scrapers = [
    { name: 'ScrapeOwl', envVar: 'SCRAPEOWL_API_KEY', configured: Boolean(process.env.SCRAPEOWL_API_KEY) },
    { name: 'ScraperAPI', envVar: 'SCRAPERAPI_API_KEY', configured: Boolean(process.env.SCRAPERAPI_API_KEY) },
    { name: 'ScrapingBee', envVar: 'SCRAPINGBEE_API_KEY', configured: Boolean(process.env.SCRAPINGBEE_API_KEY) },
    { name: 'ZenRows', envVar: 'ZENROWS_API_KEY', configured: Boolean(process.env.ZENROWS_API_KEY) },
    { name: 'DataForSEO', envVar: 'DATAFORSEO_API_LOGIN', configured: Boolean(process.env.DATAFORSEO_API_LOGIN && process.env.DATAFORSEO_API_PASSWORD) },
  ];

  const active = scrapers.filter((s) => s.configured);

  return NextResponse.json({
    mode: active.length > 1 ? 'pool' : 'single',
    activeCount: active.length,
    scrapers,
    maxConcurrent: plan.concurrent,
    plan: { id: plan.id, name: plan.name, credits: plan.credits, concurrent: plan.concurrent },
  });
}
