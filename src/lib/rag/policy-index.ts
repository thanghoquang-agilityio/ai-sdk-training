import "server-only";
import path from "path";
import { createHash } from "crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { embed, embedMany } from "ai";
import type { Table } from "@lancedb/lancedb";
import { getEmbeddingModel } from "./embed";
import { POLICY_CHUNKS, type PolicyChunk } from "./policy-chunks";

const DB_PATH = path.join(process.cwd(), "server/db/lancedb");
const TABLE_NAME = "policy_chunks";
const HASH_FILE = path.join(DB_PATH, ".policy-hash");

export type PolicySearchResult = Pick<PolicyChunk, "id" | "title" | "body"> & {
  score: number;
};

// Singleton: resolves to the LanceDB table (persisted to disk).
// Resets to null if initialisation fails so the next request retries.
let tablePromise: Promise<Table> | null = null;

// SHA-256 of all chunk id+title+body — detects any content change, not just count.
function computeChunksHash(): string {
  const content = POLICY_CHUNKS.map((c) => `${c.id}\x00${c.title}\x00${c.body}`).join("\n");
  return createHash("sha256").update(content).digest("hex");
}

function readStoredHash(): string | null {
  if (!existsSync(HASH_FILE)) return null;
  return readFileSync(HASH_FILE, "utf-8").trim();
}

function writeStoredHash(hash: string): void {
  mkdirSync(DB_PATH, { recursive: true });
  writeFileSync(HASH_FILE, hash, "utf-8");
}

async function getOrBuildTable(): Promise<Table> {
  const lancedb = await import("@lancedb/lancedb");
  const db = await lancedb.connect(DB_PATH);

  const currentHash = computeChunksHash();
  const storedHash = readStoredHash();
  const existingTables = await db.tableNames();
  const tableExists = existingTables.includes(TABLE_NAME);

  // Reuse the persisted index only when content hasn't changed.
  if (tableExists && storedHash === currentHash) {
    console.log("[RAG] Reusing persisted LanceDB index (content unchanged).");
    return db.openTable(TABLE_NAME);
  }

  if (tableExists) {
    console.log("[RAG] Policy content changed — rebuilding LanceDB index…");
    await db.dropTable(TABLE_NAME);
  } else {
    console.log("[RAG] Building LanceDB index for", POLICY_CHUNKS.length, "policy chunks…");
  }

  const model = getEmbeddingModel();
  const texts = POLICY_CHUNKS.map((c) => `${c.title}\n\n${c.body}`);
  const { embeddings } = await embedMany({ model, values: texts });

  const rows = POLICY_CHUNKS.map((chunk, i) => ({
    id: chunk.id,
    title: chunk.title,
    body: chunk.body,
    vector: embeddings[i],
  }));

  const table = await db.createTable(TABLE_NAME, rows);
  writeStoredHash(currentHash);
  console.log("[RAG] LanceDB index built and persisted to", DB_PATH);
  return table;
}

/**
 * Keyword fallback: TF-style scoring when the embedding model is unavailable.
 * Title matches are weighted 3× higher than body matches.
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
  return (hits.length > 0 ? hits : scored).slice(0, topK);
}

/**
 * Semantic search over the leave policy chunks using LanceDB (disk-backed).
 * Falls back to keyword search if the embedding model is unavailable.
 */
export async function searchPolicy(
  query: string,
  topK = 3,
): Promise<PolicySearchResult[]> {
  if (!tablePromise) {
    tablePromise = getOrBuildTable().catch((err) => {
      tablePromise = null;
      throw err;
    });
  }

  try {
    const table = await tablePromise;
    const model = getEmbeddingModel();
    const { embedding: queryEmbedding } = await embed({ model, value: query });

    const rows = await table
      .vectorSearch(queryEmbedding)
      .distanceType("cosine")
      .limit(topK)
      .toArray();

    // LanceDB returns cosine distance (0 = identical). Convert to similarity.
    return rows.map((row) => ({
      id: String(row.id),
      title: String(row.title),
      body: String(row.body),
      score: 1 - Number(row._distance),
    }));
  } catch {
    return keywordSearch(query, topK);
  }
}
