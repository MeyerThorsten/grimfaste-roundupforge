export interface FetchOptions {
  renderJs?: boolean;
  country?: string;
  onCredit?: (credits: number) => void;
}

export interface ScraperAdapter {
  fetchPage(url: string, options?: FetchOptions): Promise<string>;
  getName(): string;
}
