import { Worker } from "bullmq";

const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };

const inferenceWorker = new Worker(
  "inference",
  async (job) => {
    const { provider, messages, temperature, maxTokens } = job.data;

    const apiKeyEnvMap: Record<string, string> = {
      mistral: "MISTRAL_API_KEY",
      openai: "OPENAI_API_KEY",
      anthropic: "ANTHROPIC_API_KEY",
    };

    const apiKey = process.env[apiKeyEnvMap[provider] ?? ""] ?? "";
    if (!apiKey) throw new Error(`No API key for provider: ${provider}`);

    const baseUrlMap: Record<string, string> = {
      mistral: process.env.MISTRAL_BASE_URL ?? "https://api.mistral.ai/v1",
      openai: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      anthropic: process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com/v1",
    };

    const baseUrl = baseUrlMap[provider];

    if (provider === "anthropic") {
      const systemMsg = messages.find((m: any) => m.role === "system");
      const nonSystemMsgs = messages.filter((m: any) => m.role !== "system");

      const resp = await fetch(`${baseUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
          max_tokens: maxTokens ?? 2048,
          system: systemMsg?.content,
          messages: nonSystemMsgs.map((m: any) => ({ role: m.role, content: m.content })),
          temperature: temperature ?? 0.7,
        }),
      });

      if (!resp.ok) throw new Error(`Anthropic error ${resp.status}: ${await resp.text()}`);

      const data = (await resp.json()) as any;
      const text = data.content?.find((c: any) => c.type === "text")?.text ?? "";

      return {
        content: text,
        usage: {
          promptTokens: data.usage?.input_tokens ?? 0,
          completionTokens: data.usage?.output_tokens ?? 0,
          totalTokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
        },
        model: data.model ?? "",
      };
    }

    // Mistral and OpenAI use the same API format
    const defaultModels: Record<string, string> = {
      mistral: "mistral-small-latest",
      openai: "gpt-4o",
    };

    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: defaultModels[provider] ?? "mistral-small-latest",
        messages,
        temperature: temperature ?? 0.7,
        max_tokens: maxTokens ?? 2048,
      }),
    });

    if (!resp.ok) throw new Error(`${provider} API error ${resp.status}: ${await resp.text()}`);

    const data = (await resp.json()) as any;

    return {
      content: data.choices?.[0]?.message?.content ?? "",
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
      model: data.model ?? "",
    };
  },
  {
    connection,
    concurrency: 5,
    limiter: { max: 10, duration: 60_000 },
  }
);

inferenceWorker.on("failed", (job, err) => {
  console.error(`Inference job ${job?.id} failed:`, err.message);
});

inferenceWorker.on("completed", (job) => {
  console.log(`Inference job ${job.id} completed`);
});

console.log("Inference worker started");

export default inferenceWorker;
