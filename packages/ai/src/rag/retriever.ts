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
  const filterParts: string[] = [];
  if (filters?.sourceType) filterParts.push(`source_type = '${filters.sourceType}'`);
  if (filters?.subjectId) filterParts.push(`metadata->>'subjectId' = '${filters.subjectId}'`);

  const matchFilter = filterParts.length > 0 ? filterParts.join(" AND ") : "";

  const { data, error } = await client
    .from("rag_chunks")
    .select("id, content, source_type, source_id")
    .rpc("match_rag_chunks", {
      query_embedding: JSON.stringify(embedding),
      match_count: topK,
      match_threshold: 0.5,
      filter_clause: matchFilter,
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
      embedding: JSON.stringify(chunk.embedding),
      metadata: chunk.metadata,
    });
    if (error) throw error;
  }
}
