import type { AIProviderName } from "@/lib/ai-provider";
import { isProductionLike } from "@/lib/runtime-env";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import {
  DEFAULT_PROVIDER_OPTIONS,
  PROVIDER_OPTION_LABEL,
  PROVIDER_PANEL_COPY,
} from "@/constants/provider";
import type { UseProviderSelectionResult } from "@/types/provider";

type ProviderSelectorProps = {
  provider: UseProviderSelectionResult;
  allowedProviders?: AIProviderName[];
  withContainer?: boolean;
};

export function ProviderSelector({
  provider,
  allowedProviders = DEFAULT_PROVIDER_OPTIONS,
  withContainer = true,
}: ProviderSelectorProps) {
  const isProviderSelectDisabled = allowedProviders.length <= 1;

  const content = (
    <div className="flex flex-col gap-3">
      <div className="space-y-1">
        <Text as="label" variant="sectionTitle">
          {PROVIDER_PANEL_COPY.label}
        </Text>
        <Text variant="captionStrong">
          {PROVIDER_PANEL_COPY.description}
        </Text>
      </div>

      <Select
        value={provider.selectedProvider}
        onChange={(event) =>
          provider.selectProvider(event.target.value as AIProviderName)
        }
        disabled={isProviderSelectDisabled}
        fullWidth
        controlSize="md"
        variant="dark"
      >
        {allowedProviders.includes("ollama") ? (
          <option value="ollama">{PROVIDER_OPTION_LABEL.ollama}</option>
        ) : null}
        {allowedProviders.includes("openai") ? (
          <option value="openai">{PROVIDER_OPTION_LABEL.openai}</option>
        ) : null}
      </Select>

      <Text variant="captionStrong" className="min-h-4" aria-live="polite">
        {provider.providerStatus}
      </Text>

      {provider.isOpenAISelected ? (
        <div className="flex flex-col gap-2">
          <Input
            type="password"
            value={provider.openaiApiKeyInput}
            onChange={(event) => provider.updateOpenAIApiKeyInput(event.target.value)}
            placeholder={PROVIDER_PANEL_COPY.openaiApiKeyPlaceholder}
            fullWidth
            controlSize="md"
            variant="dark"
          />
          <Button
            type="button"
            onClick={provider.verifyOpenAIKey}
            isLoading={provider.isValidatingKey}
            disabled={provider.isOpenAIKeyVerified}
            variant="primary"
            size="md"
            fullWidth
          >
            {provider.isValidatingKey
              ? PROVIDER_PANEL_COPY.verifyActionLoadingLabel
              : PROVIDER_PANEL_COPY.verifyOpenAIButtonLabel}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Input
            type="url"
            value={provider.ollamaBaseUrlInput}
            onChange={(event) => provider.updateOllamaBaseUrlInput(event.target.value)}
            placeholder={PROVIDER_PANEL_COPY.ollamaBaseUrlPlaceholder}
            fullWidth
            controlSize="md"
            variant="dark"
          />
          <Button
            type="button"
            onClick={provider.verifyOllamaBaseUrl}
            isLoading={provider.isValidatingOllamaBaseUrl}
            disabled={provider.isOllamaUrlVerified}
            variant="ghost"
            size="md"
            fullWidth
            className="font-dm-sans border border-white/12 text-white/60 hover:bg-white/8"
          >
            {provider.isValidatingOllamaBaseUrl
              ? PROVIDER_PANEL_COPY.verifyActionLoadingLabel
              : PROVIDER_PANEL_COPY.verifyOllamaButtonLabel}
          </Button>
          <Text variant="captionMuted">
            {isProductionLike()
              ? PROVIDER_PANEL_COPY.productionOllamaHint
              : PROVIDER_PANEL_COPY.localOllamaHint}
          </Text>
        </div>
      )}
    </div>
  );

  if (!withContainer) return content;

  return (
    <Card variant="panel" className="p-4">
      {content}
    </Card>
  );
}
