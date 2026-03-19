/**
 * Relevance filter — uses the LLM to score product relevance to a keyword.
 * Drops products that don't match the search intent.
 */

import { getProvider } from "@/lib/llm/get-provider";

interface ProductForScoring {
  id: number;
  asin: string;
  title: string;
}

interface RelevanceResult {
  kept: ProductForScoring[];
  dropped: ProductForScoring[];
}

/**
 * Score products for relevance and drop irrelevant ones.
 */
export async function filterByRelevance(
  keyword: string,
  products: ProductForScoring[],
  threshold: number = 50
): Promise<RelevanceResult> {
  if (products.length === 0) return { kept: [], dropped: [] };

  const provider = await getProvider();

  const productList = products
    .map((p, i) => `${i + 1}. [${p.asin}] ${p.title}`)
    .join("\n");

  const response = await provider.chat(
    [
      {
        role: "system",
        content: `You are a product relevance scorer. Given a search keyword and a list of Amazon products, score each product's relevance from 0-100.

A score of 100 means the product is exactly what someone searching this keyword wants.
A score of 0 means the product is completely unrelated.

Products that are accessories, chargers, cases, or add-ons for the searched product (but not the product itself) should score below 30.
Products that are the actual searched item should score 70+.
Renewed/refurbished versions of the actual product should score 60+.

Respond with ONLY a JSON array of objects: [{"asin": "...", "score": number, "reason": "brief reason"}]
No markdown, no code fences.`,
      },
      {
        role: "user",
        content: `Keyword: "${keyword}"

Products:
${productList}

Score each product's relevance to the keyword.`,
      },
    ],
    { maxTokens: 2048, temperature: 0.1 }
  );

  const jsonMatch = response.content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.warn("Relevance filter: LLM did not return valid JSON, keeping all products");
    return { kept: products, dropped: [] };
  }

  let scores: { asin: string; score: number; reason?: string }[];
  try {
    scores = JSON.parse(jsonMatch[0]);
  } catch {
    console.warn("Relevance filter: failed to parse scores, keeping all products");
    return { kept: products, dropped: [] };
  }

  const scoreMap = new Map(scores.map((s) => [s.asin, s]));

  const kept: ProductForScoring[] = [];
  const dropped: ProductForScoring[] = [];

  for (const product of products) {
    const scoreEntry = scoreMap.get(product.asin);
    const score = scoreEntry?.score ?? 100;
    if (score >= threshold) {
      kept.push(product);
    } else {
      dropped.push(product);
      console.log(
        `Relevance filter: dropped "${product.title}" (score: ${score}, reason: ${scoreEntry?.reason || "unknown"})`
      );
    }
  }

  console.log(
    `Relevance filter: kept ${kept.length}/${products.length} products (threshold: ${threshold})`
  );
  return { kept, dropped };
}
