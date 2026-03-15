# Amazon Roundup Scout — Design Document

## 1. Product Summary

Amazon Roundup Scout is a local-first web application that automates the product research phase of writing "best of" roundup articles. A user pastes up to 100 keywords like "best robotic pool cleaners for inground pools." For each keyword, the app searches Amazon, selects candidate products, visits each product page, extracts structured content (bullets, descriptions, specs, reviews) using CSS selectors defined in a reusable scraping profile, and stores the results grouped by keyword inside a persistent project. The user reviews, excludes unwanted products, retries failures, and exports the grouped data as JSON or CSV for article drafting.

## 2. Target User and Main Use Cases

**Target user:** Content publishers, SEO writers, and affiliate marketers who produce Amazon product roundup articles at scale.

**Use cases:**
- Batch-research 10–100 roundup topics in a single session
- Extract consistent, structured product data for article writing
- Re-run research with different keyword sets against saved scraping profiles
- Export clean data to feed into article generation tools or manual writing workflows
- Maintain multiple scraping profiles for different Amazon locales or product verticals

## 3. Core User Stories

| ID | Story | Acceptance |
|----|-------|------------|
| US-1 | As a writer, I can paste up to 100 keywords and start a batch run | Keywords validated, project created, job starts |
| US-2 | As a writer, I can set how many products to collect per keyword (3–15) | Slider/input enforces bounds |
| US-3 | As a writer, I can see live progress as keywords are processed | Progress bar, keyword-level status updates via polling |
| US-4 | As a writer, I can review results grouped by keyword | Accordion per keyword, product cards with extracted data |
| US-5 | As a writer, I can exclude individual products from a keyword group | Checkbox or button toggles `excluded` flag, excluded products hidden from export |
| US-6 | As a writer, I can retry only the failed keywords in a batch | "Retry Failed" resets failed keywords to pending and re-runs |
| US-7 | As a writer, I can export results as JSON or CSV | Download buttons, clean structured output |
| US-8 | As a writer, I can create and edit scraping profiles | CRUD form with selectors, affiliate code, domain, enabled toggle |
| US-9 | As a writer, I can browse my past projects and re-open them | Project list with status, date, keyword count |
| US-10 | As a writer, I can see why a keyword or product failed | Error messages stored and displayed per keyword |

## 4. Functional Requirements

### Scraping Profiles
- FR-1: CRUD for scraping profiles (create, read, update, delete)
- FR-2: Each profile has: name, domain, titleSelector, imageSelector, textSelectors (array), affiliateCode, treatAsReview (boolean), enabled (boolean)
- FR-3: Seed a default Amazon US profile on first run
- FR-4: textSelectors stored as an array of CSS selectors, each with a label and optional `treatAsReview` override
- FR-5: Profiles are reusable across projects

### Projects and Batches
- FR-6: A project groups a keyword batch with its profile and configuration
- FR-7: A project stores: name (auto-generated from first keyword), profileId, productsPerKeyword, status, timestamps
- FR-8: Keywords stored as individual rows linked to the project
- FR-9: Validate keyword count (1–100) and products-per-keyword (3–15)

### Scraping Pipeline
- FR-10: Build Amazon search URL from keyword + profile domain
- FR-11: Fetch search results page via scraper adapter
- FR-12: Extract product links from search results HTML (up to N per keyword)
- FR-13: Deduplicate products by ASIN within a keyword
- FR-14: Fetch each product page via scraper adapter
- FR-15: Extract structured data using profile selectors
- FR-16: Normalize and deduplicate extracted text sections
- FR-17: Build merged plain text from all sections
- FR-18: Extract ASIN from URL pattern `/dp/{ASIN}/`
- FR-19: Build affiliate URL using profile's affiliate code

### Progress and Retry
- FR-20: Track status per keyword (pending → running → success | failed)
- FR-21: Track overall project progress (completed/failed/total)
- FR-22: Client polls for progress (no WebSocket for MVP)
- FR-23: Retry resets failed keywords to pending and re-runs only those

### Product Management
- FR-24: Products linked to keyword results with position
- FR-25: Manual exclusion toggles `excluded` boolean per product
- FR-26: Excluded products omitted from exports but retained in DB

### Export
- FR-27: JSON export with full batch/keyword/product structure
- FR-28: CSV export with flattened rows (one row per product, keyword as column)
- FR-29: Export respects exclusions

## 5. Non-functional Requirements

- NF-1: TypeScript strict mode throughout
- NF-2: Concurrency-limited scraping (default 2 concurrent requests)
- NF-3: Configurable delay between requests (default 1500ms)
- NF-4: Structured logging with timestamps
- NF-5: All API keys from environment variables
- NF-6: SQLite for local dev; schema must be Postgres-compatible via Prisma
- NF-7: Scraper provider behind an adapter interface (swappable)
- NF-8: No client-side scraping — all fetching server-side
- NF-9: Graceful error handling — one keyword failure doesn't stop the batch

## 6. Recommended System Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser (Client)                  │
│  ┌──────────┐ ┌──────────┐ ┌────────────────────┐  │
│  │ Home/    │ │ Profile  │ │ Results/[projectId] │  │
│  │ New Run  │ │ Editor   │ │ + Export Controls   │  │
│  └────┬─────┘ └────┬─────┘ └────────┬───────────┘  │
│       │             │                │               │
└───────┼─────────────┼────────────────┼───────────────┘
        │ fetch       │ fetch          │ poll/fetch
        ▼             ▼                ▼
