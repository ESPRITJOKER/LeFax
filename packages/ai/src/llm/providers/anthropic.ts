import type { LlmMessage, LlmOptions, LlmResponse, LlmProvider } from "../../types.js";

export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(config: { apiKey: string; baseUrl?: string; model?: string }) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? "https://api.anthropic.com/v1";
    this.defaultModel = config.model ?? "claude-sonnet-4-20250514";
  }

  async chat(messages: LlmMessage[], options?: LlmOptions): Promise<LlmResponse> {
    const systemMsg = messages.find((m) => m.role === "system");
    const nonSystemMsgs = messages.filter((m) => m.role !== "system");

    const body = {
      model: options?.model ?? this.defaultModel,
      max_tokens: options?.maxTokens ?? 2048,
      system: systemMsg?.content,
      messages: nonSystemMsgs.map((m) => ({ role: m.role, content: m.content })),
      temperature: options?.temperature ?? 0.7,
    };

    const resp = await fetch(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Anthropic API error ${resp.status}: ${err}`);
    }

    const data = (await resp.json()) as {
      content: Array<{ type: string; text: string }>;
      usage: { input_tokens: number; output_tokens: number };
      model: string;
    };

    const textContent = data.content.find((c) => c.type === "text");

    return {
      content: textContent?.text ?? "",
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
      model: data.model,
    };
  }
}
