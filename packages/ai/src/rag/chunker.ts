const OVERLAP_CHARS = 100;
const MAX_CHUNK_CHARS = 1500;

export function chunkText(text: string, options?: { maxChunkChars?: number; overlapChars?: number }): string[] {
  const maxChars = options?.maxChunkChars ?? MAX_CHUNK_CHARS;
  const overlap = options?.overlapChars ?? OVERLAP_CHARS;

  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (para.length > maxChars) {
      if (current) {
        chunks.push(current.trim());
        current = "";
      }
      const sentences = para.split(/(?<=[.!?])\s+/);
      for (const sentence of sentences) {
        if (current.length + sentence.length > maxChars && current.length > 0) {
          chunks.push(current.trim());
          current = current.slice(-overlap) + " " + sentence;
        } else {
          current += (current ? " " : "") + sentence;
        }
      }
    } else if (current.length + para.length + 2 > maxChars) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += (current ? "\n\n" : "") + para;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
