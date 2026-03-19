# Mixed Keyword + Product URL Input — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to paste Amazon product URLs under keywords in the existing textarea, so the runner scrapes those specific products instead of searching Amazon.

**Architecture:** Parse the textarea into keyword groups (keyword + optional URLs). The API accepts structured groups. The runner checks each keyword for attached URLs — if present, it builds ProductLink objects from the ASINs and scrapes each product page directly, skipping the Amazon search step.

**Tech Stack:** Next.js (App Router), TypeScript, Prisma (SQLite), React

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/parsing/keyword-parser.ts` | Create | Pure parsing function: text → keyword groups |
| `src/types/index.ts` | Modify | Add `productUrls` to types, update `CreateProjectPayload` |
| `prisma/schema.prisma` | Modify | Add `productUrls` field to `KeywordResult` |
| `src/lib/services/project.service.ts` | Modify | Accept structured keywords, store `productUrls`, expose in queries |
| `src/app/api/projects/route.ts` | Modify | Accept new payload shape, validate URLs |
| `src/lib/jobs/runner.ts` | Modify | Direct-scrape path when `productUrls` is set |
| `src/app/page.tsx` | Modify | Use parser, show live preview, update counter and API call estimate |

---

### Task 1: Create the keyword parser

**Files:**
- Create: `src/lib/parsing/keyword-parser.ts`

- [ ] **Step 1: Create the parser module**

Create `src/lib/parsing/keyword-parser.ts`:

```typescript
import { extractAsin } from '@/lib/scraping/url-builder';

const AMAZON_URL_PATTERN = /^https?:\/\/(www\.)?amazon\.\w+\/.*(\/dp\/|\/gp\/product\/)[A-Z0-9]{10}/i;

export interface KeywordGroup {
  keyword: string;
  urls: string[];
}

export interface ParseResult {
  groups: KeywordGroup[];
  errors: string[];
  keywordCount: number;
  productCount: number;
}

export function isAmazonUrl(line: string): boolean {
  return AMAZON_URL_PATTERN.test(line);
}

