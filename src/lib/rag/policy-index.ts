import { embedMany, embed, cosineSimilarity } from "ai";
import type { EmbeddingModel } from "ai";
import { getEmbeddingModel } from "./embed";
import { POLICY_CHUNKS, type PolicyChunk } from "./policy-chunks";

type IndexedChunk = PolicyChunk & { embedding: number[] };

type PolicyIndex = {
  model: EmbeddingModel;
  chunks: IndexedChunk[];
};

export type PolicySearchResult = Pick<PolicyChunk, "id" | "title" | "body"> & {
  score: number;
};

let indexPromise: Promise<PolicyIndex> | null = null;

async function buildIndex(): Promise<PolicyIndex> {
  const model = getEmbeddingModel();
  const texts = POLICY_CHUNKS.map((c) => `${c.title}\n\n${c.body}`);
  const { embeddings } = await embedMany({ model, values: texts });
  const chunks: IndexedChunk[] = POLICY_CHUNKS.map((chunk, i) => ({
    ...chunk,
    embedding: embeddings[i],
  }));
  return { model, chunks };
}

/**
 * Keyword fallback: TF-style scoring when the embedding model is unavailable.
 * Title matches are weighted 3× higher than body matches.
 * Returns top-k chunks with a score > 0, or all chunks if no keyword matches.
 */
function keywordSearch(query: string, topK: number): PolicySearchResult[] {
  const stopWords = new Set(["a", "an", "the", "is", "are", "do", "i", "my", "can", "how", "many", "much"]);
  const words = query
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 1 && !stopWords.has(w));

  const scored = POLICY_CHUNKS.map((chunk) => {
    const title = chunk.title.toLowerCase();
    const body = chunk.body.toLowerCase();
    let score = 0;
    for (const word of words) {
      score += (title.match(new RegExp(word, "g"))?.length ?? 0) * 3;
      score += body.match(new RegExp(word, "g"))?.length ?? 0;
    }
    return { id: chunk.id, title: chunk.title, body: chunk.body, score };
  });

  const hits = scored.filter((c) => c.score > 0).sort((a, b) => b.score - a.score);

  // If nothing matched, return the first topK chunks as a broad context fallback.
  return (hits.length > 0 ? hits : scored).slice(0, topK);
}

/**
 * Semantic search over the leave policy chunks.
 * Uses cosine similarity over embeddings when the embedding model is available,
 * and automatically falls back to keyword search otherwise (e.g. Ollama without
 * nomic-embed-text installed).
 */
export async function searchPolicy(
  query: string,
  topK = 3,
): Promise<PolicySearchResult[]> {
  // Try to build / reuse the semantic index.
  if (!indexPromise) {
    indexPromise = buildIndex().catch((err) => {
      indexPromise = null;
      throw err;
    });
  }

  try {
    const index = await indexPromise;
    const { embedding: queryEmbedding } = await embed({
      model: index.model,
      value: query,
    });

    return index.chunks
      .map(({ id, title, body, embedding }) => ({
        id,
        title,
        body,
        score: cosineSimilarity(queryEmbedding, embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  } catch {
    // Embedding model unavailable — fall back to keyword search.
    return keywordSearch(query, topK);
  }
}
