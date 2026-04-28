import type { AIProviderName } from "@/lib/ai-provider";

export type ProviderRequestBody = {
  provider: AIProviderName;
  openaiApiKey?: string;
  ollamaBaseUrl?: string;
};

export type UseProviderSelectionOptions = {
  requireOpenAIApiKeyVerification?: boolean;
  defaultProvider?: AIProviderName;
};

export type UseProviderSelectionResult = {
  selectedProvider: AIProviderName;
  openaiApiKeyInput: string;
  ollamaBaseUrlInput: string;
  providerStatus: string;
  isOpenAISelected: boolean;
  isOpenAIReady: boolean;
  isOpenAIKeyVerified: boolean;
  isOllamaUrlVerified: boolean;
  isProviderReady: boolean;
  isValidatingKey: boolean;
  isValidatingOllamaBaseUrl: boolean;
  validationError: string | null;
  successMessage: string | null;
  dismissSuccessMessage: () => void;
  requestBody: ProviderRequestBody;
  selectProvider: (provider: AIProviderName) => void;
  updateOpenAIApiKeyInput: (value: string) => void;
  updateOllamaBaseUrlInput: (value: string) => void;
  verifyOpenAIKey: () => Promise<void>;
  verifyOllamaBaseUrl: () => Promise<void>;
};
