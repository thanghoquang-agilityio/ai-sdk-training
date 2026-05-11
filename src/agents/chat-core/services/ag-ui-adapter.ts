import { AbstractAgent } from "@ag-ui/client";
import { EventType, type BaseEvent, type RunAgentInput, type Message } from "@ag-ui/core";
import { Observable } from "rxjs";
import { type UIMessage } from "ai";
import { routeConversation } from "./coordinator";
import { runEmployeeFlow } from "./ag-ui-employee";
import { runManagerFlow } from "./ag-ui-manager";
import { emitState } from "./ag-ui-types";
import { getMockAuthSession } from "@/lib/auth/session-store";
import { isAppRole, type AppRole } from "@/lib/auth/session";
import {
  getChatModelCandidates,
  isAIProviderName,
  type AIProviderName,
} from "@/lib/ai-provider";
import { normalizeOllamaBaseUrl } from "@/lib/ollama-url";
import { getErrorMessage } from "@/utils/error";

type AgentConfig = {
  provider?: string;
  openaiApiKey?: string;
  ollamaBaseUrl?: string;
  authRole?: string;
};

function parseAgentConfig(input: RunAgentInput): AgentConfig {
  const contextEntry = input.context.find((c) =>
    c.description.startsWith("Leave assistant configuration"),
  );
  if (contextEntry) {
    try {
      return JSON.parse(contextEntry.value) as AgentConfig;
    } catch { /* fall through to forwardedProps */ }
  }
  return (input.forwardedProps ?? {}) as AgentConfig;
}

function agUIMessagesToUIMessages(messages: Message[]): UIMessage[] {
  const result: UIMessage[] = [];
  const toolCallLocation = new Map<string, { msgIndex: number; partIndex: number }>();

  for (const msg of messages) {
    if (msg.role === "user") {
      const text = typeof msg.content === "string" ? msg.content : "";
      result.push({ id: msg.id, role: "user", parts: [{ type: "text" as const, text }] });
    } else if (msg.role === "assistant") {
      const text = typeof msg.content === "string" ? msg.content : "";
      const parts: UIMessage["parts"] = text ? [{ type: "text" as const, text }] : [];

      if (msg.toolCalls) {
        for (const toolCall of msg.toolCalls) {
          toolCallLocation.set(toolCall.id, { msgIndex: result.length, partIndex: parts.length });
          let input: unknown = {};
          try { input = JSON.parse(toolCall.function.arguments); } catch { /* empty */ }
          parts.push({
            type: "dynamic-tool" as const,
            toolName: toolCall.function.name,
            toolCallId: toolCall.id,
            state: "input-available" as const,
            input,
          } as UIMessage["parts"][number]);
        }
      }

      if (parts.length > 0) result.push({ id: msg.id, role: "assistant", parts });
    } else if (msg.role === "tool") {
      const location = toolCallLocation.get(msg.toolCallId);
      if (location) {
        const targetMsg = result[location.msgIndex];
        const targetPart = targetMsg?.parts[location.partIndex];
        if (targetPart?.type === "dynamic-tool") {
          let output: unknown;
          try { output = JSON.parse(msg.content); } catch { output = msg.content; }
          targetMsg.parts[location.partIndex] = {
            ...targetPart,
            state: "output-available" as const,
            output,
          } as UIMessage["parts"][number];
        }
      }
    }
  }

  return result;
}

export class LeaveAssistantAgent extends AbstractAgent {
  run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable((observer) => {
      observer.next({
        type: EventType.RUN_STARTED,
        threadId: input.threadId,
        runId: input.runId,
      });

      (async () => {
        const config = parseAgentConfig(input);

        const rawRole = (config.authRole ?? "user").trim().toLowerCase();
        const session = await getMockAuthSession(
          isAppRole(rawRole) ? (rawRole as AppRole) : "user",
        );

        const providerOverride = isAIProviderName(config.provider ?? "")
          ? (config.provider as AIProviderName)
          : undefined;
        const normalizedOllamaBaseUrl = normalizeOllamaBaseUrl(config.ollamaBaseUrl ?? "");
        const candidates = getChatModelCandidates({
          provider: providerOverride,
          openaiApiKey: config.openaiApiKey,
          baseUrl: providerOverride === "ollama" ? (normalizedOllamaBaseUrl ?? undefined) : undefined,
        });
        const { model } = candidates[0];

        const uiMessages = agUIMessagesToUIMessages(input.messages);

        emitState(observer, { phase: "routing" });

        const decision = await routeConversation({ model, messages: uiMessages, session });

        if (decision.type === "deny") {
          const msgId = `deny-${input.runId}`;
          observer.next({ type: EventType.TEXT_MESSAGE_START, messageId: msgId, role: "assistant" });
          observer.next({ type: EventType.TEXT_MESSAGE_CONTENT, messageId: msgId, delta: decision.message });
          observer.next({ type: EventType.TEXT_MESSAGE_END, messageId: msgId });
          observer.next({ type: EventType.RUN_FINISHED, threadId: input.threadId, runId: input.runId });
          observer.complete();
          return;
        }

        if (decision.specialist === "manager") {
          await runManagerFlow(observer, input.runId, uiMessages, session, model);
        } else {
          await runEmployeeFlow(observer, input.runId, uiMessages, session, model);
        }

        observer.next({ type: EventType.RUN_FINISHED, threadId: input.threadId, runId: input.runId });
        observer.complete();
      })().catch((error) => {
        observer.next({ type: EventType.RUN_ERROR, message: getErrorMessage(error) });
        observer.error(error);
      });
    });
  }
}
