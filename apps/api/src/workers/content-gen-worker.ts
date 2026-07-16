import { Worker } from "bullmq";

const connection = { url: process.env.REDIS_URL ?? "redis://localhost:6379" };

const contentGenWorker = new Worker(
  "content-generation",
  async (job) => {
    const { sourceType, sourceId, content, metadata } = job.data;

    // This worker handles post-approval indexing:
    // When a content draft is approved, index its content into RAG
    const embeddingUrl = process.env.EMBEDDING_SERVICE_URL ?? "http://localhost:8080";

    // Chunk the content
    const paragraphs = content.split(/\n\n+/).filter((p: string) => p.trim().length > 0);
    const chunks: string[] = [];
    let current = "";
    for (const para of paragraphs) {
      if (current.length + para.length + 2 > 1500 && current.length > 0) {
        chunks.push(current.trim());
        current = para;
      } else {
        current += (current ? "\n\n" : "") + para;
      }
    }
    if (current.trim()) chunks.push(current.trim());

    if (chunks.length === 0) return { indexed: 0 };

    // Embed all chunks
    const embedResp = await fetch(`${embeddingUrl}/embed_batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: chunks }),
    });

    if (!embedResp.ok) {
      throw new Error(`Embedding service error: ${embedResp.status}`);
    }

    const { embeddings } = (await embedResp.json()) as { embeddings: number[][] };

    // Store via Supabase service role
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    for (let i = 0; i < chunks.length; i++) {
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
          content: chunks[i],
          embedding: JSON.stringify(embeddings[i]),
          metadata: metadata ?? {},
        }),
      });

      if (!resp.ok) {
        const err = await resp.text();
        console.error(`Failed to index chunk ${i}:`, err);
      }
    }

    return { indexed: chunks.length };
  },
  {
    connection,
    concurrency: 2,
  }
);

contentGenWorker.on("failed", (job, err) => {
  console.error(`Content generation job ${job?.id} failed:`, err.message);
});

console.log("Content generation worker started");

export default contentGenWorker;
