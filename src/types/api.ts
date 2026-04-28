import type { UIMessage } from "ai";

export type ChatApiRequestBody = {
  messages?: UIMessage[];
  provider?: string;
  openaiApiKey?: string;
  ollamaBaseUrl?: string;
  authRole?: string;
};

export type OpenAIKeyValidationRequestBody = {
  apiKey?: string;
};

export type OpenAIKeyValidationResponse = {
  ok?: boolean;
  message?: string;
  details?: string;
};

export type OllamaUrlValidationRequestBody = {
  baseUrl?: string;
};

export type OllamaUrlValidationResponse = {
  ok?: boolean;
  message?: string;
  details?: string;
  normalizedBaseUrl?: string;
};
