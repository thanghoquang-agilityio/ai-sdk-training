import type { LanguageModel, UIMessage } from "ai";
import type { AppRole, MockAuthSession } from "@/lib/auth/session";

export type AgentName = "coordinator" | "employee" | "manager" | "date";

export type AgentMetadata = {
  agent: AgentName;
  agentLabel: string;
  accessRole: AppRole;
};

export type MessageMetadata = AgentMetadata & {
  provider: string | null;
  modelId: string | null;
};

export type AgentRunInput = {
  model: LanguageModel;
  modelId?: string;
  provider?: string;
  messages: UIMessage[];
  session: MockAuthSession;
  onRunStats?: (data: AgentLogger) => void;
};

export type AgentRunPolicy = {
  stopStepCount: number;
  temperature: number;
  messageWindow: number;
  maxRetries: number;
  maxOutputTokens?: number;
};

export type UsageInputTokenDetails = {
  noCacheTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
};

export type TokenUsageSnapshot = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens: number;
  reasoningTokens: number;
  inputTokenDetails: UsageInputTokenDetails;
};

export type AgentLogger = {
  agent: AgentName;
  provider: string | null;
  modelId: string | null;
  toolNames: string[];
  systemPromptTokensEstimate: number;
  messageCount: number;
  userInputTokensEstimate: number;
  toolExchangeTokensEstimate: number;
  inputTokensReported: number;
  outputTokensReported: number;
  totalTokensReported: number;
  cachedInputTokensReported: number;
  reasoningTokensReported: number;
};

export type CoordinatorDecision =
  | { type: "delegate"; specialist: "employee" | "manager" | "date" }
  | { type: "deny"; message: string };