┌─────────────────────────────────────────────────────┐
│              Next.js API Routes (Server)             │
│  /api/profiles/*   /api/projects/*   /api/export/*   │
│                         │                            │
│              ┌──────────▼──────────┐                 │
│              │   Job Runner        │                 │
│              │ (in-process async)  │                 │
│              └──────────┬──────────┘                 │
│                         │                            │
│              ┌──────────▼──────────┐                 │
│              │  Scraper Adapter    │                 │
│              │  (interface)        │                 │
│              └──────────┬──────────┘                 │
│                         │                            │
│              ┌──────────▼──────────┐                 │
│              │  ScrapeOwl / etc.   │                 │
│              └─────────────────────┘                 │
│                         │                            │
│              ┌──────────▼──────────┐                 │
│              │  Prisma + SQLite    │                 │
│              └─────────────────────┘                 │
└─────────────────────────────────────────────────────┘
```

**Key decisions:**
- In-process job runner (no Redis/BullMQ) — batch runs in an async function kicked off by POST, progress written to DB, client polls
- Scraper adapter interface — concrete implementation for ScrapeOwl, swappable later
- Prisma as ORM — schema portable from SQLite to Postgres
- No WebSocket — client polls `/api/projects/[id]` every 3 seconds while status is `running`

## 7. Data Model and Database Schema

### Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model ScrapeProfile {
  id             Int       @id @default(autoincrement())
  name           String
  domain         String
  titleSelector  String
  imageSelector  String
  textSelectors  String    // JSON array of {label, selector, treatAsReview}
  affiliateCode  String    @default("")
  treatAsReview  Boolean   @default(false)
  enabled        Boolean   @default(true)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  projects       Project[]
}

model Project {
  id                 Int             @id @default(autoincrement())
  name               String
  status             String          @default("pending") // pending | running | completed | failed
  profileId          Int
  profile            ScrapeProfile   @relation(fields: [profileId], references: [id])
  productsPerKeyword Int             @default(5)
  totalKeywords      Int             @default(0)
  completedKeywords  Int             @default(0)
  failedKeywords     Int             @default(0)
  createdAt          DateTime        @default(now())
  updatedAt          DateTime        @updatedAt
  keywords           KeywordResult[]
}

model KeywordResult {
  id           Int       @id @default(autoincrement())
  projectId    Int
  project      Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  keyword      String
  searchUrl    String    @default("")
  status       String    @default("pending") // pending | running | success | failed
  errorMessage String?
  createdAt    DateTime  @default(now())
  products     Product[]
}

model Product {
  id                 Int           @id @default(autoincrement())
  keywordResultId    Int
  keywordResult      KeywordResult @relation(fields: [keywordResultId], references: [id], onDelete: Cascade)
  title              String        @default("")
  asin               String        @default("")
  productUrl         String        @default("")
  affiliateUrl       String        @default("")
  imageUrl           String        @default("")
  featureBullets     String        @default("")
  productDescription String        @default("")
  productFacts       String        @default("")
  techDetails        String        @default("")
  reviews            String        @default("")
  mergedText         String        @default("")
  scrapeDebug        String        @default("{}") // JSON
  position           Int           @default(0)
  excluded           Boolean       @default(false)
  createdAt          DateTime      @default(now())
}
```

**Notes:**
- `textSelectors` is stored as a JSON string containing an array of `{label: string, selector: string, treatAsReview: boolean}`. SQLite doesn't have a native JSON column type, but Prisma handles this as a `String` and we parse/serialize in the application layer.
- `excluded` on Product supports manual product exclusion (US-5).
- All string fields use `@default("")` instead of nullable to simplify downstream handling.
- Schema is Postgres-compatible: swap `provider = "sqlite"` to `"postgresql"` and update the URL.

## 8. TypeScript Entity/Interface Definitions

```typescript
// ── Scrape Profile ──────────────────────────────────────────────

export interface TextSelectorEntry {
  label: string;         // e.g., "Feature Bullets"
  selector: string;      // e.g., "#feature-bullets"
  treatAsReview: boolean; // true → content goes to reviews field
}

export interface ScrapeProfile {
  id: number;
  name: string;
  domain: string;
  titleSelector: string;
  imageSelector: string;
  textSelectors: TextSelectorEntry[];
  affiliateCode: string;
  treatAsReview: boolean;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ScrapeProfileCreateInput = Omit<ScrapeProfile, 'id' | 'createdAt' | 'updatedAt'>;
export type ScrapeProfileUpdateInput = Partial<ScrapeProfileCreateInput>;

// ── Project ─────────────────────────────────────────────────────

export type ProjectStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Project {
  id: number;
  name: string;
  status: ProjectStatus;
  profileId: number;
  productsPerKeyword: number;
  totalKeywords: number;
  completedKeywords: number;
  failedKeywords: number;
  createdAt: Date;
  updatedAt: Date;
}

// ── Keyword Result ──────────────────────────────────────────────

export type KeywordStatus = 'pending' | 'running' | 'success' | 'failed';

export interface KeywordResult {
  id: number;
  projectId: number;
  keyword: string;
  searchUrl: string;
  status: KeywordStatus;
  errorMessage: string | null;
  createdAt: Date;
  products: Product[];
}

// ── Product ─────────────────────────────────────────────────────

export interface Product {
  id: number;
  keywordResultId: number;
  title: string;
  asin: string;
  productUrl: string;
  affiliateUrl: string;
  imageUrl: string;
  featureBullets: string;
  productDescription: string;
  productFacts: string;
  techDetails: string;
  reviews: string;
  mergedText: string;
  scrapeDebug: Record<string, unknown>;
  position: number;
  excluded: boolean;
  createdAt: Date;
}

// ── Scraper Adapter ─────────────────────────────────────────────

export interface ScraperAdapter {
  fetchPage(url: string): Promise<string>; // returns HTML
  getName(): string;
}

// ── Extracted Data (internal) ───────────────────────────────────

export interface ProductLink {
  url: string;
  title: string;
  asin: string;
  imageUrl: string;
  position: number;
}

export interface ExtractedProduct {
  title: string;
  asin: string;
  productUrl: string;
  affiliateUrl: string;
  imageUrl: string;
  featureBullets: string;
  productDescription: string;
  productFacts: string;
  techDetails: string;
  reviews: string;
  mergedText: string;
  scrapeDebug: Record<string, unknown>;
  position: number;
}

// ── API Payloads ────────────────────────────────────────────────

export interface CreateProjectPayload {
  keywords: string[];
  profileId: number;
  productsPerKeyword: number;
  name?: string; // auto-generated if omitted
}

export interface ProjectWithKeywords extends Project {
  keywords: KeywordResult[];
}

export interface ProjectExport {
  project: Project;
  keywords: KeywordResult[]; // products nested, excluded filtered out
}
```

## 9. Main Frontend Screens and UX Flows

### Screen 1: Home / New Run (`/`)
- Textarea for keywords (one per line)
- Counter showing `N/100 keywords`
- Products-per-keyword slider (3–15) with live value label
- Profile selector dropdown (only enabled profiles)
- Optional project name field (auto-fills from first keyword)
- "Run Batch" button → creates project, starts job, redirects to results
- Below: list of recent projects with status badges, links to results

### Screen 2: Scrape Profiles (`/profiles`)
- List of profiles with name, domain, enabled status
- "New Profile" button opens inline form
- Edit button fills form with selected profile data
- Form fields: name, domain, titleSelector, imageSelector, textSelectors (one per line in a textarea), affiliateCode, treatAsReview checkbox, enabled toggle
- Delete with confirmation

### Screen 3: Project Results (`/projects/[id]`)
- Header: project name, status badge, progress bar (while running)
- Stats: X/Y completed, Z failed
- Action buttons: "Retry Failed", "Export JSON", "Export CSV"
- Accordion of keywords:
  - Keyword text, status badge, product count
  - Expand → search URL link, error message if failed
  - Product cards: thumbnail, title, ASIN, affiliate link, position
  - "Exclude" button per product (toggles, strikethrough when excluded)
  - "Show details" expands to: feature bullets, description, facts, tech details, reviews
  - Scrape debug expandable at bottom
- Auto-polls every 3s while status is `running` or `pending`

### UX Flow
```
Home → Enter keywords → Select profile → Run Batch
  ↓
Results page (auto-redirect)
  ↓ (polls every 3s)
Progress updates in-place
  ↓
Review products per keyword
  ↓
Exclude unwanted products
  ↓
Export JSON or CSV
```

## 10. Backend Modules and Responsibilities

| Module | Path | Responsibility |
|--------|------|----------------|
| **Prisma Client** | `src/lib/prisma.ts` | Singleton Prisma client instance |
| **Profile Service** | `src/lib/services/profile.service.ts` | CRUD for scrape profiles, JSON serialization of textSelectors |
| **Project Service** | `src/lib/services/project.service.ts` | Create projects, manage status, keyword results |
| **Product Service** | `src/lib/services/product.service.ts` | Insert/query/exclude products |
| **Scraper Adapter** | `src/lib/scraping/adapter.ts` | Interface definition |
| **ScrapeOwl Adapter** | `src/lib/scraping/scrapeowl.adapter.ts` | ScrapeOwl HTTP implementation |
| **Search Extractor** | `src/lib/scraping/search-extractor.ts` | Parse Amazon search results HTML → ProductLink[] |
| **Product Extractor** | `src/lib/scraping/product-extractor.ts` | Parse Amazon product page HTML → ExtractedProduct |
| **Normalizer** | `src/lib/scraping/normalizer.ts` | Clean whitespace, dedupe, merge text |
| **URL Builder** | `src/lib/scraping/url-builder.ts` | Build search URL and affiliate URLs |
| **Job Runner** | `src/lib/jobs/runner.ts` | Orchestrate batch: concurrency, retry, progress updates |
| **CSV Exporter** | `src/lib/export/csv.ts` | Flatten and serialize to CSV |
| **Logger** | `src/lib/utils/logger.ts` | Structured JSON logging |

## 11. API Routes with Request/Response Examples

### Profiles

**GET /api/profiles**
```json
// Response 200
[
  {
    "id": 1,
    "name": "Amazon US",
    "domain": "amazon.com",
    "titleSelector": "#productTitle",
    "imageSelector": "#imgTagWrapperId img",
    "textSelectors": [
      {"label": "Feature Bullets", "selector": "#feature-bullets", "treatAsReview": false},
      {"label": "Description", "selector": "#productDescription_feature_div", "treatAsReview": false},
      {"label": "Reviews", "selector": ".review-text", "treatAsReview": true}
    ],
    "affiliateCode": "",
    "treatAsReview": false,
    "enabled": true,
    "createdAt": "2026-03-15T10:00:00.000Z",
    "updatedAt": "2026-03-15T10:00:00.000Z"
  }
]
```

**POST /api/profiles**
```json
// Request
{
  "name": "Amazon UK",
  "domain": "amazon.co.uk",
  "titleSelector": "#productTitle",
  "imageSelector": "#imgTagWrapperId img",
  "textSelectors": [
    {"label": "Feature Bullets", "selector": "#feature-bullets", "treatAsReview": false}
  ],
  "affiliateCode": "myuk-21",
  "treatAsReview": false,
  "enabled": true
}
// Response 201 — full profile object
```

**PUT /api/profiles/[id]**
```json
// Request — partial update
{ "affiliateCode": "newtag-20" }
// Response 200 — full updated profile object
```

**DELETE /api/profiles/[id]**
```json
// Response 200
{ "ok": true }
```

### Projects

**GET /api/projects**
```json
// Response 200
[
  {
    "id": 1,
    "name": "Pool Cleaners Roundup",
    "status": "completed",
    "profileId": 1,
    "productsPerKeyword": 5,
    "totalKeywords": 3,
    "completedKeywords": 3,
    "failedKeywords": 0,
    "createdAt": "2026-03-15T10:05:00.000Z",
    "updatedAt": "2026-03-15T10:12:00.000Z"
  }
]
```

**POST /api/projects**
```json
// Request
{
  "keywords": [
    "best robotic pool cleaners for inground pools",
    "best cordless robotic pool cleaners"
  ],
  "profileId": 1,
  "productsPerKeyword": 5,
  "name": "Pool Cleaners Roundup"
}
// Response 201 — project object (keywords not yet processed)
```

**GET /api/projects/[id]**
```json
// Response 200
{
  "project": { /* ... project fields ... */ },
  "keywords": [
    {
      "id": 1,
      "keyword": "best robotic pool cleaners for inground pools",
      "searchUrl": "https://www.amazon.com/s?k=best+robotic+pool+cleaners+for+inground+pools",
      "status": "success",
      "errorMessage": null,
      "products": [
        {
          "id": 1,
          "title": "Dolphin Nautilus CC Plus",
          "asin": "B07C891JRX",
          "productUrl": "https://www.amazon.com/dp/B07C891JRX",
          "affiliateUrl": "https://www.amazon.com/dp/B07C891JRX?tag=mytag-20",
          "imageUrl": "https://m.media-amazon.com/images/I/...",
          "featureBullets": "...",
          "productDescription": "...",
          "reviews": "...",
          "mergedText": "...",
          "position": 1,
          "excluded": false,
          "scrapeDebug": {"htmlLength": 245000, "selectorsMatched": ["#feature-bullets"]}
        }
      ]
    }
  ]
}
```

**POST /api/projects/[id]/run**
```json
// Request
{ "retryOnly": false }
// Response 200
{ "ok": true, "projectId": 1 }
```

**PATCH /api/projects/[id]/products/[productId]**
```json
// Request
{ "excluded": true }
// Response 200 — updated product
```

### Export

**GET /api/projects/[id]/export?format=json**
```json
// Response 200 — ProjectExport structure, excluded products filtered out
```

**GET /api/projects/[id]/export?format=csv**
```
// Response 200 — text/csv with Content-Disposition header
keyword,position,title,asin,productUrl,affiliateUrl,...
"best robotic pool cleaners",1,"Dolphin Nautilus","B07C891JRX",...
```

## 12. Scraper Adapter Design

The scraper is isolated behind an interface so the provider can be swapped without touching business logic.

```typescript
// src/lib/scraping/adapter.ts

