# Mixed Keyword + Product URL Input

## Problem

RoundupForge only accepts keywords. Users must rely on Amazon search results to discover products. When the user already knows which specific products to include (e.g., curating a MacBook roundup), there is no way to provide product URLs directly. This forces unnecessary search steps and gives no control over which products appear.

## Solution

Extend the existing textarea input to accept a mixed format: keyword lines and Amazon product URL lines. The system parses the input, groups URLs under their preceding keyword, and either searches Amazon (no URLs) or directly scrapes the specified products (has URLs).

## Input Format

Each line in the textarea is one of:

- **Keyword line** — any non-blank line that is not an Amazon URL. Starts a new group.
- **URL line** — any line containing `amazon.com` (or `amazon.<tld>`) with `/dp/<ASIN>` or `/gp/product/<ASIN>` anywhere in the path. Belongs to the most recent keyword group.
- **Blank line** — ignored, used as cosmetic separator.

### Accepted URL Formats

All of these are valid and will be recognized:

```
https://www.amazon.com/dp/B0DLHDCN6P
https://amazon.com/dp/B0DLHDCN6P
https://www.amazon.com/Apple-MacBook-Laptop-12-core-18-core/dp/B0DLHDCN6P/ref=sr_1_1
https://www.amazon.com/dp/B0DLHDCN6P?th=1&psc=1
https://www.amazon.com/gp/product/B0DLHDCN6P
http://www.amazon.com/dp/B0DLHDCN6P
```

The URL detection regex: `/^https?:\/\/(www\.)?amazon\.\w+\/.*(\/dp\/|\/gp\/product\/)[A-Z0-9]{10}/i`

ASIN extraction reuses the existing `extractAsin()` from `url-builder.ts`.

### Validation Rules

- URL lines before any keyword line = error. Every URL group must have a keyword above it.
- A keyword with no URLs below it = normal search mode (existing behavior).
- A keyword with URLs below it = direct scrape mode (skip Amazon search, scrape listed products).
- Duplicate URLs within the same keyword group are silently deduplicated by ASIN.

### Example Input

```
Best 16-inch MacBook Pro configurations
https://www.amazon.com/dp/B0DLHDCN6P
https://www.amazon.com/dp/B0DLHMYX53
https://www.amazon.com/dp/B0DLHTNHZJ

Best MacBook Pro for video editing
https://www.amazon.com/dp/B0FWD6SKL6
https://www.amazon.com/dp/B0FWD8WBSW

Best iMac for home office power users
Best Mac mini for software development
```

Parsed result: 4 keyword groups. First two have specific products. Last two will search Amazon.

## UI Changes

### Counter (header above textarea)

Current: `12 keywords`
New: `4 keywords · 5 products` (only shows product count when > 0)

### Live Preview (below textarea)

A list of parsed groups rendered below the textarea, updating as the user types (debounced). Each entry shows:

- Keyword text
- Product count or "will search Amazon"

Example:
```
Best 16-inch MacBook Pro configurations — 3 products
Best MacBook Pro for video editing — 2 products
Best iMac for home office power users — will search Amazon
Best Mac mini for software development — will search Amazon
```

Validation errors shown in red above the preview:
```
⚠ 3 product URLs have no keyword above them
```

The preview only appears when the textarea has content.

### Fast Mode Info Note

When fast mode is selected and direct-URL keywords are present, show an info note in the preview:
```
ℹ Direct product URLs always use full scrape mode (1 API call per product)
```

### Estimated API Calls

Update the "Est. calls" calculation:
- **Search-mode keywords**: `1 + productsPerKeyword` calls (full mode) or `1` call (fast mode) — unchanged
- **Direct-URL keywords**: number of URLs (always full scrape, no search call)

## Data Model Changes

### Prisma Schema

Add a `productUrls` field to `KeywordResult`:

```prisma
model KeywordResult {
  // ... existing fields ...
  productUrls String? // JSON array of Amazon URLs, null for search-mode keywords
}
```

Using a nullable String with JSON rather than a separate table, since this is a simple list of URLs tied 1:1 to a keyword. The column is nullable so existing rows are unaffected — no data migration needed.

### TypeScript Types

Add `productUrls` to `KeywordResultData` in `src/types/index.ts`:

```typescript
productUrls: string | null;
```

## API Changes

### `CreateProjectPayload` (types/index.ts)

Current:
```typescript
keywords: string[]
```

New:
```typescript
keywords: Array<{ keyword: string; urls: string[] }>
```

