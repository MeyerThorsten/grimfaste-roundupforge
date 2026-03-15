export interface ScraperAdapter {
  fetchPage(url: string): Promise<string>;
  getName(): string;
}