export interface ScraperAdapter {
  /** Fetch a URL and return raw HTML */
  fetchPage(url: string): Promise<string>;
  /** Human-readable adapter name for logging */
  getName(): string;
}
```

```typescript
// src/lib/scraping/scrapeowl.adapter.ts

import { ScraperAdapter } from './adapter';
import { logger } from '@/lib/utils/logger';

export class ScrapeOwlAdapter implements ScraperAdapter {
  private apiKey: string;
  private timeoutMs: number;

  constructor(apiKey: string, timeoutMs = 60_000) {
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  getName() { return 'ScrapeOwl'; }

  async fetchPage(url: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch('https://api.scrapeowl.com/v1/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: this.apiKey, url, render_js: true }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`ScrapeOwl ${res.status}: ${body.slice(0, 200)}`);
      }

      const data = await res.json();
      if (!data.html) throw new Error('ScrapeOwl returned empty HTML');
      return data.html;
    } finally {
      clearTimeout(timeout);
    }
  }
}
```

```typescript
// src/lib/scraping/get-scraper.ts

import { ScraperAdapter } from './adapter';
import { ScrapeOwlAdapter } from './scrapeowl.adapter';

let instance: ScraperAdapter | null = null;

export function getScraper(): ScraperAdapter {
  if (instance) return instance;

  const key = process.env.SCRAPEOWL_API_KEY;
  if (!key) throw new Error('SCRAPEOWL_API_KEY not set');

  instance = new ScrapeOwlAdapter(key);
  return instance;
}
```

**Why an adapter?** ScrapeOwl may have rate limits, outages, or pricing changes. A future adapter could use ScrapingBee, Bright Data, or a local Puppeteer instance. The interface is intentionally minimal — just `fetchPage(url) → html`.

## 13. Search-Result Collection Strategy

```typescript
// src/lib/scraping/search-extractor.ts

