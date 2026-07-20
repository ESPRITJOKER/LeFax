import { Worker } from "bullmq";

const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };

const embeddingWorker = new Worker(
  "embedding",
  async (job) => {
    const { texts, sourceType, sourceId, metadata } = job.data;

    const embeddingUrl = process.env.EMBEDDING_SERVICE_URL ?? "http://localhost:8080";

    const embedResp = await fetch(`${embeddingUrl}/embed_batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts }),
    });

    if (!embedResp.ok) {
      throw new Error(`Embedding service error: ${embedResp.status}`);
    }

    const { embeddings } = (await embedResp.json()) as { embeddings: number[][] };

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    for (let i = 0; i < texts.length; i++) {
      const resp = await fetch(`${supabaseUrl}/rest/v1/rag_chunks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey!,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          source_type: sourceType,
          source_id: sourceId,
          content: texts[i],
          embedding: JSON.stringify(embeddings[i]),
          metadata: metadata ?? {},
        }),
      });

      if (!resp.ok) {
        console.error(`Failed to store chunk ${i}:`, await resp.text());
      }
    }

    return { indexed: texts.length };
  },
  {
    connection,
    concurrency: 3,
  }
);

embeddingWorker.on("failed", (job, err) => {
  console.error(`Embedding job ${job?.id} failed:`, err.message);
});

console.log("Embedding worker started");

export default embeddingWorker;
