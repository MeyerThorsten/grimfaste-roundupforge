import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/settings/llm/models?type=openai-compatible&baseUrl=...&apiKey=...
 * Fetches available models from the provider's API.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "openai-compatible";
  const baseUrl = searchParams.get("baseUrl") || "";
  const apiKey = searchParams.get("apiKey") || "";

  if (!baseUrl) {
    return NextResponse.json({ error: "baseUrl required" }, { status: 400 });
  }

  try {
    if (type === "anthropic") {
      return NextResponse.json({
        models: [
          "claude-opus-4-20250514",
          "claude-sonnet-4-20250514",
          "claude-haiku-4-5-20251001",
        ],
      });
    }

    // OpenAI-compatible: fetch from /models endpoint
    const url = `${baseUrl.replace(/\/$/, "")}/models`;
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });

    if (!res.ok) {
      return NextResponse.json({
        models: getDefaultModels(baseUrl),
        fallback: true,
      });
    }

    const data = await res.json();
    const models: string[] = (data.data || data)
      .map((m: { id?: string }) => m.id)
      .filter(Boolean)
      .sort();

    return NextResponse.json({ models });
  } catch {
    return NextResponse.json({
      models: getDefaultModels(baseUrl),
      fallback: true,
    });
  }
}

function getDefaultModels(baseUrl: string): string[] {
  if (baseUrl.includes("openai.com")) {
    return [
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4.1",
      "gpt-4.1-mini",
      "gpt-4.1-nano",
    ];
  }
  if (baseUrl.includes("openrouter.ai")) {
    return [
      "openai/gpt-4o",
      "openai/gpt-4o-mini",
      "anthropic/claude-sonnet-4",
      "anthropic/claude-haiku-4.5",
      "meta-llama/llama-3.1-70b-instruct",
      "meta-llama/llama-3.1-8b-instruct",
    ];
  }
  if (baseUrl.includes("localhost:11434")) {
    return ["llama3.1:8b", "llama3.1:70b", "qwen2.5:7b", "mistral:7b", "gemma2:9b"];
  }
  if (baseUrl.includes("localhost:1234")) {
    return ["local-model"];
  }
  return ["gpt-4o", "gpt-4o-mini"];
}
