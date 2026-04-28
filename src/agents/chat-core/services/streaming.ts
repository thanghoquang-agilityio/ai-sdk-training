import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type LanguageModel,
  type StepResult,
  type ToolSet,
  type UIMessage,
} from "ai";
import {
  buildConversationRuntimeContext,
  buildRuntimeSystemPrompt,
} from "../prompt/builder";
import { resolveAgentRunPolicy } from "../observers/policy";
import {
  buildTokenBreakdown,
  estimateToolExchangeTokens,
  extractToolNamesFromSteps,
  toTokenUsageSnapshot,
} from "../observers/metrics";
import { getAgentMetadata } from "../utils/response";
import type { AgentLogger, AgentName, MessageMetadata } from "../types";
import type { AppRole } from "@/lib/auth/session";
import { getErrorMessage } from "@/utils/error";

const CONNECTION_ERROR_PATTERNS = [
  "ECONNREFUSED",
  "ENOTFOUND",
  "ECONNRESET",
  "fetch failed",
  "Failed to fetch",
  "Network request failed",
  "network error",
];

function toClientErrorMessage(error: unknown): string {
  const msg = getErrorMessage(error);
  const isConnectionError = CONNECTION_ERROR_PATTERNS.some((p) =>
    msg.toLowerCase().includes(p.toLowerCase()),
  );
  return isConnectionError
    ? "Could not reach the AI provider. Make sure Ollama is running or your provider is configured correctly."
    : "";
}

type AgentToolSet = NonNullable<Parameters<typeof streamText>[0]["tools"]>;
type StreamAgentInput = {
  model: LanguageModel;
  messages: UIMessage[];
  system: string;
  tools: AgentToolSet;
  agent: AgentName;
  accessRole: AppRole;
  provider?: string;
  modelId?: string;
  onRunStats?: (data: AgentLogger) => void;
};

/**
 * Runs the core streaming pipeline for one agent turn.
 * @param {StreamAgentInput} input
 */
export async function streamAgent(input: StreamAgentInput) {
  const runPolicy = resolveAgentRunPolicy();
  const conversation = buildConversationRuntimeContext({
    messages: input.messages,
    messageWindow: runPolicy.messageWindow,
  });
  const systemPrompt = buildRuntimeSystemPrompt({
    baseSystemPrompt: input.system,
    latestUserText: conversation.latestUserText,
    olderContextSummary: conversation.olderContextSummary,
    hasCompactedHistory: conversation.hasCompactedHistory,
  });
  const modelMessages = await convertToModelMessages(
    conversation.recentMessages,
  );

  const result = streamText({
    model: input.model,
    system: systemPrompt,
    messages: modelMessages,
    tools: input.tools,
    stopWhen: stepCountIs(runPolicy.stopStepCount),
    temperature: runPolicy.temperature,
    maxRetries: runPolicy.maxRetries,
    maxOutputTokens: runPolicy.maxOutputTokens,
    onFinish: ({ steps, totalUsage }) => {
      if (!input.onRunStats) return;

      const stepResults = steps as StepResult<ToolSet>[];
      const toolNames = extractToolNamesFromSteps(stepResults);
      const usage = toTokenUsageSnapshot(totalUsage);
      const tokenBreakdown = buildTokenBreakdown({
        systemPrompt,
        messageCount: conversation.recentMessages.length,
        latestUserText: conversation.latestUserText,
        usage,
        toolExchangeTokensEstimate: estimateToolExchangeTokens(stepResults),
      });

      input.onRunStats({
        agent: input.agent,
        provider: input.provider ?? null,
        modelId: input.modelId ?? null,
        toolNames,
        ...tokenBreakdown,
      });
    },
  });

  const messageMetadata: MessageMetadata = {
    ...getAgentMetadata(input.agent, input.accessRole),
    provider: input.provider ?? null,
    modelId: input.modelId ?? null,
  };

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      console.error("[agent:stream-error]", getErrorMessage(error));
      return toClientErrorMessage(error);
    },
    messageMetadata: ({ part }) =>
      part.type === "start" || part.type === "finish"
        ? messageMetadata
        : undefined,
  });
}
