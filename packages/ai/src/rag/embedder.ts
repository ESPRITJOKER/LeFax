import type { Embedder } from "./types.js";

export class BgeM3Embedder implements Embedder {
  private serviceUrl: string;

  constructor(serviceUrl: string) {
    this.serviceUrl = serviceUrl.replace(/\/$/, "");
  }

  async embed(text: string): Promise<number[]> {
    const resp = await fetch(`${this.serviceUrl}/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Embedding service error ${resp.status}: ${err}`);
    }

    const data = (await resp.json()) as { embedding: number[] };
    return data.embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const resp = await fetch(`${this.serviceUrl}/embed_batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Embedding service batch error ${resp.status}: ${err}`);
    }

    const data = (await resp.json()) as { embeddings: number[][] };
    return data.embeddings;
  }
}
