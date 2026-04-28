import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { isProductionLike } from "@/lib/runtime-env";
import { normalizeOllamaBaseUrl } from "@/lib/ollama-url";

export const SUPPORTED_AI_PROVIDERS = ["openai", "ollama"] as const;

export type AIProviderName = (typeof SUPPORTED_AI_PROVIDERS)[number];

export type ChatModelConfig = {
  provider: AIProviderName;
  modelId: string;
  model: LanguageModel;
};

export type ChatModelOverrides = {
  provider?: AIProviderName;
  openaiApiKey?: string;
  modelId?: string;
  baseUrl?: string;
};

export function isAIProviderName(value: string): value is AIProviderName {
  return SUPPORTED_AI_PROVIDERS.includes(value as AIProviderName);
}

export function getSupportedAIProviderList(): string {
  return SUPPORTED_AI_PROVIDERS.join(", ");
}

function resolveOpenAIKey(overrides: ChatModelOverrides): string {
  const key = overrides.openaiApiKey?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OpenAI API key is required.");
  return key;
}

function openAIModelId(overrides: ChatModelOverrides): string {
  const configuredProvider = process.env.AI_PROVIDER?.trim().toLowerCase();
  return (
    overrides.modelId ??
    process.env.OPENAI_MODEL ??
    (configuredProvider === "openai" ? process.env.AI_MODEL : undefined) ??
    "gpt-4o-mini"
  );
}

function openAIConfig(overrides: ChatModelOverrides): ChatModelConfig {
  const modelId = openAIModelId(overrides);
  const apiKey = resolveOpenAIKey(overrides);
  const openai = createOpenAI({
    baseURL: overrides.baseUrl ?? process.env.OPENAI_BASE_URL,
    apiKey,
  });
  return { provider: "openai", modelId, model: openai.chat(modelId) };
}

function ollamaModelId(overrides: ChatModelOverrides): string {
  const configuredProvider = process.env.AI_PROVIDER?.trim().toLowerCase();
  return (
    overrides.modelId ??
    process.env.OLLAMA_MODEL ??
    (configuredProvider === "ollama" ? process.env.AI_MODEL : undefined) ??
    "qwen2.5:3b"
  );
}

const OLLAMA_DEFAULT_BASE_URL = "http://localhost:11434/v1";

function resolveOllamaBaseUrl(overrides: ChatModelOverrides): string {
  const raw = overrides.baseUrl ?? process.env.OLLAMA_BASE_URL;
  // normalizeOllamaBaseUrl appends /v1 if missing — guards against bare host:port in env.
  return (raw ? normalizeOllamaBaseUrl(raw) : null) ?? OLLAMA_DEFAULT_BASE_URL;
}

function ollamaConfig(overrides: ChatModelOverrides): ChatModelConfig {
  const modelId = ollamaModelId(overrides);
  const openaiCompatible = createOpenAI({
    baseURL: resolveOllamaBaseUrl(overrides),
    apiKey: "ollama",
  });
  // Ollama OpenAI-compatible endpoint works best with chat mode.
  return { provider: "ollama", modelId, model: openaiCompatible.chat(modelId) };
}

function resolveDefaultProvider(): AIProviderName {
  return isProductionLike() ? "openai" : "ollama";
}

function resolveProvider(overrides: ChatModelOverrides): AIProviderName {
  if (overrides.provider) return overrides.provider;

  const provider = process.env.AI_PROVIDER?.trim().toLowerCase();

  if (!provider) return resolveDefaultProvider();

  if (isAIProviderName(provider)) return provider;

  throw new Error(
    `Unsupported AI_PROVIDER "${provider}". Supported values: ${getSupportedAIProviderList()}.`,
  );
}

function getProviderResolutionOrder(overrides: ChatModelOverrides): AIProviderName[] {
  if (overrides.provider) return [overrides.provider];

  const primaryProvider = resolveProvider(overrides);
  const fallbackProviders = SUPPORTED_AI_PROVIDERS.filter(
    (provider) => provider !== primaryProvider,
  );

  return [primaryProvider, ...fallbackProviders];
}

function buildConfig(
  provider: AIProviderName,
  overrides: ChatModelOverrides,
): ChatModelConfig {
  const merged = { ...overrides, provider };
  switch (provider) {
    case "openai":
      return openAIConfig(merged);
    case "ollama":
      return ollamaConfig(merged);
  }
}

export function getChatModelCandidates(
  overrides: ChatModelOverrides = {},
): ChatModelConfig[] {
  const providerOrder = getProviderResolutionOrder(overrides);
  const candidates: ChatModelConfig[] = [];
  let lastError: unknown = null;

  for (const provider of providerOrder) {
    try {
      candidates.push(buildConfig(provider, overrides));
    } catch (error) {
      lastError = error;

      if (overrides.provider) {
        throw error;
      }
    }
  }

  if (candidates.length > 0) return candidates;

  if (lastError instanceof Error) throw lastError;

  throw new Error("No available AI provider configuration was resolved.");
}
