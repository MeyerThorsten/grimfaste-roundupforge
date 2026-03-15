/** Collapse whitespace, trim, remove zero-width characters */
export function normalizeText(text: string): string {
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Remove exact-duplicate texts (case-insensitive comparison) */
export function dedupeTexts(texts: string[]): string[] {
  const seen = new Set<string>();
  return texts.filter((t) => {
    const key = t.toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Join texts with separator for merged output */
export function buildMergedText(texts: string[]): string {
  return texts.filter(Boolean).join('\n\n---\n\n');
}
