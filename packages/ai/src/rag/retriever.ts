export interface RagChunk {
  id: string;
  source_type: string;
  source_id: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface RagSearchResult {
  chunk: RagChunk;
  similarity: number;
}

export interface Embedder {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = any;

export async function searchRag(
  client: AnySupabaseClient,
  embedding: number[],
  topK: number = 5,
  filters?: { sourceType?: string; subjectId?: string }
): Promise<{ chunk_id: string; content: string; source_type: string; source_id: string; similarity: number }[]> {
  const embeddingStr = `[${embedding.join(",")}]`;

  const { data, error } = await client.rpc("match_rag_chunks", {
    query_embedding: embeddingStr,
    match_count: topK,
    match_threshold: 0.5,
    p_source_type: filters?.sourceType ?? null,
    p_subject_id: filters?.subjectId ?? null,
  });

  if (error) throw error;
  return (data as any[]) ?? [];
}

export async function indexChunks(
  client: AnySupabaseClient,
  chunks: { source_type: string; source_id: string; content: string; embedding: number[]; metadata: Record<string, unknown> }[]
): Promise<void> {
  for (const chunk of chunks) {
    const { error } = await client.from("rag_chunks").insert({
      source_type: chunk.source_type,
      source_id: chunk.source_id,
      content: chunk.content,
      embedding: `[${chunk.embedding.join(",")}]`,
      metadata: chunk.metadata,
    });
    if (error) throw error;
  }
}
