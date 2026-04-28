"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { API_HEADER_COPY, API_ROUTE_PATH } from "@/constants/api";
import { PROVIDER_STORAGE_KEYS } from "@/constants/storage";
import { PROVIDER_STATUS_COPY } from "@/constants/provider";
import { isAIProviderName, type AIProviderName } from "@/lib/ai-provider";
import { normalizeOllamaBaseUrl } from "@/lib/ollama-url";
import { isProductionLike } from "@/lib/runtime-env";
import type {
  OllamaUrlValidationResponse,
  OpenAIKeyValidationResponse,
} from "@/types/api";
import type {
  ProviderRequestBody,
  UseProviderSelectionOptions,
  UseProviderSelectionResult,
} from "@/types/provider";
import { session as sessionStorage } from "@/utils/storage";
import { getErrorMessage } from "@/utils/error";

const DEFAULT_PROVIDER_BY_ENV: AIProviderName = isProductionLike()
  ? "openai"
  : "ollama";
const IS_SERVER_OPENAI_READY =
  process.env.NEXT_PUBLIC_OPENAI_SERVER_READY === "true";
const REQUIRES_OLLAMA_URL_VERIFICATION = isProductionLike();

function deriveProviderStatus({
  selectedProvider,
  verifiedOpenAIKey,
  verifiedOllamaBaseUrl,
  ollamaBaseUrlInput,
  requireOpenAIApiKeyVerification,
}: {
  selectedProvider: AIProviderName;
  verifiedOpenAIKey: string | null;
  verifiedOllamaBaseUrl: string | null;
  ollamaBaseUrlInput: string;
  requireOpenAIApiKeyVerification: boolean;
}): string {
  if (selectedProvider === "openai") {
    if (verifiedOpenAIKey) return PROVIDER_STATUS_COPY.openaiVerified;
    if (IS_SERVER_OPENAI_READY && !requireOpenAIApiKeyVerification) {
      return PROVIDER_STATUS_COPY.openaiServerDefault;
    }
    return PROVIDER_STATUS_COPY.openaiSelected;
  }

  if (verifiedOllamaBaseUrl) return PROVIDER_STATUS_COPY.ollamaVerified;
  if (ollamaBaseUrlInput.trim()) {
    return REQUIRES_OLLAMA_URL_VERIFICATION
      ? PROVIDER_STATUS_COPY.ollamaSelected
      : PROVIDER_STATUS_COPY.ollamaCustomUrl;
  }
  return PROVIDER_STATUS_COPY.ollamaDefault;
}

