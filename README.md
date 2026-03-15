# Amazon Roundup Scout

A web application that automates Amazon product research for roundup articles. Paste up to 100 "best of" keywords, and the app searches Amazon, extracts structured product data from each product page, and returns grouped results ready for export to JSON, CSV, or Google Sheets.

Inspired by ZimmWriter's Amazon Product Roundup workflow.

---

## Table of Contents

- [Features](#features)
- [How It Works](#how-it-works)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Google Sheets Integration](#google-sheets-integration)
  - [Option 1: Service Account (In-App)](#option-1-service-account-in-app-automatic)
  - [Option 2: Google Workspace CLI](#option-2-google-workspace-cli-manual)
- [Scrape Profiles](#scrape-profiles)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [Data Models](#data-models)
- [Scraping Pipeline](#scraping-pipeline)
- [Concurrency and Rate Limiting](#concurrency-and-rate-limiting)
- [Error Handling](#error-handling)
- [Export Formats](#export-formats)
- [Development](#development)
- [Deployment Notes](#deployment-notes)

---

## Features

- **Batch keyword processing** — paste up to 100 roundup keywords, process them all
- **Configurable products per keyword** — slider from 3 to 15 products
- **Reusable scrape profiles** — CSS selector configurations per domain, with CRUD editor
- **Structured extraction** — title, image, feature bullets, description, specs, reviews
- **Product exclusion** — manually exclude products from export without deleting
- **Live progress tracking** — auto-polling progress bar and keyword-level status
- **Retry failed keywords** — re-run only the ones that failed
- **Export to JSON, CSV, or Google Sheets** — download or push directly
- **Google Sheets as keyword source** — load keywords from a Google Sheet tab
- **Auto-sync to Google Sheets** — results push to Sheets when batch completes
- **Google Workspace CLI support** — alternative CLI-based Sheets workflow
- **Affiliate URL generation** — automatic tag insertion from profile config
- **Text normalization and deduplication** — clean merged text from all selectors
- **Structured logging** — JSON-formatted server logs with timing

---

## How It Works

```
Keywords (paste or Google Sheets)
        │
        ▼
   Build Amazon search URLs
        │
        ▼
   Fetch search results via ScrapeOwl
        │
        ▼
   Extract product links (dedupe by ASIN)
        │
        ▼
   Fetch each product page via ScrapeOwl
        │
        ▼
   Extract data using scrape profile selectors
        │
        ▼
   Normalize, dedupe, merge text sections
        │
        ▼
   Store in SQLite via Prisma
        │
        ▼
   Display grouped by keyword
        │
        ▼
   Export: JSON / CSV / Google Sheets
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS 4 |
| ORM | Prisma 7 |
| Database | SQLite (Postgres-compatible schema) |
| HTML Parsing | Cheerio |
| Scraping | ScrapeOwl API (adapter pattern, swappable) |
| Concurrency | p-limit |
| Google Sheets | googleapis npm + Google Workspace CLI |

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm
- A [ScrapeOwl](https://scrapeowl.com) API key

### Installation

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/amazon-roundup-scout.git
cd amazon-roundup-scout

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env and add your SCRAPEOWL_API_KEY

# Initialize the database
npx prisma db push
npx prisma generate

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The default Amazon US scrape profile is auto-created on first API request.

### First Run

1. Go to [http://localhost:3000](http://localhost:3000)
2. Paste keywords like `best robotic pool cleaners for inground pools`
3. Select the "Amazon US" profile
4. Set products per keyword (5 is a good start)
5. Click "Run Batch"
6. Watch progress on the results page
7. Export as JSON or CSV when done

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | SQLite connection string. Default: `file:./dev.db` |
| `SCRAPEOWL_API_KEY` | Yes | Your ScrapeOwl API key for fetching pages |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | No | Full JSON of a Google Cloud service account key (for Sheets integration) |
| `GOOGLE_SHEET_ID` | No | Default Google Sheet spreadsheet ID (the part between `/d/` and `/edit` in the URL) |

Example `.env`:

```env
DATABASE_URL="file:./dev.db"
SCRAPEOWL_API_KEY=sk_live_abc123...
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"my-project","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"roundup-scout@my-project.iam.gserviceaccount.com",...}'
GOOGLE_SHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms
```

---

## Google Sheets Integration

The app supports Google Sheets in two ways: automatic in-app sync via a service account, and manual CLI-based sync via the Google Workspace CLI.

### Option 1: Service Account (In-App, Automatic)

This is the recommended approach. Results auto-sync to Sheets when a batch completes, and you can load keywords directly from a Sheet tab in the UI.

#### Setup

1. **Create a Google Cloud project** at [console.cloud.google.com](https://console.cloud.google.com)

2. **Enable the Google Sheets API**:
   - Go to APIs & Services > Library
   - Search for "Google Sheets API" and enable it

3. **Create a service account**:
   - Go to APIs & Services > Credentials
   - Click "Create Credentials" > "Service Account"
   - Give it a name (e.g., "Roundup Scout")
   - Click "Done"

4. **Download the JSON key**:
   - Click the service account you just created
   - Go to the "Keys" tab
   - Click "Add Key" > "Create new key" > JSON
   - Save the downloaded file

5. **Set the environment variable**:
   ```bash
   # Copy the ENTIRE contents of the JSON key file into this variable:
   GOOGLE_SERVICE_ACCOUNT_JSON='{ paste full JSON here }'
   ```

6. **Share your Google Sheet** with the service account:
   - Open your Google Sheet
   - Click "Share"
   - Add the service account email (e.g., `roundup-scout@my-project.iam.gserviceaccount.com`)
   - Give it "Editor" access

7. **Set the default spreadsheet ID** (optional):
   ```bash
   # The ID is the long string in the Sheet URL:
   # https://docs.google.com/spreadsheets/d/THIS_PART/edit
   GOOGLE_SHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms
   ```

#### Google Sheet Layout

**Keywords tab** (for reading keywords):
```
| A                                                    |
|------------------------------------------------------|
| Keyword                                              |  ← header (auto-detected, optional)
| best robotic pool cleaners for inground pools        |
| best cordless robotic pool cleaners                  |
| best pool vacuum cleaners                            |
```

Put keywords in column A. The header row is auto-skipped if it contains the word "keyword".

**Results tab** (auto-created per project):
```
| Keyword | Position | Title | ASIN | Product URL | Affiliate URL | Image URL | Feature Bullets | ... | Status | Search URL |
```

**Status tab** (auto-created per project):
```
| Keyword | Status | Products Found | Products Excluded | Search URL | Error |
```

#### In-App Usage

1. **Load keywords**: On the home page, enter your Spreadsheet ID, select the tab, click "Load Keywords"
2. **Auto-sync**: Check "Auto-sync results back to this spreadsheet" before running
3. **Manual push**: On the results page, click "Save to Sheets" at any time

### Option 2: Google Workspace CLI (Manual)

For users who prefer command-line workflows or want to script Sheets operations outside the app.

#### Setup

```bash
# Install Google Workspace CLI
go install github.com/googleworkspace/cli/cmd/gwc@latest

# Authenticate (opens browser)
gwc auth login --scopes https://www.googleapis.com/auth/spreadsheets
```

See [github.com/googleworkspace/cli](https://github.com/googleworkspace/cli) for full documentation.

#### Commands

```bash
# Read keywords from a Google Sheet
./scripts/sheets-sync.sh read-keywords YOUR_SPREADSHEET_ID Keywords

# List available tabs
./scripts/sheets-sync.sh list-tabs YOUR_SPREADSHEET_ID

# Export results from the app as CSV, then push to Sheets
curl http://localhost:3000/api/projects/1/export?format=csv > results.csv
./scripts/sheets-sync.sh write-results YOUR_SPREADSHEET_ID results.csv Results
```

#### Full CLI Workflow Example

```bash
# 1. Pull keywords from Google Sheets
./scripts/sheets-sync.sh read-keywords 1BxiMVs0XRA... Keywords > keywords.txt

# 2. Create a project via API
curl -X POST http://localhost:3000/api/projects \
  -H 'Content-Type: application/json' \
  -d "$(jq -Rs '{keywords: split("\n") | map(select(. != "")), profileId: 1, productsPerKeyword: 5}' keywords.txt)"

# 3. Start the batch
curl -X POST http://localhost:3000/api/projects/1/run \
  -H 'Content-Type: application/json' \
  -d '{}'

# 4. Poll until done
while true; do
  STATUS=$(curl -s http://localhost:3000/api/projects/1 | jq -r '.project.status')
  echo "Status: $STATUS"
  [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ] && break
  sleep 5
done

# 5. Export and push to Sheets
curl http://localhost:3000/api/projects/1/export?format=csv > results.csv
./scripts/sheets-sync.sh write-results 1BxiMVs0XRA... results.csv "Pool Cleaners"
```

---

## Scrape Profiles

A scrape profile defines how to extract product data from a specific domain. The default Amazon US profile is seeded automatically.

### Profile Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name (e.g., "Amazon US") |
| `domain` | string | Base domain (e.g., "amazon.com") |
| `titleSelector` | string | CSS selector for the product title |
| `imageSelector` | string | CSS selector for the main product image |
| `textSelectors` | array | Array of `{label, selector, treatAsReview}` entries |
| `affiliateCode` | string | Amazon affiliate tag (e.g., "mytag-20") |
| `treatAsReview` | boolean | If true, all extracted text is routed to the reviews field |
| `enabled` | boolean | Whether this profile appears in the dropdown |

### Default Amazon US Profile

| Field | Value |
|-------|-------|
| Title selector | `#productTitle` |
| Image selector | `#imgTagWrapperId img` |
| Text selectors | See below |

**Text selectors:**

| Label | Selector | Treat as Review |
|-------|----------|-----------------|
| Feature Bullets | `#feature-bullets` | No |
| Description | `#productDescription_feature_div` | No |
| Product Details | `#prodDetails` | No |
| Tech Specs | `#tech` | No |
| Book Description | `#bookDescription` | No |
| Product Facts | `#productFactsDesktopExpander` | No |
| Reviews | `.review-text` | Yes |

### Profile Editor Format

In the profile editor UI, text selectors are entered one per line in the format:

```
Label|#css-selector|review
```

The `review` flag is optional — include it to route that selector's text to the reviews field.

---

## API Reference

### Profiles

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/profiles` | List all profiles |
| POST | `/api/profiles` | Create a profile |
| GET | `/api/profiles/[id]` | Get a profile |
| PUT | `/api/profiles/[id]` | Update a profile |
| DELETE | `/api/profiles/[id]` | Delete a profile |

**POST /api/profiles**
```json
{
  "name": "Amazon UK",
  "domain": "amazon.co.uk",
  "titleSelector": "#productTitle",
  "imageSelector": "#imgTagWrapperId img",
  "textSelectors": [
    {"label": "Feature Bullets", "selector": "#feature-bullets", "treatAsReview": false},
    {"label": "Reviews", "selector": ".review-text", "treatAsReview": true}
  ],
  "affiliateCode": "myuk-21",
  "treatAsReview": false,
  "enabled": true
}
```

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create a project with keywords |
| GET | `/api/projects/[id]` | Get project with all keywords and products |
| POST | `/api/projects/[id]/run` | Start or retry a batch |
| PATCH | `/api/projects/[id]/products/[productId]` | Toggle product exclusion |
| GET | `/api/projects/[id]/export?format=json\|csv` | Export results |

**POST /api/projects**
```json
{
  "keywords": ["best robotic pool cleaners", "best pool vacuum"],
  "profileId": 1,
  "productsPerKeyword": 5,
  "name": "Pool Cleaners Roundup"
}
```

**POST /api/projects/[id]/run**
```json
{
  "retryOnly": false,
  "sheetsSpreadsheetId": "1BxiMVs0XRA..."
}
```
- `retryOnly: true` resets failed keywords to pending and re-runs only those
- `sheetsSpreadsheetId` triggers auto-sync to that spreadsheet on completion

**PATCH /api/projects/[id]/products/[productId]**
```json
{ "excluded": true }
```

### Google Sheets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sheets/config` | Check if Sheets is configured |
| GET | `/api/sheets/keywords?spreadsheetId=X&tab=Keywords` | Read keywords from a sheet |
| POST | `/api/sheets/keywords` | List available tabs: `{"spreadsheetId": "X"}` |
| POST | `/api/sheets/export` | Write project results to a sheet |

**POST /api/sheets/export**
```json
{
  "projectId": 1,
  "spreadsheetId": "1BxiMVs0XRA..."
}
```

Response:
```json
{
  "ok": true,
  "spreadsheetId": "1BxiMVs0XRA...",
  "tabName": "Pool Cleaners Roundup",
  "rowsWritten": 25,
  "url": "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA..."
}
```

---

## Project Structure

```
amazon-roundup-scout/
├── prisma/
│   └── schema.prisma              # Database schema (4 models)
├── scripts/
│   └── sheets-sync.sh             # Google Workspace CLI helper
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout with navigation
│   │   ├── page.tsx                # Home — keyword input, Sheets loader, project list
│   │   ├── globals.css             # Tailwind import
│   │   ├── profiles/
│   │   │   └── page.tsx            # Scrape profile CRUD editor
│   │   ├── projects/
│   │   │   └── [id]/
│   │   │       └── page.tsx        # Results view with progress, exclusion, export
│   │   └── api/
│   │       ├── profiles/
│   │       │   ├── route.ts        # GET list, POST create
│   │       │   └── [id]/
│   │       │       └── route.ts    # GET, PUT, DELETE
│   │       ├── projects/
│   │       │   ├── route.ts        # GET list, POST create
│   │       │   └── [id]/
│   │       │       ├── route.ts    # GET with keywords + products
│   │       │       ├── run/
│   │       │       │   └── route.ts   # POST start/retry batch
│   │       │       ├── products/
│   │       │       │   └── [productId]/
│   │       │       │       └── route.ts   # PATCH exclude/include
│   │       │       └── export/
│   │       │           └── route.ts   # GET ?format=json|csv
│   │       └── sheets/
│   │           ├── config/
│   │           │   └── route.ts    # GET Sheets configuration status
│   │           ├── keywords/
│   │           │   └── route.ts    # GET read keywords, POST list tabs
│   │           └── export/
│   │               └── route.ts    # POST write results to Sheets
│   ├── lib/
│   │   ├── prisma.ts               # Prisma client singleton
│   │   ├── services/
│   │   │   ├── profile.service.ts  # Profile CRUD + JSON parsing
│   │   │   ├── project.service.ts  # Project + keyword CRUD
│   │   │   └── product.service.ts  # Product CRUD + exclusion
│   │   ├── scraping/
│   │   │   ├── adapter.ts          # ScraperAdapter interface
│   │   │   ├── scrapeowl.adapter.ts # ScrapeOwl implementation
│   │   │   ├── get-scraper.ts      # Adapter factory/singleton
│   │   │   ├── search-extractor.ts # Amazon search page → product links
│   │   │   ├── product-extractor.ts # Product page → structured data
│   │   │   ├── normalizer.ts       # Text cleanup + dedup
│   │   │   └── url-builder.ts      # URL construction helpers
│   │   ├── sheets/
│   │   │   └── google-sheets.ts    # Google Sheets read/write service
│   │   ├── jobs/
│   │   │   └── runner.ts           # Batch orchestrator with Sheets sync
│   │   ├── export/
│   │   │   └── csv.ts              # CSV serialization
│   │   └── utils/
│   │       └── logger.ts           # Structured JSON logging
│   ├── types/
│   │   └── index.ts                # All TypeScript interfaces
│   └── generated/
│       └── prisma/                 # Generated Prisma client (gitignored)
├── docs/
│   └── design/
│       └── DESIGN.md               # Full architecture & design document
├── .env.example                    # Environment variable template
├── package.json
├── tsconfig.json
└── prisma.config.ts
```

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                  Browser (Client)                     │
│  Home Page ─── Profiles Page ─── Results Page         │
│  (keywords,     (CRUD editor)    (progress, cards,    │
│   Sheets load)                    exclude, export)    │
└──────────┬───────────┬────────────┬──────────────────┘
           │           │            │  fetch / poll
           ▼           ▼            ▼
┌──────────────────────────────────────────────────────┐
│              Next.js API Routes                       │
│  /api/profiles   /api/projects   /api/sheets          │
│                       │                               │
│           ┌───────────▼───────────┐                   │
│           │   Service Layer       │                   │
│           │ profile / project /   │                   │
│           │ product services      │                   │
│           └───────────┬───────────┘                   │
│                       │                               │
│  ┌────────────────────┼────────────────────┐          │
│  │                    │                    │          │
│  ▼                    ▼                    ▼          │
│ Job Runner     Scraper Adapter      Google Sheets     │
│ (p-limit,      (ScraperAdapter      Service           │
│  retry,         interface)          (googleapis)      │
│  progress)           │                    │          │
│       │              ▼                    ▼          │
│       │         ScrapeOwl API      Google Sheets API  │
│       │              │                               │
│       ▼              ▼                               │
│  ┌─────────────────────────────┐                     │
│  │   Prisma ORM + SQLite       │                     │
│  └─────────────────────────────┘                     │
└──────────────────────────────────────────────────────┘
```

### Key Decisions

| Decision | Rationale |
|----------|-----------|
| **Prisma + SQLite** | Typed ORM, zero-config database, Postgres-portable schema |
| **Scraper adapter interface** | ScrapeOwl today, any provider tomorrow — just implement `fetchPage(url)` |
| **In-process job runner** | No Redis/BullMQ needed for MVP; async function with DB progress tracking |
| **Client polling** | Simpler than WebSocket for MVP; polls every 3s while running |
| **Service account for Sheets** | Server-to-server auth, no user OAuth flow needed |
| **p-limit(2)** | Keeps concurrency low enough to avoid ScrapeOwl rate limits |

---

## Data Models

### Prisma Schema (4 models)

**ScrapeProfile** — reusable extraction configuration
```
id, name, domain, titleSelector, imageSelector, textSelectors (JSON),
affiliateCode, treatAsReview, enabled, createdAt, updatedAt
```

**Project** — a batch run with its keywords
```
id, name, status (pending|running|completed|failed), profileId,
productsPerKeyword, totalKeywords, completedKeywords, failedKeywords,
createdAt, updatedAt
```

**KeywordResult** — one keyword within a project
```
id, projectId, keyword, searchUrl, status (pending|running|success|failed),
errorMessage, createdAt
```

**Product** — one product extracted for a keyword
```
id, keywordResultId, title, asin, productUrl, affiliateUrl, imageUrl,
featureBullets, productDescription, productFacts, techDetails, reviews,
mergedText, scrapeDebug (JSON), position, excluded, createdAt
```

### Relationships

```
ScrapeProfile 1──N Project 1──N KeywordResult 1──N Product
```

---

## Scraping Pipeline

For each keyword in a batch:

1. **Build search URL**: `https://www.amazon.com/s?k={encoded keyword}`
2. **Fetch search page**: via `ScraperAdapter.fetchPage()` (ScrapeOwl with JS rendering)
3. **Extract product links**: Cheerio parses `[data-component-type="s-search-result"]` elements, extracts `data-asin`, title, URL, image
4. **Deduplicate by ASIN**: skip products already seen within this keyword
5. **Limit to N products**: controlled by `productsPerKeyword` setting
6. **For each product link**:
   a. Fetch product page via scraper adapter
   b. Extract title using `titleSelector`
   c. Extract image using `imageSelector`
   d. Extract each `textSelector` — map by label to named fields
   e. Route selectors marked `treatAsReview` to the reviews field
   f. Normalize text (collapse whitespace, strip zero-width chars)
   g. Deduplicate identical text across selectors
   h. Build `mergedText` from all unique sections
   i. Extract ASIN from URL pattern `/dp/{ASIN}/`
   j. Build affiliate URL with tag parameter
7. **Store product in database**
8. **Update keyword status** to success or failed
9. **Update project progress** counters
10. **On completion**: auto-sync to Google Sheets if configured

---

## Concurrency and Rate Limiting

| Parameter | Value | Configurable |
|-----------|-------|-------------|
| Concurrent keyword pipelines | 2 | `CONCURRENCY` in `runner.ts` |
| Delay between requests | 1500ms | `DELAY_MS` in `runner.ts` |
| ScrapeOwl timeout | 60 seconds | Constructor param in `scrapeowl.adapter.ts` |

The job runner uses `p-limit(2)` to process at most 2 keywords simultaneously. Within each keyword, product page fetches are sequential with a 1500ms delay to avoid triggering Amazon's bot detection.

For a batch of 10 keywords at 5 products each:
- 10 search page fetches + 50 product page fetches = 60 total requests
- At ~3 seconds per request with delays: roughly 2-3 minutes total

---

## Error Handling

| Layer | Error | Behavior |
|-------|-------|----------|
| Scraper adapter | HTTP error or timeout | Throws error, caught at keyword level |
| Search extractor | No products found | Keyword marked `success` with 0 products |
| Product extractor | Page fetch fails | Product skipped, logged, continues with next |
| Product extractor | Selector returns empty | Field defaults to empty string, logged in scrapeDebug |
| Job runner | Keyword fails | Marked `failed` with error message, batch continues |
| Job runner | All keywords fail | Project status set to `failed` |
| Google Sheets sync | Auth or API error | Logged, does not fail the batch |
| API routes | Validation error | 400 response with `{error: "message"}` |
| API routes | Not found | 404 response |

One keyword failure never crashes the batch. One product failure never fails the keyword.

---

## Export Formats

### JSON Export

`GET /api/projects/[id]/export?format=json`

Returns the full project structure with keywords and products nested. Excluded products are filtered out.

### CSV Export

`GET /api/projects/[id]/export?format=csv`

One row per product with columns: keyword, position, title, asin, productUrl, affiliateUrl, imageUrl, featureBullets, productDescription, productFacts, techDetails, reviews, mergedText.

Excluded products are filtered out. Fields with commas, quotes, or newlines are properly escaped.

### Google Sheets Export

`POST /api/sheets/export` with `{projectId, spreadsheetId}`

Creates two tabs in the target spreadsheet:
- **[Project Name]** — full product data (same columns as CSV plus status and search URL)
- **[Project Name] - Status** — keyword-level summary with product counts and errors

---

## Development

```bash
# Start dev server
npm run dev

# Type check
npx tsc --noEmit

# Build for production
npm run build

# Regenerate Prisma client after schema changes
npx prisma generate

# Push schema changes to database
npx prisma db push

# View database
npx prisma studio
```

---

## Deployment Notes

### Switching to PostgreSQL

1. Change `provider` in `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
   }
   ```

2. Update `DATABASE_URL` in `.env`:
   ```
   DATABASE_URL="postgresql://user:password@host:5432/dbname"
   ```

3. Update the Prisma adapter in `src/lib/prisma.ts` to use `@prisma/adapter-pg` instead of `@prisma/adapter-libsql`

4. Run `npx prisma db push` to create tables

The schema is designed to be Postgres-compatible — no SQLite-specific features are used.

### Security Considerations

- **No authentication** — this is a local tool. Add auth before exposing to the internet.
- **API keys in env** — never committed to git. `.env` is gitignored.
- **Service account key** — stored as env var, not as a file in the repo.
- **No SSRF risk** — all URLs are constructed server-side from known patterns.
- **No PII** — no user accounts, no personal data stored.
