import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import type { AppRole } from "@/lib/auth/session";
import type {
  AgentMetadata,
  AgentName,
  MessageMetadata,
} from "../types";

type CreateStaticAgentResponseInput = {
  text: string;
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
