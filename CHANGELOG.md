# Changelog

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
