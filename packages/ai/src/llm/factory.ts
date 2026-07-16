import type { LlmProvider } from "../types.js";
import { MistralProvider } from "./providers/mistral.js";
import { OpenAIProvider } from "./providers/openai.js";
import { AnthropicProvider } from "./providers/anthropic.js";

export interface LlmFactoryConfig {
  provider: "mistral" | "openai" | "anthropic";
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export function createLlmProvider(config: LlmFactoryConfig): LlmProvider {
  switch (config.provider) {
    case "mistral":
      return new MistralProvider(config);
    case "openai":
      return new OpenAIProvider(config);
    case "anthropic":
      return new AnthropicProvider(config);
    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`);
  }
}
