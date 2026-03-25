export interface FetchOptions {
  renderJs?: boolean;
  country?: string;
}

export interface ScraperAdapter {
  fetchPage(url: string, options?: FetchOptions): Promise<string>;
  getName(): string;
}
