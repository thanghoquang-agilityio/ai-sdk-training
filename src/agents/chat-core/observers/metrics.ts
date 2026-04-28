import type { LanguageModelUsage, StepResult, ToolSet } from "ai";
import type { TokenUsageSnapshot } from "../types";
import {
  estimateTokenCount,
  estimateTokenCountFromCharLength,
} from "./token-math";

type TokenBreakdownInput = {
  systemPrompt: string;
  messageCount: number;
  latestUserText: string;
  usage: TokenUsageSnapshot;
  toolExchangeTokensEstimate: number;
};

/**
 * Converts value to token usage snapshot.
 * @param {LanguageModelUsage} usage
 * @returns {TokenUsageSnapshot}
 */
export function toTokenUsageSnapshot(usage: LanguageModelUsage): TokenUsageSnapshot {
  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  const totalTokens = usage.totalTokens ?? inputTokens + outputTokens;
  const details = usage.inputTokenDetails;
  const cachedInputTokens = usage.cachedInputTokens ?? details.cacheReadTokens ?? 0;
  const reasoningTokens =
    usage.reasoningTokens ?? usage.outputTokenDetails.reasoningTokens ?? 0;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    cachedInputTokens,
    reasoningTokens,
    inputTokenDetails: {
      noCacheTokens: details.noCacheTokens ?? undefined,
      cacheReadTokens: details.cacheReadTokens ?? undefined,
      cacheWriteTokens: details.cacheWriteTokens ?? undefined,
    },
  };
}

/**
 * Extracts tool names from steps.
 * @param {StepResult<TOOLS>[]} steps
 * @returns {string[]}
 */
export function extractToolNamesFromSteps<TOOLS extends ToolSet>(
  steps: StepResult<TOOLS>[],
): string[] {
  return steps
    .flatMap((step) => step.toolCalls ?? [])
    .map((toolCall) => toolCall.toolName?.trim())
    .filter((toolName): toolName is string => Boolean(toolName));
}

/**
 * Estimates tool exchange tokens.
 * @param {StepResult<TOOLS>[]} steps
 * @returns {number}
 */
export function estimateToolExchangeTokens<TOOLS extends ToolSet>(
  steps: StepResult<TOOLS>[],
): number {
  const totalChars = steps.reduce((sum, step) => {
    const toolCalls = JSON.stringify(step.toolCalls ?? []);
    const toolResults = JSON.stringify(step.toolResults ?? []);
    return sum + toolCalls.length + toolResults.length;
  }, 0);

  return estimateTokenCountFromCharLength(totalChars);
}

/**
 * Builds token breakdown.
 * @param {TokenBreakdownInput} input
 */
export function buildTokenBreakdown(input: TokenBreakdownInput) {
  const systemPromptTokensEstimate = estimateTokenCount(input.systemPrompt);
  const userInputTokensEstimate = estimateTokenCount(input.latestUserText);

  return {
    systemPromptTokensEstimate,
    messageCount: input.messageCount,
    userInputTokensEstimate,
    toolExchangeTokensEstimate: input.toolExchangeTokensEstimate,
    inputTokensReported: input.usage.inputTokens,
    outputTokensReported: input.usage.outputTokens,
    totalTokensReported: input.usage.totalTokens,
    cachedInputTokensReported: input.usage.cachedInputTokens,
    reasoningTokensReported: input.usage.reasoningTokens,
  };
}
