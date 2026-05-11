import {
  getSupportedAIProviderList,
  isAIProviderName,
  type AIProviderName,
} from "@/lib/ai-provider";
import { CHAT_API_COPY } from "@/constants/api";

export function parseProviderOverride(provider?: string): {
  providerOverride?: AIProviderName;
  errorMessage?: string;
} {
  const providerFromBody = provider?.trim().toLowerCase();

  if (!providerFromBody) {
    return {};
  }

  if (!isAIProviderName(providerFromBody)) {
    return {
      errorMessage: `${CHAT_API_COPY.invalidProviderPrefix} ${getSupportedAIProviderList()}.`,
    };
  }

  return { providerOverride: providerFromBody };
}
