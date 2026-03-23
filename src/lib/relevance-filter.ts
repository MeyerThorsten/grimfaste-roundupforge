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
        content: `You are a product relevance filter. Given a search keyword and a list of Amazon products, score each product's relevance from 0-100.

BE VERY CONSERVATIVE — when in doubt, score HIGH and keep the product. Your job is only to remove products that are clearly in the WRONG CATEGORY, not to judge quality or exact fit.

Scoring rules:
- 80-100: Product is in the same category as the keyword. Keep it. A "500 sq ft wood stove" search should keep ALL wood stoves regardless of size.
- 60-79: Product is related but a different variant (e.g., different size, material, fuel type). Still keep it.
- 30-59: Product is an accessory, replacement part, or add-on (e.g., stove pipe, ash bucket, heat shield for a "wood stove" search).
- 0-29: Product is completely unrelated to the search (e.g., a book or clothing item showing up in a stove search).

IMPORTANT: Different sizes, brands, models, or variations of the searched product type should ALL score 80+. Do NOT penalize products for being too big, too small, too expensive, or a slightly different style. Only drop products that are genuinely NOT the type of product being searched for.

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
