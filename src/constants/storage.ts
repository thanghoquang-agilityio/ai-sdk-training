export const CHAT_STORAGE_KEYS = {
  threadsByRole: "employee-assistant:chat-threads-by-role:v3",
} as const;

export const PROVIDER_STORAGE_KEYS = {
  selectedProvider: "employee-assistant:selected-provider",
  openaiApiKeyInput: "employee-assistant:openai-api-key-input",
  verifiedOpenAIKey: "employee-assistant:verified-openai-key",
  ollamaBaseUrlInput: "employee-assistant:ollama-base-url-input",
  verifiedOllamaBaseUrl: "employee-assistant:verified-ollama-base-url",
} as const;
