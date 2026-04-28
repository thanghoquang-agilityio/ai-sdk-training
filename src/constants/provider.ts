import type { AIProviderName } from "@/lib/ai-provider";

export const DEFAULT_PROVIDER_OPTIONS: AIProviderName[] = ["ollama", "openai"];

export const PROVIDER_PANEL_COPY = {
  label: "Provider",
  description: "Keep the chat app slim, but switch models whenever you need.",
  openaiApiKeyPlaceholder: "Enter OpenAI API key (sk-...)",
  ollamaBaseUrlPlaceholder:
    "Ollama base URL (optional locally, e.g. http://localhost:11434)",
  verifyActionLoadingLabel: "Verifying...",
  verifyOpenAIButtonLabel: "Verify OpenAI key",
  verifyOllamaButtonLabel: "Verify Ollama URL",
  localOllamaHint:
    "If left empty in local development, the app uses the default Ollama config from env.",
  productionOllamaHint:
    "A verified public Ollama URL is required in production-like mode.",
} as const;

export const PROVIDER_OPTION_LABEL = {
  ollama: "Ollama",
  openai: "OpenAI",
} as const;

export const PROVIDER_STATUS_COPY = {
  ollamaDefault: "Using Ollama with local/default config.",
  ollamaCustomUrl:
    "Custom Ollama URL set. You can verify it before chatting.",
  ollamaSelected: "Ollama selected. Enter a URL and verify it to continue.",
  ollamaBaseUrlRequired: "Ollama base URL is required.",
  verifyingOllamaUrl: "Verifying Ollama URL...",
  ollamaVerified: "Ollama URL verified.",
  ollamaUrlInvalid: "Could not verify the Ollama URL.",
  openaiServerDefault: "Using OpenAI from server configuration.",
  openaiSelected: "OpenAI selected. Enter your API key and verify it.",
  openaiKeyRequired: "OpenAI API key is required.",
  verifyingOpenAIKey: "Verifying OpenAI API key...",
  openaiVerified: "OpenAI API key verified.",
  openaiInvalid: "Could not verify the OpenAI API key.",
} as const;

export const PROVIDER_HELPER_HINT_COPY = {
  verifyOpenAIFirst: "Verify your OpenAI key before sending messages.",
  verifyOllamaFirst: "Verify your Ollama URL before sending messages.",
} as const;