import * as cheerio from 'cheerio';
import { ProductLink } from '@/types';

export function buildSearchUrl(keyword: string, domain: string): string {
  return `https://www.${domain}/s?k=${encodeURIComponent(keyword)}`;
}

export function extractProductLinks(html: string, limit: number): ProductLink[] {
  const $ = cheerio.load(html);
  const results: ProductLink[] = [];
  const seenAsins = new Set<string>();

  $('[data-component-type="s-search-result"]').each((_, el) => {
    if (results.length >= limit) return false;

    const $el = $(el);
    const asin = $el.attr('data-asin') || '';
    if (!asin || seenAsins.has(asin)) return; // dedupe
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
```

**Risks:**
- Amazon changes search result markup periodically. The `data-component-type="s-search-result"` and `data-asin` selectors have been stable for years but could change.
- Sponsored results are included. For MVP, this is acceptable; a future filter could use `[data-component-type="sp-sponsored-result"]` to exclude them.
- Amazon may return captcha pages. ScrapeOwl's JS rendering and proxy rotation handle most of this; failures surface as scrape errors.

## 14. Product-Page Extraction Strategy

```typescript
// src/lib/scraping/product-extractor.ts

import * as cheerio from 'cheerio';
import { ScrapeProfile, ExtractedProduct, ProductLink, TextSelectorEntry } from '@/types';
import { ScraperAdapter } from './adapter';
import { normalizeText, dedupeTexts, buildMergedText } from './normalizer';

export async function extractProduct(
  link: ProductLink,
  profile: ScrapeProfile,
  scraper: ScraperAdapter
): Promise<ExtractedProduct> {
  const debug: Record<string, unknown> = { url: link.url };

  const html = await scraper.fetchPage(link.url);
  debug.htmlLength = html.length;

  const $ = cheerio.load(html);
  const asin = link.asin || extractAsin(link.url);

  // Title: page title or fallback to search result title
  const pageTitle = normalizeText($(profile.titleSelector).first().text());
  const title = pageTitle || link.title;

  // Image
  const imageUrl = $(profile.imageSelector).first().attr('src') || link.imageUrl;

  // Extract each text selector
  const sectionTexts: Record<string, string> = {};
  const reviewTexts: string[] = [];

  for (const entry of profile.textSelectors) {
    const text = normalizeText($(entry.selector).first().text());
    if (!text) continue;
    sectionTexts[entry.label] = text;
    if (entry.treatAsReview || profile.treatAsReview) {
      reviewTexts.push(text);
    }
  }

  debug.selectorsMatched = Object.keys(sectionTexts);

  // Map to named fields using known labels, then build merged text
  const featureBullets = sectionTexts['Feature Bullets'] || findBySelector(sectionTexts, '#feature-bullets') || '';
  const productDescription = sectionTexts['Description'] || findBySelector(sectionTexts, '#productDescription_feature_div') || '';
  const productFacts = sectionTexts['Product Facts'] || findBySelector(sectionTexts, '#productFactsDesktopExpander') || '';
  const techDetails = sectionTexts['Tech Details'] || findBySelector(sectionTexts, '#prodDetails') || findBySelector(sectionTexts, '#tech') || '';
  const reviews = reviewTexts.length > 0 ? reviewTexts.join('\n\n') : (sectionTexts['Reviews'] || findBySelector(sectionTexts, '.review-text') || '');

  const allTexts = dedupeTexts(Object.values(sectionTexts));
  const mergedText = buildMergedText(allTexts);

  const affiliateUrl = profile.affiliateCode
    ? `https://www.amazon.com/dp/${asin}?tag=${profile.affiliateCode}`
    : link.url;

  return {
    title, asin, productUrl: link.url, affiliateUrl, imageUrl,
    featureBullets, productDescription, productFacts, techDetails, reviews,
    mergedText, scrapeDebug: debug, position: link.position,
  };
}

function extractAsin(url: string): string {
  const m = url.match(/\/dp\/([A-Z0-9]{10})/i);
  return m ? m[1] : '';
}

function findBySelector(map: Record<string, string>, selector: string): string {
  return Object.entries(map).find(([_, v]) => v)?.[1] || ''; // simplistic fallback
}
```

**Strategy:**
- Each `textSelectors` entry has a `label` so the extractor can map text to the correct named field.
- If labels don't match expected names, raw selector matching is used as fallback.
- `treatAsReview` at the selector level or profile level routes text to the reviews field.
- All successfully extracted texts are deduped and merged into `mergedText`.

## 15. Selector Parsing and Normalization Strategy

```typescript
// src/lib/scraping/normalizer.ts

/** Collapse whitespace, trim, remove zero-width characters */
export function normalizeText(text: string): string {
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width chars
    .replace(/\s+/g, ' ')
    .trim();
}

/** Remove exact-duplicate texts (case-insensitive comparison) */
export function dedupeTexts(texts: string[]): string[] {
  const seen = new Set<string>();
  return texts.filter(t => {
    const key = t.toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Join texts with separator for merged output */
export function buildMergedText(texts: string[]): string {
  return texts.filter(Boolean).join('\n\n---\n\n');
}
```

**Why explicit normalization?** Amazon pages contain invisible characters, excessive whitespace, and sometimes identical text in multiple containers (e.g., `#productDescription_feature_div` and an A+ content module). Deduplication prevents bloated merged text.

## 16. Retry Logic, Queueing, and Concurrency Strategy

```typescript
// src/lib/jobs/runner.ts

import pLimit from 'p-limit';
import { prisma } from '@/lib/prisma';
import { getScraper } from '@/lib/scraping/get-scraper';
import { buildSearchUrl, extractProductLinks } from '@/lib/scraping/search-extractor';
import { extractProduct } from '@/lib/scraping/product-extractor';
import { logger } from '@/lib/utils/logger';

const CONCURRENCY = 2;
const DELAY_MS = 1500;

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export async function runProject(projectId: number, retryOnly = false) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { profile: true } });
  const profile = parseProfile(project.profile); // parse textSelectors JSON

  await prisma.project.update({ where: { id: projectId }, data: { status: 'running' } });

  const whereClause = retryOnly
    ? { projectId, status: 'failed' }
    : { projectId, status: 'pending' };

  // Reset failed keywords if retrying
  if (retryOnly) {
    await prisma.keywordResult.updateMany({
      where: { projectId, status: 'failed' },
      data: { status: 'pending', errorMessage: null },
    });
    await prisma.project.update({ where: { id: projectId }, data: { failedKeywords: 0 } });
  }

  const keywords = await prisma.keywordResult.findMany({
    where: { projectId, status: 'pending' },
    orderBy: { id: 'asc' },
  });

  const limiter = pLimit(CONCURRENCY);
  const scraper = getScraper();

  await Promise.all(
    keywords.map(kw => limiter(async () => {
      await processKeyword(kw.id, profile, project.productsPerKeyword, scraper, projectId);
      await delay(DELAY_MS);
    }))
  );

  // Determine final status
  const updated = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const finalStatus = updated.failedKeywords > 0 ? 'failed' : 'completed';
  await prisma.project.update({ where: { id: projectId }, data: { status: finalStatus } });
}

async function processKeyword(kwId, profile, maxProducts, scraper, projectId) {
  try {
    await prisma.keywordResult.update({ where: { id: kwId }, data: { status: 'running' } });
    const kw = await prisma.keywordResult.findUniqueOrThrow({ where: { id: kwId } });

    const searchUrl = buildSearchUrl(kw.keyword, profile.domain);
    await prisma.keywordResult.update({ where: { id: kwId }, data: { searchUrl } });

    const searchHtml = await scraper.fetchPage(searchUrl);
    const links = extractProductLinks(searchHtml, maxProducts);

    // Delete old products for this keyword (for retry)
    await prisma.product.deleteMany({ where: { keywordResultId: kwId } });

    for (const link of links) {
      try {
        const product = await extractProduct(link, profile, scraper);
        await prisma.product.create({
          data: { keywordResultId: kwId, ...product, scrapeDebug: JSON.stringify(product.scrapeDebug) },
        });
        await delay(DELAY_MS);
      } catch (err) {
        logger.error('Product extraction failed', { kwId, url: link.url, error: String(err) });
        // Continue — don't fail the keyword for one product
      }
    }

    await prisma.keywordResult.update({ where: { id: kwId }, data: { status: 'success' } });
    await prisma.project.update({
      where: { id: projectId },
      data: { completedKeywords: { increment: 1 } },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.keywordResult.update({ where: { id: kwId }, data: { status: 'failed', errorMessage: msg } });
    await prisma.project.update({
      where: { id: projectId },
      data: { failedKeywords: { increment: 1 } },
    });
  }
}
```

**Decisions:**
- **p-limit(2)** — 2 concurrent keyword pipelines to stay within ScrapeOwl rate limits
- **1500ms delay** between requests to avoid triggering Amazon bot detection
- **Fire-and-forget** — POST `/api/projects/[id]/run` kicks off the async function and returns immediately; client polls for progress
- **Per-keyword isolation** — one keyword failure doesn't abort the batch
- **Per-product tolerance** — one product extraction failure within a keyword still allows other products to proceed
- **Retry** — resets failed keywords to `pending`, deletes their old products, re-runs only those

## 17. Error Handling Strategy

| Layer | Error | Handling |
|-------|-------|----------|
| ScrapeOwl adapter | HTTP error / timeout | Throw with status code and truncated body; caught at keyword level |
| Search extractor | No products found | Mark keyword as `success` with 0 products (not an error) |
| Search extractor | Malformed HTML | Cheerio returns empty selections; 0 products |
| Product extractor | Page fetch fails | Log error, skip product, continue with next |
| Product extractor | Selector returns empty | Field defaults to empty string; logged in scrapeDebug |
| Job runner | Keyword processing fails | Mark keyword as `failed` with error message, increment failedKeywords |
| Job runner | All keywords fail | Project status set to `failed` |
| API routes | Validation error | 400 with `{ error: "message" }` |
| API routes | Not found | 404 with `{ error: "Not found" }` |
| API routes | Unexpected error | 500 with `{ error: "Internal server error" }`, details logged server-side |

**Principle:** Never let one failure cascade. Log everything. Store error messages in the database so the user can see what happened.

## 18. Export Design

### JSON Export
- Endpoint: `GET /api/projects/[id]/export?format=json`
- Returns `ProjectExport` structure
- Products with `excluded: true` are filtered out
- `scrapeDebug` included for transparency

### CSV Export
- Endpoint: `GET /api/projects/[id]/export?format=csv`
- Headers: `keyword, position, title, asin, productUrl, affiliateUrl, imageUrl, featureBullets, productDescription, productFacts, techDetails, reviews, mergedText`
- One row per product
- Products with `excluded: true` omitted
- Fields with commas/quotes/newlines properly escaped
- Content-Disposition header for download

```typescript
// src/lib/export/csv.ts

const HEADERS = [
  'keyword', 'position', 'title', 'asin', 'productUrl', 'affiliateUrl',
  'imageUrl', 'featureBullets', 'productDescription', 'productFacts',
  'techDetails', 'reviews', 'mergedText',
];

function escapeCsv(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export function toCSV(keywords: KeywordWithProducts[]): string {
  const rows = [HEADERS.join(',')];
  for (const kw of keywords) {
    for (const p of kw.products.filter(p => !p.excluded)) {
      rows.push([
        kw.keyword, String(p.position), p.title, p.asin, p.productUrl,
        p.affiliateUrl, p.imageUrl, p.featureBullets, p.productDescription,
        p.productFacts, p.techDetails, p.reviews, p.mergedText,
      ].map(escapeCsv).join(','));
    }
  }
  return rows.join('\n');
}
```

## 19. Security and Operational Concerns

- **API key exposure:** `SCRAPEOWL_API_KEY` in `.env.local`, never committed. `.env.example` documents required vars.
- **No auth for MVP:** This is a local tool. No user authentication. If deployed, add auth before exposing.
- **No SSRF risk:** All URLs are constructed server-side from known patterns (Amazon search URLs). The user provides keywords, not URLs.
- **Rate limiting:** Enforced in the job runner. ScrapeOwl has its own rate limits; the adapter surfaces errors when exceeded.
- **Database size:** SQLite file grows with accumulated product data. For MVP, acceptable. Add a "delete project" feature if needed.
- **No PII stored:** No user accounts, no personal data. Product data is public Amazon content.
- **CORS:** Not a concern for MVP — API routes are same-origin.

## 20. Risks, Maintenance Burdens, and Likely Failure Points

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Amazon changes search result markup | Medium | High — extraction breaks | Monitor `extractProductLinks` output; selectors are centralized |
| Amazon changes product page markup | Medium | Medium — individual selectors break | Scrape profiles are user-editable; users can fix selectors |
| ScrapeOwl returns captcha page | Medium | Medium — keyword fails | Retry logic handles transient failures; ScrapeOwl handles proxies |
| ScrapeOwl rate limit exceeded | Low | Medium — batch slows/fails | Concurrency limit (2) and delay (1500ms) prevent most issues |
| ScrapeOwl pricing changes | Low | Low | Adapter interface allows swapping provider |
| Large batches (100 keywords × 15 products) | High | Medium — 1500+ page fetches, slow | Progress UI keeps user informed; partial results usable |
| SQLite write contention under concurrency | Low | Low — p-limit(2) keeps it manageable | Prisma handles connection pooling; WAL mode |
| Product text fields contain huge HTML | Medium | Low — large DB rows | Normalizer strips to text only; no raw HTML stored |

**Maintenance burdens:**
- Amazon selector changes require profile updates (user-facing, not code changes)
- ScrapeOwl API changes require adapter updates (isolated)
- Prisma schema migrations for new fields

## 21. Phase 1 MVP Scope

**In scope:**
- Scrape profile CRUD with default Amazon profile
- Project creation from keyword list
- Batch job runner with concurrency control
- Amazon search → product links → product page extraction
- Progress tracking with client polling
- Grouped results view with product cards
- Manual product exclusion
- Retry failed keywords
- JSON and CSV export
- Structured logging
- Error messages visible per keyword

**Out of scope for Phase 1:**
- User authentication
- WordPress/CMS publishing
- AI article generation
- Multi-user support
- Billing
- Scheduled/recurring runs
- WebSocket progress
- Proxy rotation (delegated to ScrapeOwl)
- Non-Amazon scraping profiles (schema supports it, UI doesn't prioritize it)

## 22. Phase 2 Enhancements

- **Saved keyword lists:** Import/export keyword lists for reuse
- **Keyword templates:** "best {adjective} {product} for {use case}" with variable expansion
- **Product comparison view:** Side-by-side comparison of products across keywords
- **Scheduled runs:** Cron-based re-scraping for price/availability monitoring
- **AI summarization:** Feed mergedText to an LLM for article draft generation
- **WordPress integration:** Direct publishing of roundup articles
- **Postgres deployment:** Switch Prisma datasource for multi-user cloud deployment
- **Alternative scraper adapters:** ScrapingBee, Bright Data, local Puppeteer
- **Webhook notifications:** Notify when batch completes
- **Bulk exclude/include:** Select multiple products for exclusion
- **ASIN-based lookup:** Skip search and go directly to known ASINs

## 23. Recommended Next.js Folder Structure

```
src/
  app/
    layout.tsx                          # Root layout with nav
    page.tsx                            # Home — keyword input, project list
    globals.css                         # Tailwind import
    profiles/
      page.tsx                          # Profile list + editor
    projects/
      [id]/
        page.tsx                        # Results view
    api/
      profiles/
        route.ts                        # GET list, POST create
        [id]/
          route.ts                      # GET, PUT, DELETE
      projects/
        route.ts                        # GET list, POST create
        [id]/
          route.ts                      # GET with keywords+products
          run/
            route.ts                    # POST start/retry
          products/
            [productId]/
              route.ts                  # PATCH exclude/include
          export/
            route.ts                    # GET ?format=json|csv
  lib/
    prisma.ts                           # Prisma client singleton
    services/
      profile.service.ts                # Profile CRUD + JSON parsing
      project.service.ts                # Project + keyword CRUD
      product.service.ts                # Product CRUD + exclusion
    scraping/
      adapter.ts                        # ScraperAdapter interface
      scrapeowl.adapter.ts              # ScrapeOwl implementation
      get-scraper.ts                    # Factory/singleton
      search-extractor.ts               # Search URL + link extraction
      product-extractor.ts              # Product page extraction
      normalizer.ts                     # Text cleanup + dedup
      url-builder.ts                    # URL construction helpers
    jobs/
      runner.ts                         # Batch orchestrator
    export/
      csv.ts                            # CSV serialization
    utils/
      logger.ts                         # Structured logging
  types/
    index.ts                            # All TypeScript interfaces
prisma/
  schema.prisma                         # Database schema
```

## 24. Step-by-Step Build Order

Each step should be independently testable.

| Step | Task | Depends On | Deliverable |
|------|------|------------|-------------|
| 1 | **Project scaffold** | — | Next.js app with TS + Tailwind + Prisma + SQLite. `.env.example`. Root layout with nav. `npm run dev` works. |
| 2 | **Prisma schema + migrations** | 1 | `schema.prisma` with all 4 models. `npx prisma db push` succeeds. Seed script creates default Amazon profile. |
| 3 | **TypeScript types** | 1 | `src/types/index.ts` with all interfaces. |
| 4 | **Prisma client singleton** | 2 | `src/lib/prisma.ts` |
| 5 | **Service layer** | 2, 3, 4 | `profile.service.ts`, `project.service.ts`, `product.service.ts` with all CRUD functions. |
| 6 | **Profile API routes** | 5 | GET/POST `/api/profiles`, GET/PUT/DELETE `/api/profiles/[id]`. Test with curl. |
| 7 | **Profile editor UI** | 6 | `/profiles` page with form and list. Create, edit, delete works. |
| 8 | **Project API routes** | 5 | POST/GET `/api/projects`, GET `/api/projects/[id]`. |
| 9 | **Scraper adapter + ScrapeOwl** | 3 | `adapter.ts`, `scrapeowl.adapter.ts`, `get-scraper.ts`. |
| 10 | **Search extractor** | 3 | `search-extractor.ts` with `buildSearchUrl` + `extractProductLinks`. |
| 11 | **Product extractor + normalizer** | 3, 9 | `product-extractor.ts`, `normalizer.ts`, `url-builder.ts`. |
| 12 | **Job runner** | 5, 10, 11 | `runner.ts` — full batch pipeline. |
| 13 | **Run + retry API** | 8, 12 | POST `/api/projects/[id]/run`. |
| 14 | **Home page UI** | 6, 8 | Keyword textarea, profile selector, products slider, "Run Batch" button, project list. |
| 15 | **Results page UI** | 8, 13 | `/projects/[id]` — progress bar, keyword accordion, product cards, exclude button. |
| 16 | **Product exclusion API** | 5 | PATCH `/api/projects/[id]/products/[productId]`. |
| 17 | **Export API + UI** | 5 | GET `/api/projects/[id]/export?format=json|csv`. Download buttons in results UI. |
| 18 | **Logger** | — | `logger.ts` — used throughout. Can be done anytime. |
| 19 | **Integration test** | All | End-to-end: create profile → create project → run batch → check results → export. |
| 20 | **README + .env.example** | All | Setup instructions, env vars, dev server. |

## 25. Implementation Checklist

- [ ] `npx create-next-app` with TypeScript, Tailwind, App Router, src directory
- [ ] `npm install prisma @prisma/client cheerio p-limit@3`
- [ ] `npm install -D @types/node`
- [ ] Create `prisma/schema.prisma` with ScrapeProfile, Project, KeywordResult, Product
- [ ] `npx prisma db push`
- [ ] Create seed script for default Amazon profile
- [ ] Create `src/lib/prisma.ts`
- [ ] Create `src/types/index.ts`
- [ ] Create `src/lib/services/profile.service.ts`
- [ ] Create `src/lib/services/project.service.ts`
- [ ] Create `src/lib/services/product.service.ts`
- [ ] Create `src/lib/scraping/adapter.ts`
- [ ] Create `src/lib/scraping/scrapeowl.adapter.ts`
- [ ] Create `src/lib/scraping/get-scraper.ts`
- [ ] Create `src/lib/scraping/search-extractor.ts`
- [ ] Create `src/lib/scraping/product-extractor.ts`
- [ ] Create `src/lib/scraping/normalizer.ts`
- [ ] Create `src/lib/scraping/url-builder.ts`
- [ ] Create `src/lib/jobs/runner.ts`
- [ ] Create `src/lib/export/csv.ts`
- [ ] Create `src/lib/utils/logger.ts`
- [ ] Create API route: `src/app/api/profiles/route.ts`
- [ ] Create API route: `src/app/api/profiles/[id]/route.ts`
- [ ] Create API route: `src/app/api/projects/route.ts`
- [ ] Create API route: `src/app/api/projects/[id]/route.ts`
- [ ] Create API route: `src/app/api/projects/[id]/run/route.ts`
- [ ] Create API route: `src/app/api/projects/[id]/products/[productId]/route.ts`
- [ ] Create API route: `src/app/api/projects/[id]/export/route.ts`
- [ ] Create page: `src/app/layout.tsx` with nav
- [ ] Create page: `src/app/page.tsx` (home)
- [ ] Create page: `src/app/profiles/page.tsx`
- [ ] Create page: `src/app/projects/[id]/page.tsx`
- [ ] Create `.env.example`
- [ ] Add `data/` to `.gitignore`
- [ ] Verify `npm run dev` starts clean
- [ ] Verify `npm run build` succeeds

---

## Codex Handoff Brief

### What to build
A Next.js 14 App Router application that scrapes Amazon products for roundup article research.

### Stack (exact)
- Next.js (App Router) + TypeScript strict + Tailwind CSS
- Prisma ORM with SQLite (`prisma/schema.prisma`)
- Cheerio for HTML parsing (server-side only)
- p-limit@3 for concurrency control
- No additional UI libraries — plain Tailwind

### Schema
4 Prisma models: **ScrapeProfile**, **Project**, **KeywordResult**, **Product**. See section 7 for full schema. Key points:
- `textSelectors` on ScrapeProfile is a JSON string containing `TextSelectorEntry[]`
- Product has an `excluded` boolean
- All string fields default to `""`, not null
- Cascade deletes from Project → KeywordResult → Product

### Architecture pattern
- Service layer (`src/lib/services/`) wraps Prisma calls
- Scraper adapter interface (`ScraperAdapter`) with ScrapeOwl implementation
- In-process job runner (async, not queued)
- Client polls `/api/projects/[id]` every 3s while running
- API routes are thin — validate input, call services, return JSON

### API surface
- `GET/POST /api/profiles` — list/create profiles
- `GET/PUT/DELETE /api/profiles/[id]` — single profile
- `GET/POST /api/projects` — list/create projects
- `GET /api/projects/[id]` — project with keywords and products
- `POST /api/projects/[id]/run` — start or retry batch (`{ retryOnly: boolean }`)
- `PATCH /api/projects/[id]/products/[productId]` — toggle exclusion
- `GET /api/projects/[id]/export?format=json|csv` — export

### Pages
- `/` — keyword input + recent projects
- `/profiles` — profile CRUD
- `/projects/[id]` — results with progress, accordion, exclude, export

### Scraping pipeline (per keyword)
1. `buildSearchUrl(keyword, domain)` → Amazon search URL
2. `scraper.fetchPage(searchUrl)` → HTML
3. `extractProductLinks(html, limit)` → `ProductLink[]` (dedupe by ASIN)
4. For each link: `scraper.fetchPage(link.url)` → HTML
5. `extractProduct(link, profile, scraper)` → `ExtractedProduct`
6. `normalizeText()`, `dedupeTexts()`, `buildMergedText()` on extracted sections
7. Store to DB via `product.service.ts`

### Concurrency
- `pLimit(2)` for keyword processing
- 1500ms delay between requests
- Fire-and-forget from API route; progress written to DB

### Seed data
Default Amazon US profile with selectors: `#productTitle`, `#imgTagWrapperId img`, and textSelectors: `#feature-bullets`, `#productDescription_feature_div`, `#prodDetails`, `#tech`, `#bookDescription`, `#productFactsDesktopExpander`, `.review-text`

### Critical files to create (in order)
1. `prisma/schema.prisma` → `npx prisma db push`
2. `src/types/index.ts`
3. `src/lib/prisma.ts`
4. `src/lib/utils/logger.ts`
5. `src/lib/services/profile.service.ts`
6. `src/lib/services/project.service.ts`
7. `src/lib/services/product.service.ts`
8. `src/lib/scraping/adapter.ts`
9. `src/lib/scraping/scrapeowl.adapter.ts`
10. `src/lib/scraping/get-scraper.ts`
11. `src/lib/scraping/search-extractor.ts`
12. `src/lib/scraping/normalizer.ts`
13. `src/lib/scraping/product-extractor.ts`
14. `src/lib/jobs/runner.ts`
15. `src/lib/export/csv.ts`
16. All API routes (profiles, projects, run, products, export)
17. All pages (layout, home, profiles, results)
18. `prisma/seed.ts` for default profile
19. `.env.example`, README

### Existing code
The `src/` directory contains a prior implementation using `better-sqlite3` directly. **Discard it entirely.** The new implementation uses Prisma. Delete all existing files under `src/` before starting.

### Environment
```
DATABASE_URL="file:./dev.db"
SCRAPEOWL_API_KEY=your_key_here
```

### Verification sequence
1. `npm run dev` starts without errors
2. Visit `/profiles` — default Amazon profile visible
3. Create/edit/delete a profile
4. Visit `/` — paste 2 keywords, select profile, run batch
5. Auto-redirect to `/projects/[id]` — progress updates
6. Expand keywords — product cards visible
7. Exclude a product — verify it's hidden from export
8. Export JSON — verify structure
9. Export CSV — verify opens in spreadsheet
10. Add a keyword that will fail (empty string shouldn't, but simulate with invalid profile) — verify retry works
