export const API_COMMON_ERROR_COPY = {
  invalidJsonBody: "Invalid JSON body.",
} as const;

export const API_ROUTE_PATH = {
  validateOpenAIKey: "/api/validate-openai-key",
  validateOllamaUrl: "/api/validate-ollama-url",
  chat: "/api/chat",
} as const;

export const API_HEADER_COPY = {
  jsonContentType: "application/json",
} as const;

export const CHAT_API_COPY = {
  invalidMessages: "`messages` must be an array.",
  invalidProviderPrefix: "Invalid `provider`. Supported values:",
} as const;

export const OPENAI_VALIDATION_API_COPY = {
  missingApiKey: "`apiKey` is required.",
  valid: "OpenAI key is valid.",
  invalid: "OpenAI key is invalid.",
  testPrompt: "hello",
  testModel: "gpt-4o-mini",
  baseUrl: "https://api.openai.com/v1",
} as const;

export const OLLAMA_VALIDATION_API_COPY = {
  invalidBaseUrl: "`baseUrl` must be a valid http/https URL.",
  verified: "Ollama URL verified.",
  connectionErrorPrefix: "Cannot connect to Ollama URL:",
  noModelsDetected: "Connected successfully. No models were listed.",
  detectedModelsPrefix: "Connected successfully. Detected",
  tagsEndpointErrorPrefix: "Ollama tags endpoint returned",
  tagsEndpointErrorSuffix: "Check tunnel URL.",
  tagsPath: "/api/tags",
  requestTimeoutMs: 8_000,
} as const;
