import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import type { AppRole } from "@/lib/auth/session";
import type { LeaveType } from "@/lib/db/schema";
import type { AgentMetadata, AgentName, MessageMetadata } from "../types";

type CreateStaticAgentResponseInput = {
  text: string;
  agent: AgentName;
  accessRole: AppRole;
  originalMessages?: UIMessage[];
  provider?: string;
  modelId?: string;
};

type CreatePastDateResponseInput = {
  errorText: string;
  leaveType: LeaveType;
  reason?: string;
  agent: AgentName;
  accessRole: AppRole;
  originalMessages?: UIMessage[];
  provider?: string;
  modelId?: string;
};

/**
 * Gets agent metadata.
 * @param {AgentName} agent
 * @param {AppRole} accessRole
 * @returns {AgentMetadata}
 */
export function getAgentMetadata(
  agent: AgentName,
  accessRole: AppRole,
): AgentMetadata {
  switch (agent) {
    case "coordinator":
      return { agent, agentLabel: "Coordinator Agent", accessRole };
    case "manager":
      return { agent, agentLabel: "Manager Agent", accessRole };
    case "employee":
      return { agent, agentLabel: "Employee Agent", accessRole };
    case "date":
      return { agent, agentLabel: "Date Specialist", accessRole };
  }
}

/**
 * Creates static agent response.
 * @param {CreateStaticAgentResponseInput} input
 */
export function createStaticAgentResponse({
  text,
  agent,
  accessRole,
  originalMessages,
  provider,
  modelId,
}: CreateStaticAgentResponseInput) {
  const metadata: MessageMetadata = {
    ...getAgentMetadata(agent, accessRole),
    provider: provider ?? null,
    modelId: modelId ?? null,
  };

  const stream = createUIMessageStream({
    originalMessages,
    execute: ({ writer }) => {
      const textPartId = `${agent}-message`;

      writer.write({ type: "start", messageMetadata: metadata });
      writer.write({ type: "text-start", id: textPartId });
      writer.write({ type: "text-delta", id: textPartId, delta: text });
      writer.write({ type: "text-end", id: textPartId });
      writer.write({
        type: "finish",
        finishReason: "stop",
        messageMetadata: metadata,
      });
    },
  });

  return createUIMessageStreamResponse({ stream });
}

/**
 * Creates a synthetic agent response for the past-date scenario:
 * emits the PAST_DATE error text followed by a collect_date_range tool call
 * so the date picker opens automatically without relying on the LLM.
 */
export function createPastDateResponse({
  errorText,
  leaveType,
  reason,
  agent,
  accessRole,
  originalMessages,
  provider,
  modelId,
}: CreatePastDateResponseInput) {
  const metadata: MessageMetadata = {
    ...getAgentMetadata(agent, accessRole),
    provider: provider ?? null,
    modelId: modelId ?? null,
  };

  const stream = createUIMessageStream({
    originalMessages,
    execute: ({ writer }) => {
      const textPartId = `${agent}-past-date`;
      const toolCallId = `${agent}-collect-date`;

      writer.write({ type: "start", messageMetadata: metadata });

      writer.write({ type: "text-start", id: textPartId });
      writer.write({ type: "text-delta", id: textPartId, delta: errorText });
      writer.write({ type: "text-end", id: textPartId });

      writer.write({ type: "tool-input-start", toolCallId, toolName: "collect_date_range" });
      writer.write({
        type: "tool-input-available",
        toolCallId,
        toolName: "collect_date_range",
        input: { leaveType, ...(reason ? { reason } : {}) },
      });
      writer.write({
        type: "tool-output-available",
        toolCallId,
        output: { ok: true, message: "Date picker displayed. Waiting for user to select a date range." },
      });

      writer.write({ type: "finish", finishReason: "tool-calls", messageMetadata: metadata });
    },
  });

  return createUIMessageStreamResponse({ stream });
}
