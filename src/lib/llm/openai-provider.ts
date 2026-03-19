/**
 * OpenAI-compatible provider — works with OpenAI, OpenRouter, Ollama, LM Studio.
 */

import { LLMProvider, LLMMessage, LLMResponse, LLMOptions } from "./provider";

interface ProviderConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export class OpenAICompatibleProvider implements LLMProvider {
  constructor(private config: ProviderConfig) {}

  getName(): string {
    return this.config.name;
  }

  async chat(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse> {
    const url = `${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.config.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.config.model,
        messages,
        max_tokens: options?.maxTokens || 4096,
        temperature: options?.temperature ?? 0.7,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${this.config.name} API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];

    return {
      content: choice?.message?.content || "",
      model: data.model || this.config.model,
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
      finishReason: choice?.finish_reason || "unknown",
    };
  }

  async testConnection(): Promise<{ ok: boolean; error?: string; model?: string }> {
    try {
      const result = await this.chat(
        [{ role: "user", content: "Say hi in one word." }],
        { maxTokens: 10 }
      );
      return { ok: true, model: result.model };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }
}
