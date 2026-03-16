import { NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { resetScraper } from '@/lib/scraping/get-scraper';

const ENV_PATH = join(process.cwd(), '.env');

function getEnvContent(): string {
  if (!existsSync(ENV_PATH)) return '';
  return readFileSync(ENV_PATH, 'utf-8');
}

function setEnvVar(content: string, key: string, value: string): string {
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    if (!value) {
      return content.replace(regex, '').replace(/\n\n+/g, '\n');
    }
    return content.replace(regex, `${key}=${value}`);
  }
  if (!value) return content;
  return content.trimEnd() + `\n${key}=${value}\n`;
}

export const SCRAPER_PLANS: Record<string, { id: string; name: string; credits: number; concurrent: number }[]> = {
  scrapeowl: [
    { id: 'basic',     name: 'Basic ($5/mo)',       credits: 10_000,      concurrent: 1  },
    { id: 'hobby',     name: 'Hobby ($10/mo)',      credits: 25_000,      concurrent: 1  },
    { id: 'bootstrap', name: 'Bootstrap ($29/mo)',  credits: 250_000,     concurrent: 10 },
    { id: 'startup',   name: 'Startup ($99/mo)',    credits: 1_000_000,   concurrent: 25 },
    { id: 'business',  name: 'Business ($249/mo)',  credits: 3_000_000,   concurrent: 50 },
  ],
  scraperapi: [
    { id: 'free',     name: 'Free',                  credits: 5_000,       concurrent: 5   },
    { id: 'hobby',    name: 'Hobby ($49/mo)',        credits: 100_000,     concurrent: 20  },
    { id: 'startup',  name: 'Startup ($149/mo)',     credits: 1_000_000,   concurrent: 50  },
    { id: 'business', name: 'Business ($299/mo)',    credits: 3_000_000,   concurrent: 100 },
    { id: 'scaling',  name: 'Scaling ($475/mo)',     credits: 5_000_000,   concurrent: 200 },
  ],
  scrapingbee: [
    { id: 'free',       name: 'Free',                  credits: 1_000,     concurrent: 1   },
    { id: 'freelance',  name: 'Freelance ($49/mo)',    credits: 250_000,   concurrent: 10  },
    { id: 'startup',    name: 'Startup ($99/mo)',      credits: 1_000_000, concurrent: 50  },
    { id: 'business',   name: 'Business ($249/mo)',    credits: 3_000_000, concurrent: 100 },
    { id: 'businessplus', name: 'Business+ ($599/mo)', credits: 8_000_000, concurrent: 200 },
  ],
  zenrows: [
    { id: 'free',       name: 'Free',                          credits: 1_000,     concurrent: 1   },
    { id: 'developer',  name: 'Developer (\u20ac69/mo)',       credits: 250_000,   concurrent: 20  },
    { id: 'startup',    name: 'Startup (\u20ac129/mo)',        credits: 1_000_000, concurrent: 50  },
    { id: 'business',   name: 'Business (\u20ac299/mo)',       credits: 3_000_000, concurrent: 100 },
    { id: 'business500', name: 'Business 500 (\u20ac499/mo)', credits: 6_000_000, concurrent: 150 },
  ],
};

// Keep backward compat export
export const SCRAPEOWL_PLANS = SCRAPER_PLANS.scrapeowl;

export const SCRAPER_DEFS = [
  {
    id: 'scrapeowl',
    name: 'ScrapeOwl',
    envVar: 'SCRAPEOWL_API_KEY',
    enabledVar: 'SCRAPEOWL_ENABLED',
    planVar: 'SCRAPEOWL_PLAN',
    url: 'https://scrapeowl.com',
    description: 'Primary scraper (paid).',
    role: 'primary',
    fields: ['apiKey'],
    hasPlan: true,
  },
  {
    id: 'scraperapi',
    name: 'ScraperAPI',
    envVar: 'SCRAPERAPI_API_KEY',
    enabledVar: 'SCRAPERAPI_ENABLED',
    planVar: 'SCRAPERAPI_PLAN',
    url: 'https://www.scraperapi.com',
    description: 'Fallback scraper.',
    role: 'fallback',
    fields: ['apiKey'],
    hasPlan: true,
  },
  {
    id: 'scrapingbee',
    name: 'ScrapingBee',
    envVar: 'SCRAPINGBEE_API_KEY',
    enabledVar: 'SCRAPINGBEE_ENABLED',
    planVar: 'SCRAPINGBEE_PLAN',
    url: 'https://www.scrapingbee.com',
    description: 'Fallback scraper.',
    role: 'fallback',
    fields: ['apiKey'],
    hasPlan: true,
  },
  {
    id: 'zenrows',
    name: 'ZenRows',
    envVar: 'ZENROWS_API_KEY',
    enabledVar: 'ZENROWS_ENABLED',
    planVar: 'ZENROWS_PLAN',
    url: 'https://www.zenrows.com',
    description: 'Fallback scraper.',
    role: 'fallback',
    fields: ['apiKey'],
    hasPlan: true,
  },
  {
    id: 'dataforseo',
    name: 'DataForSEO',
    envVar: 'DATAFORSEO_API_LOGIN',
    envVar2: 'DATAFORSEO_API_PASSWORD',
    enabledVar: 'DATAFORSEO_ENABLED',
    url: 'https://app.dataforseo.com',
    description: 'Fallback scraper. On-Page API with login/password auth.',
    role: 'fallback',
    fields: ['login', 'password'],
  },
];

