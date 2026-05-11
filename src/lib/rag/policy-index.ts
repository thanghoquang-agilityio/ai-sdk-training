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
 * Semantic search over the leave policy chunks.
 * Builds the vector index on first call (cached for the process lifetime).
 * Returns the top-k most relevant chunks sorted by cosine similarity.
 */
export async function searchPolicy(
  query: string,
  topK = 3,
): Promise<PolicySearchResult[]> {
  if (!indexPromise) {
    indexPromise = buildIndex().catch((err) => {
      indexPromise = null; // allow retry on next call
      throw err;
    });
  }

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
}
