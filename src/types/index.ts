// ── Text Selector Entry ─────────────────────────────────────────
export interface TextSelectorEntry {
  label: string;
  selector: string;
  treatAsReview: boolean;
}

// ── Scrape Profile (app-level) ──────────────────────────────────
export interface ScrapeProfileData {
  id: number;
  name: string;
  domain: string;
  titleSelector: string;
  imageSelector: string;
  textSelectors: TextSelectorEntry[];
  affiliateCode: string;
  treatAsReview: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ScrapeProfileCreateInput = Omit<ScrapeProfileData, 'id' | 'createdAt' | 'updatedAt'>;
export type ScrapeProfileUpdateInput = Partial<ScrapeProfileCreateInput>;

// ── Project ─────────────────────────────────────────────────────
export type ProjectStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed';

export type ScrapeMode = 'full' | 'fast';

export interface ProjectData {
  id: number;
  name: string;
  status: ProjectStatus;
  profileId: number;
  productsPerKeyword: number;
  randomProducts: boolean;
  randomMin: number;
  scrapeMode: ScrapeMode;
  concurrency: number;
  totalKeywords: number;
  completedKeywords: number;
  failedKeywords: number;
  elapsedMs: number;
  relevanceFilter: boolean;
  relevanceThreshold: number;
  relevanceStatus: string;
  relevanceDropped: number;
  relevanceProgress: number;
  relevanceTotal: number;
  relevanceError: string;
  queuedAt: string | null;
  sheetsSpreadsheetId: string;
  createdAt: string;
  updatedAt: string;
}

// ── Keyword Result ──────────────────────────────────────────────
export type KeywordStatus = 'pending' | 'running' | 'success' | 'failed';

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

// ── Product ─────────────────────────────────────────────────────
export interface ProductData {
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
  scrapeDebug: string;
  position: number;
  excluded: boolean;
  createdAt: string;
}

// ── Scraper Adapter ─────────────────────────────────────────────
export interface ScraperAdapter {
  fetchPage(url: string): Promise<string>;
  getName(): string;
}

// ── Extracted Data (internal pipeline) ──────────────────────────
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
  keywords: Array<{ keyword: string; urls: string[] }>;
  profileId: number;
  productsPerKeyword: number;
  randomProducts?: boolean;
  randomMin?: number;
  scrapeMode?: ScrapeMode;
  concurrency?: number;
  name?: string;
  relevanceFilter?: boolean;
  relevanceThreshold?: number;
}

export interface KeywordWithProducts extends KeywordResultData {
  products: ProductData[];
}

export interface ProjectWithKeywords extends ProjectData {
  keywords: KeywordWithProducts[];
}

export interface ProjectExport {
  project: ProjectData;
  keywords: KeywordWithProducts[];
}
