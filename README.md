# RoundupForge by Grimfaste

**Amazon Roundup Scout** — A free tool by [Grimfaste](https://grimfaste.com) that automates Amazon product research for roundup articles.

Paste up to 10,000 keywords, and RoundupForge searches Amazon, collects product ASINs, and delivers organized results — ready for article creation with tools like ZimmWriter.

---

## Features

- **Batch keyword processing** — paste or load up to 10,000 keywords at once
- **Two scraping modes** — Fast (1 API call per keyword, ASINs only) or Full (visits each product page for detailed extraction)
- **Randomized product counts** — set a range (e.g., 7–15 products per keyword) for natural-looking roundups
- **Multi-scraper pool** — ScrapeOwl as primary, with automatic failover to ScraperAPI, ScrapingBee, ZenRows, and DataForSEO
- **Configurable concurrency** — scale from 1 to 50 parallel requests based on your scraper plan
- **Plan-aware settings** — select your scraper plan, concurrency limits auto-adjust
- **Google Sheets integration** — load keywords from and sync results back to Google Sheets
- **Roundup export** — keyword + ASIN URL format, auto-split into packs of 100 for ZimmWriter
- **CSV and JSON export** — full structured data with exclusion filtering
- **Stop and retry** — stop running batches, retry only failed keywords
- **Product exclusion** — exclude individual products without deleting them
- **Live progress** — real-time progress bar, elapsed time counter, keyword-level status
- **Editable project names** — click to rename any project inline
- **Scrape profiles** — reusable CSS selector configurations per domain with affiliate code support
- **In-app settings** — configure all API keys, scraper plans, and Google Sheets from the UI

---

## How It Works

```
Keywords (paste or Google Sheets)
        │
        ▼
  Build Amazon search URLs (domain from scrape profile)
        │
        ▼
  Fetch search results via scraper pool (ScrapeOwl → fallbacks)
        │
        ▼
  Extract product links + ASINs (dedupe, randomize count)
        │
        ▼
  Fast mode: done ─── Full mode: visit each product page
        │                          extract title, bullets,
        │                          description, specs, reviews
        ▼
  Store in SQLite, update progress
        │
        ▼
  Export: Roundup packs / CSV / JSON / Google Sheets
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm
- A [ScrapeOwl](https://scrapeowl.com) API key (free tier: 10,000 credits)

### Installation

```bash
git clone https://github.com/MeyerThorsten/grimfaste-roundupforge.git
cd grimfaste-roundupforge
npm install
cp .env.example .env       # add your SCRAPEOWL_API_KEY
npx prisma db push
npx prisma generate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### First Run

1. Open the app at [http://localhost:3000](http://localhost:3000)
2. Go to **Settings** and add your ScrapeOwl API key (and optionally configure additional scrapers)
3. Paste keywords or load them from Google Sheets
4. Select **Fast** mode (default) for ASIN collection, or **Full** for detailed product data
5. Set products per keyword and optional random range
6. Click **Run Batch**
7. Watch progress with live timer
8. Click **Export Roundup** for ZimmWriter-ready output

---

## Scraping Modes

### Fast Mode (default)
- **1 API call per keyword** — fetches only the Amazon search results page
- Extracts: ASIN, title, image URL, product URL, affiliate URL
- Best for: collecting ASINs for roundup article workflows
- Speed: ~3,600 keywords/hour at 25 concurrent requests

### Full Mode
- **1 + N API calls per keyword** — fetches search page + each product page
- Extracts: everything from Fast mode, plus feature bullets, description, product facts, tech details, reviews
- Best for: detailed product research and comparison content
- Speed: depends on products per keyword and concurrency

---

## Multi-Scraper Pool

RoundupForge uses a primary + fallback architecture. Your paid scraper handles all requests. If it returns a 503 (Amazon block), the request automatically fails over to the next configured provider.

| Provider | Role | Auth | Free Tier |
|----------|------|------|-----------|
| [ScrapeOwl](https://scrapeowl.com) | Primary | API key | 10,000 credits |
| [ScraperAPI](https://www.scraperapi.com) | Fallback | API key | 5,000 credits/month |
| [ScrapingBee](https://www.scrapingbee.com) | Fallback | API key | 1,000 credits |
| [ZenRows](https://www.zenrows.com) | Fallback | API key | 1,000 credits |
| [DataForSEO](https://dataforseo.com) | Fallback | Login + password | — |

All API keys and plans are configurable from the **Settings** page in the app. No need to edit `.env` files manually.

---

## Export Formats

### Roundup Export (ZimmWriter-ready)

Downloads a `.txt` file with keyword + ASIN URLs. For batches over 100 keywords, auto-splits into numbered packs with a "Download All" button.

```
best robotic pool cleaners for inground pools
https://www.amazon.com/dp/B07C891JRX
https://www.amazon.com/dp/B09HWWGMKH
https://www.amazon.com/dp/B07NLGNZ5S

best cordless robotic pool cleaners
https://www.amazon.com/dp/B097DRXSWL
https://www.amazon.com/dp/B0CJRTRRTG
```

### CSV Export
One row per product with columns: keyword, position, title, ASIN, product URL, affiliate URL, image URL, and (in Full mode) feature bullets, description, facts, tech details, reviews, merged text.

### JSON Export
Full project structure with keywords and products nested. Useful for programmatic processing.

### Google Sheets Export
Creates two tabs per project:
- **[Project Name]** — full product data rows
- **[Project Name] - Status** — keyword-level summary with status and error messages

---

## Google Sheets Integration

### Setup (all done in-app)

1. Go to **Settings** in the app
2. Follow the setup guide to create a Google Cloud service account
3. Upload the JSON key file (drag and drop)
4. Enter your spreadsheet ID
5. Share your Google Sheet with the service account email (shown in Settings)

### Usage

- **Load keywords**: On the home page, select a tab from your sheet and click "Load Keywords"
- **Auto-sync**: Check "Auto-sync results back when batch completes"
- **Manual push**: Click "Save to Sheets" on any results page

### Google Workspace CLI (alternative)

```bash
# Install
go install github.com/googleworkspace/cli/cmd/gwc@latest
gwc auth login --scopes https://www.googleapis.com/auth/spreadsheets

# Read keywords
./scripts/sheets-sync.sh read-keywords YOUR_SPREADSHEET_ID SheetTabName

# Write results
curl http://localhost:3000/api/projects/1/export?format=csv > results.csv
./scripts/sheets-sync.sh write-results YOUR_SPREADSHEET_ID results.csv Results
```

---

## Scrape Profiles

A scrape profile defines how to extract product data from a specific domain. A default Amazon US profile is auto-created on first run.

### Which fields matter in each mode

| Field | Fast Mode | Full Mode |
|-------|-----------|-----------|
| **Name** | Used (dropdown) | Used |
| **Domain** | Used (search URL) | Used |
| **Affiliate Code** | Used (?tag= in URLs) | Used |
| **Enabled** | Used (dropdown filter) | Used |
| Title Selector | Not used | Extracts title from product page |
| Image Selector | Not used | Extracts image from product page |
| Text Selectors | Not used | Extracts bullets, description, specs, reviews |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | SQLite connection. Default: `file:./dev.db` |
| `SCRAPEOWL_API_KEY` | Yes | ScrapeOwl API key |
| `SCRAPERAPI_API_KEY` | No | ScraperAPI key (fallback) |
| `SCRAPINGBEE_API_KEY` | No | ScrapingBee key (fallback) |
| `ZENROWS_API_KEY` | No | ZenRows key (fallback) |
| `DATAFORSEO_API_LOGIN` | No | DataForSEO login (fallback) |
| `DATAFORSEO_API_PASSWORD` | No | DataForSEO password (fallback) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | No | Google Cloud service account JSON |
| `GOOGLE_SHEET_ID` | No | Default Google Sheet spreadsheet ID |

All scraper keys can also be configured from **Settings** in the app.

---

## API Reference

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create project with keywords |
| GET | `/api/projects/[id]` | Get project with keywords + products |
| PATCH | `/api/projects/[id]` | Update project name |
| POST | `/api/projects/[id]/run` | Start or retry batch |
| POST | `/api/projects/[id]/stop` | Stop a running batch |
| PATCH | `/api/projects/[id]/products/[productId]` | Toggle product exclusion |
| GET | `/api/projects/[id]/export?format=json\|csv\|roundup` | Export results |

**POST /api/projects**
```json
{
  "keywords": ["best robotic pool cleaners", "best pool vacuum"],
  "profileId": 1,
  "productsPerKeyword": 15,
  "randomProducts": true,
  "randomMin": 7,
  "scrapeMode": "fast",
  "concurrency": 20,
  "name": "Pool Cleaners Roundup"
}
```

### Profiles

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/profiles` | List all profiles |
| POST | `/api/profiles` | Create a profile |
| GET | `/api/profiles/[id]` | Get a profile |
| PUT | `/api/profiles/[id]` | Update a profile |
| DELETE | `/api/profiles/[id]` | Delete a profile |

### Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings/scrapers` | List all scrapers with status and plans |
| POST | `/api/settings/scrapers` | Set key, toggle, or change plan |
| GET | `/api/settings/google` | Google Sheets config status |
| POST | `/api/settings/google` | Upload service account or set sheet ID |
| GET | `/api/scrapers` | Active scraper summary + plan limits |

### Google Sheets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sheets/config` | Config status + sheet name |
| GET | `/api/sheets/keywords?tab=SheetTab` | Read keywords from sheet |
| POST | `/api/sheets/keywords` | List available tabs |
| POST | `/api/sheets/export` | Write results to sheet |

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
| Scraping | Multi-provider pool (ScrapeOwl, ScraperAPI, ScrapingBee, ZenRows, DataForSEO) |
| Concurrency | p-limit |
| Google Sheets | googleapis npm |

---

## Project Structure

```
grimfaste-roundupforge/
├── prisma/
│   └── schema.prisma                 # Database schema (4 models)
├── scripts/
│   └── sheets-sync.sh                # Google Workspace CLI helper
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout with nav + Grimfaste footer
│   │   ├── page.tsx                   # Home — keywords, Sheets, batch config
│   │   ├── profiles/page.tsx          # Scrape profile editor
│   │   ├── projects/[id]/page.tsx     # Results — progress, products, export
│   │   ├── settings/page.tsx          # API keys, plans, Google Sheets setup
│   │   └── api/
│   │       ├── profiles/              # Profile CRUD
│   │       ├── projects/              # Project CRUD, run, stop, export
│   │       ├── scrapers/              # Active scraper status
│   │       ├── settings/              # Scraper keys + Google config
│   │       └── sheets/               # Google Sheets read/write
│   ├── lib/
│   │   ├── prisma.ts                  # Prisma client singleton
│   │   ├── services/                  # Profile, project, product services
│   │   ├── scraping/                  # Adapter interface + 5 implementations + pool
│   │   ├── sheets/                    # Google Sheets service
│   │   ├── jobs/                      # Batch runner + cancellation
│   │   └── export/                    # CSV + Roundup serializers
│   └── types/index.ts                 # TypeScript interfaces
├── docs/design/DESIGN.md             # Architecture & design document
├── .env.example
└── package.json
```

---

## Development

```bash
npm run dev              # Start dev server
npx tsc --noEmit         # Type check
npm run build            # Production build
npx prisma db push       # Push schema changes
npx prisma generate      # Regenerate Prisma client
npx prisma studio        # Browse database
```

---

## About

**RoundupForge** is a free, open-source tool built and maintained by [Grimfaste](https://grimfaste.com) — the analytics command center for publishers managing hundreds of WordPress sites.

Grimfaste provides real-time traffic analytics, content intelligence, revenue tracking, automated content decay detection, and AI-powered Amazon product box templates across your entire site portfolio.

[Learn more at grimfaste.com](https://grimfaste.com)
