/**
 * LLM Provider abstraction — unified interface for chat completion.
 */

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  finishReason: string;
}

export interface LLMOptions {
  maxTokens?: number;
  temperature?: number;
}

export interface LLMProvider {
  chat(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse>;
  testConnection(): Promise<{ ok: boolean; error?: string; model?: string }>;
  getName(): string;
}
