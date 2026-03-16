export interface FetchOptions {
  renderJs?: boolean;
}

export interface ScraperAdapter {
  fetchPage(url: string, options?: FetchOptions): Promise<string>;
  getName(): string;
}