export function useProviderSelection({
  requireOpenAIApiKeyVerification = false,
  defaultProvider = DEFAULT_PROVIDER_BY_ENV,
}: UseProviderSelectionOptions = {}): UseProviderSelectionResult {
  const [selectedProvider, setSelectedProvider] = useState<AIProviderName>(() => {
    const stored = sessionStorage.read(PROVIDER_STORAGE_KEYS.selectedProvider);
    return isAIProviderName(stored ?? "") ? (stored as AIProviderName) : defaultProvider;
  });
  const [openaiApiKeyInput, setOpenaiApiKeyInput] = useState(
    () => sessionStorage.read(PROVIDER_STORAGE_KEYS.openaiApiKeyInput) ?? "",
  );
  const [ollamaBaseUrlInput, setOllamaBaseUrlInput] = useState(
    () => sessionStorage.read(PROVIDER_STORAGE_KEYS.ollamaBaseUrlInput) ?? "",
  );
  const [verifiedOpenAIKey, setVerifiedOpenAIKey] = useState<string | null>(
    () => sessionStorage.read(PROVIDER_STORAGE_KEYS.verifiedOpenAIKey),
  );
  const [verifiedOllamaBaseUrl, setVerifiedOllamaBaseUrl] = useState<string | null>(
    () => sessionStorage.read(PROVIDER_STORAGE_KEYS.verifiedOllamaBaseUrl),
  );
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [isValidatingOllamaBaseUrl, setIsValidatingOllamaBaseUrl] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const dismissSuccessMessage = useCallback(() => setSuccessMessage(null), []);

  const isOpenAISelected = selectedProvider === "openai";
  const isOpenAIBypassReady = IS_SERVER_OPENAI_READY && !requireOpenAIApiKeyVerification;
  const isOpenAIReady =
    !isOpenAISelected || isOpenAIBypassReady || Boolean(verifiedOpenAIKey);
  const isOllamaReady = isOpenAISelected
    ? true
    : !REQUIRES_OLLAMA_URL_VERIFICATION || Boolean(verifiedOllamaBaseUrl);
  const isProviderReady = isOpenAISelected ? isOpenAIReady : isOllamaReady;

  const normalizedOllamaBaseUrl = useMemo(
    () => normalizeOllamaBaseUrl(ollamaBaseUrlInput) ?? undefined,
    [ollamaBaseUrlInput],
  );

  // Derived — no useState needed; recalculates on any dependency change.
  // Loading states (verifying…) are captured via the isValidating* flags.
  const providerStatus = useMemo(() => {
    if (selectedProvider === "openai" && isValidatingKey) {
      return PROVIDER_STATUS_COPY.verifyingOpenAIKey;
    }
    if (selectedProvider === "ollama" && isValidatingOllamaBaseUrl) {
      return PROVIDER_STATUS_COPY.verifyingOllamaUrl;
    }
    return deriveProviderStatus({
      selectedProvider,
      verifiedOpenAIKey,
      verifiedOllamaBaseUrl,
      ollamaBaseUrlInput,
      requireOpenAIApiKeyVerification,
    });
  }, [
    selectedProvider,
    isValidatingKey,
    isValidatingOllamaBaseUrl,
    verifiedOpenAIKey,
    verifiedOllamaBaseUrl,
    ollamaBaseUrlInput,
    requireOpenAIApiKeyVerification,
  ]);

  const requestBody = useMemo<ProviderRequestBody>(
    () =>
      selectedProvider === "openai"
        ? { provider: selectedProvider, openaiApiKey: verifiedOpenAIKey ?? undefined }
        : {
            provider: selectedProvider,
            ollamaBaseUrl: REQUIRES_OLLAMA_URL_VERIFICATION
              ? (verifiedOllamaBaseUrl ?? undefined)
              : normalizedOllamaBaseUrl,
          },
    [normalizedOllamaBaseUrl, selectedProvider, verifiedOllamaBaseUrl, verifiedOpenAIKey],
  );

  useEffect(() => {
    sessionStorage.write(PROVIDER_STORAGE_KEYS.selectedProvider, selectedProvider);
  }, [selectedProvider]);

  useEffect(() => {
    sessionStorage.write(
      PROVIDER_STORAGE_KEYS.openaiApiKeyInput,
      openaiApiKeyInput.trim() ? openaiApiKeyInput : null,
    );
  }, [openaiApiKeyInput]);

  useEffect(() => {
    sessionStorage.write(PROVIDER_STORAGE_KEYS.verifiedOpenAIKey, verifiedOpenAIKey);
  }, [verifiedOpenAIKey]);

  useEffect(() => {
    sessionStorage.write(
      PROVIDER_STORAGE_KEYS.ollamaBaseUrlInput,
      ollamaBaseUrlInput.trim() ? ollamaBaseUrlInput : null,
    );
  }, [ollamaBaseUrlInput]);

  useEffect(() => {
    sessionStorage.write(
      PROVIDER_STORAGE_KEYS.verifiedOllamaBaseUrl,
      verifiedOllamaBaseUrl,
    );
  }, [verifiedOllamaBaseUrl]);

  function selectProvider(nextProvider: AIProviderName) {
    setSelectedProvider(nextProvider);
    setValidationError(null);
  }

  function updateOpenAIApiKeyInput(nextValue: string) {
    setOpenaiApiKeyInput(nextValue);
    setValidationError(null);

    if (verifiedOpenAIKey && verifiedOpenAIKey !== nextValue.trim()) {
      setVerifiedOpenAIKey(null);
    }
  }

  function updateOllamaBaseUrlInput(nextValue: string) {
    setOllamaBaseUrlInput(nextValue);
    setValidationError(null);

    const normalized = normalizeOllamaBaseUrl(nextValue);
    if (verifiedOllamaBaseUrl && verifiedOllamaBaseUrl !== normalized) {
      setVerifiedOllamaBaseUrl(null);
    }
  }

  async function verifyOpenAIKey() {
    const key = openaiApiKeyInput.trim();
    if (!key) {
      setValidationError(PROVIDER_STATUS_COPY.openaiKeyRequired);
      return;
    }

    setValidationError(null);
    setIsValidatingKey(true);

    try {
      const response = await fetch(API_ROUTE_PATH.validateOpenAIKey, {
        method: "POST",
        headers: { "Content-Type": API_HEADER_COPY.jsonContentType },
        body: JSON.stringify({ apiKey: key }),
      });

      const data = (await response.json()) as OpenAIKeyValidationResponse;

      if (response.ok && data.ok) {
        setVerifiedOpenAIKey(key);
        setSelectedProvider("openai");
        setSuccessMessage("OpenAI API key verified successfully.");
        return;
      }

      setVerifiedOpenAIKey(null);
      setValidationError(
        data.details ?? data.message ?? PROVIDER_STATUS_COPY.openaiInvalid,
      );
    } catch (error) {
      setVerifiedOpenAIKey(null);
      setValidationError(getErrorMessage(error));
    } finally {
      setIsValidatingKey(false);
    }
  }

  async function verifyOllamaBaseUrl() {
    const baseUrl = normalizeOllamaBaseUrl(ollamaBaseUrlInput);
    if (!baseUrl) {
      setValidationError(PROVIDER_STATUS_COPY.ollamaBaseUrlRequired);
      return;
    }

    setValidationError(null);
    setIsValidatingOllamaBaseUrl(true);

    try {
      const response = await fetch(API_ROUTE_PATH.validateOllamaUrl, {
        method: "POST",
        headers: { "Content-Type": API_HEADER_COPY.jsonContentType },
        body: JSON.stringify({ baseUrl }),
      });

      const data = (await response.json()) as OllamaUrlValidationResponse;
      if (!response.ok || !data.ok) {
        throw new Error(
          data.details ?? data.message ?? PROVIDER_STATUS_COPY.ollamaUrlInvalid,
        );
      }

      setVerifiedOllamaBaseUrl(data.normalizedBaseUrl ?? baseUrl);
      setSuccessMessage("Ollama URL verified successfully.");
    } catch (error) {
      setVerifiedOllamaBaseUrl(null);
      setValidationError(getErrorMessage(error));
    } finally {
      setIsValidatingOllamaBaseUrl(false);
    }
  }

  return {
    selectedProvider,
    openaiApiKeyInput,
    ollamaBaseUrlInput,
    providerStatus,
    isOpenAISelected,
    isOpenAIReady,
    isOpenAIKeyVerified: Boolean(verifiedOpenAIKey),
    isOllamaUrlVerified: Boolean(verifiedOllamaBaseUrl),
    isProviderReady,
    isValidatingKey,
    isValidatingOllamaBaseUrl,
    validationError,
    successMessage,
    dismissSuccessMessage,
    requestBody,
    selectProvider,
    updateOpenAIApiKeyInput,
    updateOllamaBaseUrlInput,
    verifyOpenAIKey,
    verifyOllamaBaseUrl,
  };
}
