import { createOpenAI } from "@ai-sdk/openai";
import type { EmbeddingModel } from "ai";
import { normalizeOllamaBaseUrl } from "@/lib/ollama-url";

let cachedModel: EmbeddingModel | null = null;

/**
 * Resolves the embedding model from env vars.
 * OpenAI: requires OPENAI_API_KEY and uses text-embedding-3-small by default.
 * Ollama: requires nomic-embed-text (or OLLAMA_EMBED_MODEL) to be pulled locally.
 * The resolved model is cached for the lifetime of the process to keep the
 * vector index consistent (mixing models gives wrong similarity scores).
 */
export function getEmbeddingModel(): EmbeddingModel {
  if (cachedModel) return cachedModel;

  const provider = process.env.AI_PROVIDER?.trim().toLowerCase() ?? "ollama";

  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey || apiKey === "ollama") {
      throw new Error(
        "Leave policy search requires a valid OPENAI_API_KEY. " +
          "Set AI_PROVIDER=openai and OPENAI_API_KEY in your .env file.",
      );
    }
    const openai = createOpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL?.trim() || undefined,
    });
    cachedModel = openai.embedding(
      process.env.OPENAI_EMBED_MODEL?.trim() ?? "text-embedding-3-small",
    );
  } else {
    // Ollama — user must have `ollama pull nomic-embed-text` (or OLLAMA_EMBED_MODEL)
    const rawBaseUrl = process.env.OLLAMA_BASE_URL?.trim();
    const baseURL =
      (rawBaseUrl ? normalizeOllamaBaseUrl(rawBaseUrl) : null) ??
      "http://localhost:11434/v1";
    const openaiCompat = createOpenAI({ baseURL, apiKey: "ollama" });
    cachedModel = openaiCompat.embedding(
      process.env.OLLAMA_EMBED_MODEL?.trim() ?? "nomic-embed-text",
    );
  }

  return cachedModel;
}

/** Reset the cached model — useful in tests or when env changes. */
export function resetEmbeddingModel(): void {
  cachedModel = null;
}
