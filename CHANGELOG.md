# Changelog

## [1.3.0] - 2026-04-01

### Added
- **Bulk Queue from Google Sheets** — "Queue All Tabs" button loads keywords from every sheet tab and creates/queues a project for each one automatically
- **Dashboard / Analytics** — new `/dashboard` page with overview stats (projects, keywords, products, credits, success rate), daily activity table, and recent projects with performance metrics
- **Dashboard API** — `GET /api/dashboard` returns aggregated stats, status distribution, and 30-day daily breakdown
- **Bulk Queue API** — `POST /api/bulk-queue` accepts spreadsheet ID and creates projects from all tabs

## [1.2.0] - 2026-04-01

### Added
- **Sequential Project Queue** — projects auto-queue on creation and run one at a time; next project starts automatically when current one finishes
- **Global Max Concurrency** — configurable on Settings page (1-50), caps per-project concurrency across all jobs
- **ScrapeOwl Credit Tracking** — tracks credits consumed per project, displayed on project detail page
- **Typed Error Classification** — scraper errors are now typed (RateLimitError, BlockedError, TimeoutError, ParseError, AuthError) enabling smarter retry strategies
- **Exponential Backoff with Jitter** — replaces fixed 4s retry delay with `min(2s * 2^attempt + jitter, 30s)`; respects `retry-after` headers for rate limits
- **Browser Notifications** — desktop notification when a project completes or fails (requests permission when project starts running)
- **Scrape Lifecycle Hooks** — extensible hook system: preScrape (can skip keywords), postScrape (with results), onFailure (with error context)
- **Scraper Plugin Registry** — scrapers registered via plugin interface instead of hardcoded if/else; foundation for custom scraper backends
- **Export Versioning** — each export saves a snapshot record (format, content hash, product count, timestamp) for audit trail
- **Server-Sent Events (SSE) Progress** — real-time progress streaming via `/api/projects/{id}/progress` with polling fallback
- **Queue Status API** — `GET /api/queue` returns running project and queued list with positions
- **Queue Recovery** — on server restart, orphaned "running" projects are marked failed and queue auto-resumes

### Changed
- **Retry/Resume bypasses queue** — runs immediately in parallel with current queued project
- **Project creation auto-queues** — no longer requires separate `/run` API call
- **Scraper adapters use typed errors** — ScrapeOwl, ScraperAPI, ScrapingBee all throw classified errors
- **Graceful shutdown** — SIGTERM/SIGINT handlers registered for clean process termination

## [1.1.0] - 2026-03-23

### Changed
- **Relevance Filter is now manual only** — removed auto-run after scraping to avoid competing with concurrent scraping jobs and give users control over when to filter
- **Improved relevance filter prompt** — much more conservative scoring; only drops genuinely wrong-category products (accessories, toys, unrelated items), keeps all product variants regardless of size/brand/model
- **Reduced ScrapeOwl credit usage** — disabled `premium_proxies` and `render_js` by default (~87% credit reduction)
- **"Save All in One File" for Export Roundup** — when split into packs, adds option to download all packs combined into a single text file

### Added
- **"Run on All Keywords" button** — in the Relevance Filter modal, runs per-keyword filtering with progress tracking
- **Relevance filter progress tracking** — shows live progress (e.g., "45/300 keywords") instead of generic spinner
- **Per-keyword error resilience** — single LLM failures no longer abort the entire filter; errors are counted and shown
- **Error visibility** — relevance filter errors are stored and displayed in the UI badge

### Fixed
- Fixed UI polling stopping when scraping completed, leaving relevance status badge stale
- Fixed relevance filter not starting due to stale Prisma client after migrations

## [1.0.0] - 2026-03-20

### Features
- **Amazon Roundup Scout**: Paste keywords or load from Google Sheets, scrape Amazon search results and product pages, export structured product data
- **Google Sheets Integration**: Load keywords from tabs, auto-sync results back on completion, status sheet tracking
- **Multi-Scraper Pool**: Support for ScrapeOwl and ScraperAPI with automatic failover
- **Fast Mode**: Search-page-only scraping (1 API call per keyword) vs Full mode (1 + N calls per keyword)
- **Random Product Count**: Configurable min/max range for products per keyword (default 7–15)
- **Mixed Input**: Enter keywords and Amazon product URLs together — URLs are scraped directly
- **Auto-Retry**: Failed keywords automatically retry up to 4 times with 30s delay between attempts
- **Stop Batch**: Cancel running projects mid-scrape with clean state recovery
- **LLM Provider System**: Add OpenAI-compatible or Anthropic providers with quick presets (OpenAI, Claude, OpenRouter, Ollama, LM Studio) and model auto-detection
- **Relevance Filter**: LLM-based product scoring — manually from project detail page or automatically after scraping completes
- **Auto-Relevance Filter**: Toggle on home page with configurable threshold (10–90), runs per-keyword after project completes
- **Scrape Profiles**: Configurable CSS selectors per marketplace (title, image, text sections, affiliate code)
- **Roundup Export**: Text export with ZimmWriter-compatible formatting, auto-split into packs of 100
- **JSON/CSV Export**: Download structured product data in JSON or CSV format
- **Project Management**: Name projects, track progress, view per-keyword results with expandable product details
- **Product Exclusion**: Manually include/exclude products from exports
- **Concurrency Control**: Adjustable concurrent scraper calls (1–25)

### Defaults
- Products per keyword: 15
- Random product count: enabled (min 7, max 15)
- Scrape mode: Fast
- Concurrency: 20
- Relevance threshold: 50

### Technical
- Next.js 16 App Router + TypeScript + Tailwind CSS
- Prisma ORM with SQLite
- Cheerio for HTML parsing
- p-limit for concurrency control
- Server-side scraping with progress tracking via DB polling
