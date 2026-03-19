/**
 * Provider factory — resolves a provider from the database.
 */

import { prisma } from "@/lib/prisma";
import { LLMProvider } from "./provider";
import { OpenAICompatibleProvider } from "./openai-provider";

export async function getProvider(providerId?: number | null): Promise<LLMProvider> {
  let record;

  if (providerId) {
    record = await prisma.llmProvider.findUnique({
      where: { id: providerId },
    });
  } else {
    record = await prisma.llmProvider.findFirst({
      where: { enabled: true },
      orderBy: [{ isDefault: "desc" }, { id: "asc" }],
    });
  }

  if (!record) {
    throw new Error("No LLM provider configured. Go to Settings to add one.");
  }

  return new OpenAICompatibleProvider({
    name: record.name,
    baseUrl: record.baseUrl,
    apiKey: record.apiKey,
    model: record.model,
  });
}
