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