function isScraperEnabled(def: typeof SCRAPER_DEFS[0]): boolean {
  const enabledVal = process.env[def.enabledVar];
  // If ENABLED var is not set, default to enabled when key exists
  if (enabledVal === undefined) return true;
  return enabledVal === 'true' || enabledVal === '1';
}

function hasCredentials(def: typeof SCRAPER_DEFS[0]): boolean {
  if (def.id === 'dataforseo') {
    return Boolean(process.env[def.envVar] && process.env[def.envVar2!]);
  }
  return Boolean(process.env[def.envVar]);
}

function maskKey(key: string | undefined): string {
  if (!key || key.length < 8) return key ? '****' : '';
  return key.slice(0, 4) + '...' + key.slice(-4);
}

export async function GET() {
  const scrapers = SCRAPER_DEFS.map((s) => {
    const configured = hasCredentials(s);
    const enabled = isScraperEnabled(s);
    const plans = SCRAPER_PLANS[s.id] || null;
    const defaultPlanId = s.id === 'scrapeowl' ? 'startup' : 'free';
    const defaultPlan = plans ? (plans.find(p => p.id === defaultPlanId) || plans[0]) : null;
    const planId = (s as any).planVar ? (process.env[(s as any).planVar] || defaultPlan?.id || null) : null;
    const plan = planId && plans ? plans.find((p) => p.id === planId) || defaultPlan : null;
    return {
      id: s.id,
      name: s.name,
      envVar: s.envVar,
      envVar2: (s as any).envVar2 || null,
      enabledVar: s.enabledVar,
      url: s.url,
      description: s.description,
      role: s.role,
      fields: s.fields,
      hasPlan: (s as any).hasPlan || false,
      configured,
      enabled,
      active: configured && enabled,
      maskedKey: maskKey(process.env[s.envVar]),
      maskedKey2: (s as any).envVar2 ? maskKey(process.env[(s as any).envVar2]) : null,
      planId,
      plan,
    };
  });

  const activeCount = scrapers.filter((s) => s.active).length;

  return NextResponse.json({ scrapers, activeCount, plans: SCRAPER_PLANS });
}

export async function POST(request: Request) {
  const body = await request.json();

  // Toggle enabled/disabled
  if (body.action === 'toggle') {
    const def = SCRAPER_DEFS.find((s) => s.id === body.id);
    if (!def) return NextResponse.json({ error: 'Unknown scraper' }, { status: 400 });

    const newEnabled = String(body.enabled);
    let env = getEnvContent();
    env = setEnvVar(env, def.enabledVar, newEnabled);
    writeFileSync(ENV_PATH, env);
    process.env[def.enabledVar] = newEnabled;
    resetScraper();

    return NextResponse.json({ ok: true, id: def.id, enabled: body.enabled });
  }

  // Save API key
  if (body.action === 'setKey') {
    const def = SCRAPER_DEFS.find((s) => s.envVar === body.envVar);
    if (!def) return NextResponse.json({ error: 'Unknown scraper key' }, { status: 400 });

    let env = getEnvContent();
    env = setEnvVar(env, body.envVar, body.value || '');
    writeFileSync(ENV_PATH, env);

    if (body.value) {
      process.env[body.envVar] = body.value;
    } else {
      delete process.env[body.envVar];
    }

    // Handle second field (DataForSEO password)
    if (body.value2 !== undefined && (def as any).envVar2) {
      env = getEnvContent();
      env = setEnvVar(env, (def as any).envVar2, body.value2 || '');
      writeFileSync(ENV_PATH, env);
      if (body.value2) {
        process.env[(def as any).envVar2] = body.value2;
      } else {
        delete process.env[(def as any).envVar2];
      }
    }

    resetScraper();
    return NextResponse.json({ ok: true, scraper: def.name, configured: Boolean(body.value) });
  }

  // Remove key
  if (body.action === 'removeKey') {
    const def = SCRAPER_DEFS.find((s) => s.id === body.id);
    if (!def) return NextResponse.json({ error: 'Unknown scraper' }, { status: 400 });

    let env = getEnvContent();
    env = setEnvVar(env, def.envVar, '');
    if ((def as any).envVar2) {
      env = setEnvVar(env, (def as any).envVar2, '');
      delete process.env[(def as any).envVar2];
    }
    writeFileSync(ENV_PATH, env);
    delete process.env[def.envVar];
    resetScraper();

    return NextResponse.json({ ok: true, scraper: def.name, configured: false });
  }

  // Set plan
  if (body.action === 'setPlan') {
    const def = SCRAPER_DEFS.find((s) => s.id === body.id);
    if (!def || !(def as any).planVar) {
      return NextResponse.json({ error: 'Scraper does not support plans' }, { status: 400 });
    }
    const scraperPlans = SCRAPER_PLANS[body.id] || [];
    const plan = scraperPlans.find((p) => p.id === body.planId);
    if (!plan) {
      return NextResponse.json({ error: 'Unknown plan' }, { status: 400 });
    }

    let env = getEnvContent();
    env = setEnvVar(env, (def as any).planVar, body.planId);
    writeFileSync(ENV_PATH, env);
    process.env[(def as any).planVar] = body.planId;

    return NextResponse.json({ ok: true, planId: body.planId, plan });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