The `urls` array is empty for search-mode keywords.

### `POST /api/projects` (route.ts)

- Accept the new payload shape
- Validate: every entry must have a non-empty `keyword`
- Validate: all URLs match Amazon product URL pattern and contain extractable ASINs
- Pass URLs through to `createProject`

Backward compatibility: not needed. This is the only consumer; frontend and API change together.

## Service Changes

### `createProject` (project.service.ts)

Update signature to accept `Array<{ keyword: string; urls: string[] }>` instead of `string[]`.

The Prisma create call changes from:
```typescript
keywords: {
  create: keywords.map((keyword) => ({ keyword })),
}
```
to:
```typescript
keywords: {
  create: keywords.map(({ keyword, urls }) => ({
    keyword,
    productUrls: urls.length > 0 ? JSON.stringify(urls) : null,
  })),
}
```

### `getPendingKeywords` (project.service.ts)

Ensure `productUrls` is included in the selected fields so the runner can access it.

## Runner Changes

### `processKeyword` (runner.ts)

Add `productUrls` parameter (read from keyword record).

At the start of `processKeyword`, check if `productUrls` is set:

**If productUrls is set (direct mode):**
1. Parse the JSON URL array
2. Extract ASIN from each URL using existing `extractAsin()`
3. Build `ProductLink` objects: `{ url, title: '', asin, imageUrl: '', position }`
4. Skip Amazon search entirely
5. Set `searchUrl` to empty string on the keyword record
6. Proceed to product page scraping (same `extractProduct` flow as full mode)
7. Each product page visit extracts title, image, specs, reviews — same as today

**If productUrls is null (search mode):**
- Existing behavior unchanged

### Settings Interaction with Direct URLs

- **`productsPerKeyword`**: ignored for direct-URL keywords. All provided URLs are scraped. This setting only applies to search-mode keywords.
- **`randomProducts`**: ignored for direct-URL keywords. All provided URLs are scraped. Users curated these products intentionally.
- **Fast mode**: ignored for direct-URL keywords. There are no search results to pull data from, so each product page must be visited. The UI shows an info note about this.

## Frontend Parsing Logic

A pure function `parseKeywordInput(text: string)` that returns:

```typescript
{
  groups: Array<{ keyword: string; urls: string[] }>;
  errors: string[];  // e.g., "Line 3: product URL has no keyword above it"
  keywordCount: number;
  productCount: number;
}
```

Algorithm:
1. Split text by newlines
2. For each non-blank line:
   - If it matches Amazon URL pattern → extract ASIN, deduplicate within group, add to current group's URLs
   - If no current group exists → add to errors
   - Otherwise → start a new group with this line as keyword
3. Return groups, errors, counts

## Files Changed

| File | Change |
|------|--------|
| `src/app/page.tsx` | Textarea parsing, live preview component, updated counter display, API call estimate |
| `src/types/index.ts` | `CreateProjectPayload.keywords` type change, `KeywordResultData.productUrls` field |
| `src/app/api/projects/route.ts` | Accept new payload, validate URLs, pass to service |
| `prisma/schema.prisma` | Add `productUrls` nullable String to `KeywordResult` |
| `src/lib/services/project.service.ts` | `createProject` signature change, store `productUrls`, include in `getPendingKeywords` |
| `src/lib/jobs/runner.ts` | Direct-scrape branch in `processKeyword`, receive `productUrls` param |

## What Does Not Change

- Scrape profiles and their configuration
- Product extraction logic (`extractProduct`, `product-extractor.ts`)
- ASIN extraction (`url-builder.ts`)
- Concurrency controls
- Project detail pages, export, downstream features
- Google Sheets integration (keywords only, no URLs)

## Edge Cases

- **Duplicate ASINs across keywords**: allowed. Same product can appear under different keywords (same as today with search overlap).
- **Duplicate ASINs within a keyword**: silently deduplicated.
- **Invalid ASIN in URL**: validation error shown in preview, blocked from submission.
- **Mixed groups**: some keywords have URLs, some don't — fully supported, each processed independently.
- **Pretty URLs with title slugs**: handled — regex matches `/dp/ASIN` anywhere in the path.
- **`/gp/product/` URLs**: handled — regex and `extractAsin()` both support this format.
- **Non-US Amazon domains** (e.g., `amazon.co.uk`): handled — regex matches `amazon.\w+`.
- **`searchUrl` for direct keywords**: set to empty string. Project detail page already handles empty values.