export function parseKeywordInput(text: string): ParseResult {
  const lines = text.split('\n');
  const groups: KeywordGroup[] = [];
  const errors: string[] = [];
  let currentGroup: KeywordGroup | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (isAmazonUrl(line)) {
      if (!currentGroup) {
        errors.push(`Line ${i + 1}: product URL has no keyword above it`);
        continue;
      }
      const asin = extractAsin(line);
      if (!asin) {
        errors.push(`Line ${i + 1}: could not extract ASIN from URL`);
        continue;
      }
      // Deduplicate by ASIN within group
      const existingAsins = currentGroup.urls.map((u) => extractAsin(u));
      if (!existingAsins.includes(asin)) {
        currentGroup.urls.push(line);
      }
    } else {
      currentGroup = { keyword: line, urls: [] };
      groups.push(currentGroup);
    }
  }

  const productCount = groups.reduce((sum, g) => sum + g.urls.length, 0);

  return {
    groups,
    errors,
    keywordCount: groups.length,
    productCount,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/thorstenmeyer/Dev/grimfaste-roundupforge && npx tsc --noEmit`
Expected: PASS (no errors)

- [ ] **Step 3: Commit**

```bash
git add src/lib/parsing/keyword-parser.ts
git commit -m "feat: add keyword+URL parser for mixed input"
```

---

### Task 2: Update Prisma schema and types

**Files:**
- Modify: `prisma/schema.prisma` (line 45–55, KeywordResult model)
- Modify: `src/types/index.ts` (lines 52–60 KeywordResultData, lines 115–124 CreateProjectPayload)

- [ ] **Step 1: Add `productUrls` to Prisma schema**

In `prisma/schema.prisma`, add after `keyword String` (line 49):

```prisma
  productUrls  String?   // JSON array of Amazon URLs, null for search-mode keywords
```

So the `KeywordResult` model becomes:

```prisma
model KeywordResult {
  id           Int       @id @default(autoincrement())
  projectId    Int
  project      Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  keyword      String
  productUrls  String?   // JSON array of Amazon URLs, null for search-mode keywords
  searchUrl    String    @default("")
  status       String    @default("pending")
  errorMessage String?
  createdAt    DateTime  @default(now())
  products     Product[]
}
```

- [ ] **Step 2: Run Prisma migration**

Run: `cd /Users/thorstenmeyer/Dev/grimfaste-roundupforge && npx prisma migrate dev --name add-product-urls-to-keyword`
Expected: Migration created and applied successfully.

- [ ] **Step 3: Update `KeywordResultData` in types**

In `src/types/index.ts`, add `productUrls` to `KeywordResultData` (after line 56 `searchUrl`):

```typescript
export interface KeywordResultData {
  id: number;
  projectId: number;
  keyword: string;
  productUrls: string | null;
  searchUrl: string;
  status: KeywordStatus;
  errorMessage: string | null;
  createdAt: string;
}
```

- [ ] **Step 4: Update `CreateProjectPayload` in types**

In `src/types/index.ts`, change the `keywords` field in `CreateProjectPayload`:

```typescript
export interface CreateProjectPayload {
  keywords: Array<{ keyword: string; urls: string[] }>;
  profileId: number;
  productsPerKeyword: number;
  randomProducts?: boolean;
  randomMin?: number;
  scrapeMode?: ScrapeMode;
  concurrency?: number;
  name?: string;
}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd /Users/thorstenmeyer/Dev/grimfaste-roundupforge && npx tsc --noEmit`
Expected: Will show errors in `project.service.ts`, `route.ts`, and `page.tsx` because they still use the old `string[]` type. That's expected — we fix them in the next tasks.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ src/types/index.ts src/generated/
git commit -m "feat: add productUrls field to KeywordResult schema and types"
```

---

### Task 3: Update project service

**Files:**
- Modify: `src/lib/services/project.service.ts` (lines 40–58 `toKeywordData`, lines 134–157 `createProject`, lines 182–187 `getPendingKeywords`)

- [ ] **Step 1: Update `toKeywordData` mapper**

In `src/lib/services/project.service.ts`, update the `toKeywordData` function (lines 40–58) to include `productUrls`:

Add `productUrls: string | null;` to the parameter type, and add `productUrls: row.productUrls ?? null,` to the return object:

```typescript
function toKeywordData(row: {
  id: number;
  projectId: number;
  keyword: string;
  productUrls: string | null;
  searchUrl: string;
  status: string;
  errorMessage: string | null;
  createdAt: Date;
}): KeywordResultData {
  return {
    id: row.id,
    projectId: row.projectId,
    keyword: row.keyword,
    productUrls: row.productUrls ?? null,
    searchUrl: row.searchUrl,
    status: row.status as KeywordResultData['status'],
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
  };
}
```

- [ ] **Step 2: Update `createProject` to accept structured keywords**

Change the `createProject` function signature and body (lines 134–157):

```typescript
export async function createProject(
  name: string,
  profileId: number,
  productsPerKeyword: number,
  keywords: Array<{ keyword: string; urls: string[] }>,
  options: { concurrency?: number; randomProducts?: boolean; randomMin?: number; scrapeMode?: string } = {}
): Promise<ProjectData> {
  const row = await prisma.project.create({
    data: {
      name,
      profileId,
      productsPerKeyword,
      randomProducts: options.randomProducts ?? false,
      randomMin: options.randomMin ?? 5,
      scrapeMode: options.scrapeMode ?? 'full',
      concurrency: options.concurrency ?? 20,
      totalKeywords: keywords.length,
      keywords: {
        create: keywords.map(({ keyword, urls }) => ({
          keyword,
          productUrls: urls.length > 0 ? JSON.stringify(urls) : null,
        })),
      },
    },
  });
  return toProjectData(row);
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/thorstenmeyer/Dev/grimfaste-roundupforge && npx tsc --noEmit`
Expected: Still errors in `route.ts` and `page.tsx` (they still send `string[]`). Service-level errors should be resolved.

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/project.service.ts
git commit -m "feat: update project service to accept structured keyword groups with URLs"
```

---

### Task 4: Update API route

**Files:**
- Modify: `src/app/api/projects/route.ts` (lines 11–47)

- [ ] **Step 1: Update the POST handler**

Replace the POST handler in `src/app/api/projects/route.ts`:

```typescript
export async function POST(request: Request) {
  const body = (await request.json()) as CreateProjectPayload;

  if (!body.keywords || !Array.isArray(body.keywords) || body.keywords.length === 0) {
    return NextResponse.json({ error: 'keywords is required and must be a non-empty array' }, { status: 400 });
  }

  if (body.keywords.length > 10000) {
    return NextResponse.json({ error: 'Maximum 10,000 keywords allowed' }, { status: 400 });
  }

  // Validate each entry has a keyword
  for (const entry of body.keywords) {
    if (!entry.keyword || typeof entry.keyword !== 'string' || !entry.keyword.trim()) {
      return NextResponse.json({ error: 'Each keyword entry must have a non-empty keyword' }, { status: 400 });
    }
  }

  if (!body.profileId) {
    return NextResponse.json({ error: 'profileId is required' }, { status: 400 });
  }

  const profile = await getProfile(body.profileId);
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const keywords = body.keywords
    .map((entry) => ({
      keyword: entry.keyword.trim(),
      urls: Array.isArray(entry.urls) ? entry.urls.filter((u) => typeof u === 'string' && u.trim()) : [],
    }))
    .filter((entry) => entry.keyword);

  if (keywords.length === 0) {
    return NextResponse.json({ error: 'No valid keywords provided' }, { status: 400 });
  }

  const productsPerKeyword = Math.min(15, Math.max(3, body.productsPerKeyword || 5));
  const concurrency = Math.min(25, Math.max(1, body.concurrency || 20));
  const name = body.name || keywords[0].keyword.slice(0, 60);

  const project = await createProject(name, body.profileId, productsPerKeyword, keywords, {
    concurrency,
    randomProducts: body.randomProducts ?? false,
    randomMin: Math.min(body.randomMin || 5, productsPerKeyword),
    scrapeMode: body.scrapeMode === 'fast' ? 'fast' : 'full',
  });
  return NextResponse.json(project, { status: 201 });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/thorstenmeyer/Dev/grimfaste-roundupforge && npx tsc --noEmit`
Expected: Only `page.tsx` errors remain (still sends old format).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/projects/route.ts
git commit -m "feat: update projects API to accept keyword groups with URLs"
```

---

### Task 5: Update runner for direct-scrape mode

**Files:**
- Modify: `src/lib/jobs/runner.ts` (lines 59–69 task mapping, lines 128–239 `processKeyword`)

- [ ] **Step 1: Add `extractAsin` import**

In `src/lib/jobs/runner.ts`, add to the existing import from `url-builder.ts` (line 13):

```typescript
import { buildSearchUrl, extractAsin } from '@/lib/scraping/url-builder';
```

- [ ] **Step 2: Update the task mapping to pass `productUrls`**

In `src/lib/jobs/runner.ts`, update the task mapping (lines 59–69). The `kw` objects from `getPendingKeywords` now include `productUrls`. Change the `processKeyword` call to pass it, and skip `maxProducts`/`randomProducts` logic for direct-URL keywords:

```typescript
  const tasks = keywords.map((kw) =>
    limiter(async () => {
      if (isCancelled(projectId)) return;
      const hasDirectUrls = !!kw.productUrls;
      // For direct-URL keywords, ignore productsPerKeyword and randomProducts
      const maxProducts = hasDirectUrls
        ? 0 // unused — direct mode scrapes all provided URLs
        : project.randomProducts
          ? Math.floor(Math.random() * (project.productsPerKeyword - rMin + 1)) + rMin
          : project.productsPerKeyword;
      await processKeyword(kw.id, kw.keyword, profile, maxProducts, projectId, scraper, isFastMode, kw.productUrls);
      await delay(DELAY_MS);
    })
  );
```

Note: move the `rMin` declaration before the `tasks` block — it's currently inside the `.map` callback. Add before the `const tasks` line:

```typescript
  const rMin = project.randomMin || 5;
```

- [ ] **Step 3: Update `processKeyword` to handle direct URLs**

Update the `processKeyword` signature (line 128) to accept `productUrls`:

```typescript
async function processKeyword(
  kwId: number,
  keyword: string,
  profile: ScrapeProfileData,
  maxProducts: number,
  projectId: number,
  scraper: ReturnType<typeof getScraper>,
  fastMode = false,
  productUrls: string | null = null
) {
```

Then, at the start of the function body, right after the `await updateKeywordResult(kwId, { status: 'running' });` line (line 143), add the direct-scrape branch:

```typescript
    // Direct-URL mode: skip Amazon search, scrape provided product URLs
    if (productUrls) {
      const urls: string[] = JSON.parse(productUrls);
      const links = urls.map((url, i) => ({
        url,
        title: '',
        asin: extractAsin(url),
        imageUrl: '',
        position: i + 1,
      })).filter((link) => link.asin);

      logger.info('Direct-URL mode', { kwId, count: links.length });

      if (links.length === 0) {
        await updateKeywordResult(kwId, { status: 'failed', errorMessage: 'No valid ASINs found in provided URLs' });
        await incrementProjectProgress(projectId, false);
        return;
      }

      await deleteProductsByKeyword(kwId);

      const productLimiter = pLimit(5);
      await Promise.all(
        links.map((link) =>
          productLimiter(async () => {
            if (isCancelled(projectId)) return;
            try {
              const product = await extractProduct(link, profile, scraper);
              await insertProduct(kwId, product);
            } catch (err) {
              logger.error('Product extraction failed', { kwId, url: link.url, error: String(err) });
            }
          })
        )
      );

      if (isCancelled(projectId)) {
        await updateKeywordResult(kwId, { status: 'pending' });
        return;
      }

      await updateKeywordResult(kwId, { status: 'success' });
      await incrementProjectProgress(projectId, true);
      logger.info('Keyword completed (direct)', { kwId, elapsed: Date.now() - startTime });
      return;
    }
```

This block goes between the `await updateKeywordResult(kwId, { status: 'running' });` line and the existing `// Build search URL` comment. The rest of the function (search flow) remains untouched.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Users/thorstenmeyer/Dev/grimfaste-roundupforge && npx tsc --noEmit`
Expected: Only `page.tsx` errors remain.

- [ ] **Step 5: Commit**

```bash
git add src/lib/jobs/runner.ts
git commit -m "feat: add direct-scrape path in runner for keywords with product URLs"
```

---

### Task 6: Update the frontend

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add parser import and replace counter logic**

In `src/app/page.tsx`, add the import at the top (after line 3):

```typescript
import { parseKeywordInput } from "@/lib/parsing/keyword-parser";
```

Replace the `keywordCount` computation (lines 83–86):

```typescript
  const parsed = parseKeywordInput(keywords);
```

- [ ] **Step 2: Update the label and counter display**

Replace the label and counter (lines 263–267):

```typescript
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">
              Keywords & Product URLs
            </label>
            <span className="text-xs text-gray-500">
              {parsed.keywordCount} keyword{parsed.keywordCount !== 1 ? "s" : ""}
              {parsed.productCount > 0 && ` · ${parsed.productCount} product${parsed.productCount !== 1 ? "s" : ""}`}
            </span>
          </div>
```

- [ ] **Step 3: Update the textarea placeholder**

Update the placeholder text (line 274):

```typescript
            placeholder={"best robotic pool cleaners for inground pools\nhttps://www.amazon.com/dp/B07C4P8MBL\nhttps://www.amazon.com/dp/B07BHTBDQ3\n\nbest cordless robotic pool cleaners"}
```

- [ ] **Step 4: Add live preview below textarea**

After the closing `</textarea>` tag (after line 275), add the preview:

```tsx
          {/* Live Preview */}
          {parsed.groups.length > 0 && (
            <div className="mt-2 space-y-1">
              {parsed.errors.length > 0 && (
                <div className="text-red-600 text-xs space-y-0.5">
                  {parsed.errors.map((err, i) => (
                    <p key={i}>{err}</p>
                  ))}
                </div>
              )}
              <div className="bg-gray-50 rounded-md border border-gray-200 p-3 space-y-1 max-h-40 overflow-y-auto">
                {parsed.groups.map((g, i) => (
                  <div key={i} className="text-xs text-gray-600 flex justify-between">
                    <span className="font-medium text-gray-800 truncate mr-2">{g.keyword}</span>
                    <span className="shrink-0">
                      {g.urls.length > 0
                        ? `${g.urls.length} product${g.urls.length !== 1 ? "s" : ""}`
                        : "will search Amazon"}
                    </span>
                  </div>
                ))}
              </div>
              {scrapeMode === "fast" && parsed.productCount > 0 && (
                <p className="text-xs text-blue-600">
                  Direct product URLs always use full scrape mode (1 API call per product)
                </p>
              )}
            </div>
          )}
```

- [ ] **Step 5: Update `handleRunBatch` to send structured data**

Replace the `handleRunBatch` function (lines 109–165):

```typescript
  async function handleRunBatch() {
    setError("");

    if (parsed.groups.length === 0) {
      setError("Enter at least one keyword");
      return;
    }
    if (parsed.errors.length > 0) {
      setError("Fix errors in the input before running");
      return;
    }
    if (parsed.keywordCount > 10000) {
      setError("Maximum 10,000 keywords allowed");
      return;
    }
    if (!profileId) {
      setError("Select a scrape profile");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: parsed.groups,
          profileId,
          productsPerKeyword,
          randomProducts,
          randomMin,
          scrapeMode,
          concurrency,
          name: projectName || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create project");
      }
      const project = await res.json();

      await fetch(`/api/projects/${project.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetsSpreadsheetId: syncToSheets && sheetsConfig?.defaultSpreadsheetId ? sheetsConfig.defaultSpreadsheetId : undefined,
        }),
      });

      router.push(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }
```

- [ ] **Step 6: Update the estimated API calls display**

Replace the "Est. calls" section (lines 388–393):

```tsx
          <div className="text-xs text-gray-500 bg-gray-50 rounded-md p-2">
            <strong>Est. calls:</strong>{" "}
            {(() => {
              const searchKeywords = parsed.groups.filter((g) => g.urls.length === 0).length;
              const directProducts = parsed.productCount;
              const perSearchKeyword = scrapeMode === "fast"
                ? 1
                : 1 + (randomProducts ? Math.round((randomMin + productsPerKeyword) / 2) : productsPerKeyword);
              const total = searchKeywords * perSearchKeyword + directProducts;
              const parts: string[] = [];
              if (searchKeywords > 0) parts.push(`${searchKeywords * perSearchKeyword} from ${searchKeywords} search keyword${searchKeywords !== 1 ? "s" : ""}`);
              if (directProducts > 0) parts.push(`${directProducts} from direct URLs`);
              return parts.length > 0 ? `~${total} (${parts.join(" + ")})` : "0";
            })()}
          </div>
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `cd /Users/thorstenmeyer/Dev/grimfaste-roundupforge && npx tsc --noEmit`
Expected: PASS — all errors resolved.

- [ ] **Step 8: Verify the build**

Run: `cd /Users/thorstenmeyer/Dev/grimfaste-roundupforge && npm run build`
Expected: Build succeeds.

- [ ] **Step 9: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add mixed keyword+URL input with live preview and updated estimates"
```

---

### Task 7: Manual end-to-end verification

- [ ] **Step 1: Start the dev server**

Run: `cd /Users/thorstenmeyer/Dev/grimfaste-roundupforge && npm run dev`

- [ ] **Step 2: Test pure keyword input (regression)**

Paste in the textarea:
```
best robotic pool cleaners
best cordless pool cleaners
```

Verify:
- Counter shows `2 keywords`
- Preview shows both as "will search Amazon"
- No errors

- [ ] **Step 3: Test mixed input**

Paste in the textarea:
```
Best 16-inch MacBook Pro configurations
https://www.amazon.com/dp/B0DLHDCN6P
https://www.amazon.com/dp/B0DLHMYX53

Best MacBook Pro for video editing
```

Verify:
- Counter shows `2 keywords · 2 products`
- Preview shows first keyword with "2 products", second as "will search Amazon"
- No errors

- [ ] **Step 4: Test validation error**

Paste in the textarea:
```
https://www.amazon.com/dp/B0DLHDCN6P
Best MacBook Pro
```

Verify:
- Red error: "Line 1: product URL has no keyword above it"
- Run Batch button should be blocked

- [ ] **Step 5: Test running a direct-URL project**

Create a small project with 1 keyword + 2 URLs and run it. Verify the products are scraped from the direct URLs (not from Amazon search).
