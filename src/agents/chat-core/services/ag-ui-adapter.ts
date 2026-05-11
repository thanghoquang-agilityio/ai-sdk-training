import { AbstractAgent } from "@ag-ui/client";
import { EventType, type BaseEvent, type RunAgentInput, type Message } from "@ag-ui/core";
import { Observable } from "rxjs";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
  type ToolSet,
} from "ai";
import {
  buildConversationRuntimeContext,
  buildRuntimeSystemPrompt,
} from "../prompt/builder";
import { resolveAgentRunPolicy } from "../observers/policy";
import { routeConversation } from "./coordinator";
import { buildManagerConversationPrompt } from "@/agents/manager/prompt/conversation";
import { buildEmployeeConversationPrompt } from "@/agents/employee/prompt/conversation";
import { resolveAgentTools } from "@/agents/config";
import { getMockAuthSession } from "@/lib/auth/session-store";
import { isAppRole, type AppRole } from "@/lib/auth/session";
import {
  getChatModelCandidates,
  isAIProviderName,
  type AIProviderName,
} from "@/lib/ai-provider";
import { normalizeOllamaBaseUrl } from "@/lib/ollama-url";
import { getErrorMessage } from "@/utils/error";

type LeaveAssistantForwardedProps = {
  provider?: string;
  openaiApiKey?: string;
  ollamaBaseUrl?: string;
  authRole?: string;
};

function agUIMessagesToUIMessages(messages: Message[]): UIMessage[] {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      const text = typeof m.content === "string" ? m.content : "";
      return {
        id: m.id,
        role: m.role as "user" | "assistant",
        content: text,
        parts: [{ type: "text" as const, text }],
        metadata: undefined,
      };
    });
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
        const fp = (input.forwardedProps ?? {}) as LeaveAssistantForwardedProps;

        const rawRole = fp.authRole?.trim().toLowerCase() ?? "user";
        const session = await getMockAuthSession(
          isAppRole(rawRole) ? (rawRole as AppRole) : "user",
        );

        const providerOverride = isAIProviderName(fp.provider ?? "")
          ? (fp.provider as AIProviderName)
          : undefined;
        const normalizedOllamaBaseUrl = normalizeOllamaBaseUrl(
          fp.ollamaBaseUrl ?? "",
        );
        const candidates = getChatModelCandidates({
          provider: providerOverride,
          openaiApiKey: fp.openaiApiKey,
          baseUrl:
            providerOverride === "ollama"
              ? (normalizedOllamaBaseUrl ?? undefined)
              : undefined,
        });
        const modelConfig = candidates[0];

        const uiMessages = agUIMessagesToUIMessages(input.messages);

        const decision = await routeConversation({
          model: modelConfig.model,
          messages: uiMessages,
          session,
        });

        if (decision.type === "deny") {
          const msgId = `deny-${input.runId}`;
          observer.next({
            type: EventType.TEXT_MESSAGE_START,
            messageId: msgId,
            role: "assistant",
          });
          observer.next({
            type: EventType.TEXT_MESSAGE_CONTENT,
            messageId: msgId,
            delta: decision.message,
          });
          observer.next({ type: EventType.TEXT_MESSAGE_END, messageId: msgId });
          observer.next({
            type: EventType.RUN_FINISHED,
            threadId: input.threadId,
            runId: input.runId,
          });
          observer.complete();
          return;
        }

        const runPolicy = resolveAgentRunPolicy();
        const conversation = buildConversationRuntimeContext({
          messages: uiMessages,
          messageWindow: runPolicy.messageWindow,
        });

        let baseSystemPrompt: string;
        let tools: ToolSet;

        if (decision.specialist === "manager") {
          baseSystemPrompt = buildManagerConversationPrompt(session);
          tools = resolveAgentTools("manager", session, undefined, modelConfig.model);
        } else {
          baseSystemPrompt = buildEmployeeConversationPrompt(session);
          tools = resolveAgentTools("employee", session, {}, modelConfig.model);
        }

        const systemPrompt = buildRuntimeSystemPrompt({
          baseSystemPrompt,
          latestUserText: conversation.latestUserText,
          olderContextSummary: conversation.olderContextSummary,
          hasCompactedHistory: conversation.hasCompactedHistory,
        });

        const modelMessages = await convertToModelMessages(
          conversation.recentMessages,
        );

        const result = streamText({
          model: modelConfig.model,
          system: systemPrompt,
          messages: modelMessages,
          tools,
          stopWhen: stepCountIs(runPolicy.stopStepCount),
          temperature: runPolicy.temperature,
          maxRetries: runPolicy.maxRetries,
          maxOutputTokens: runPolicy.maxOutputTokens,
        });

        let currentTextMsgId: string | null = null;

        for await (const part of result.fullStream) {
          if (part.type === "text-delta") {
            if (!currentTextMsgId) {
              currentTextMsgId = `text-${input.runId}`;
              observer.next({
                type: EventType.TEXT_MESSAGE_START,
                messageId: currentTextMsgId,
                role: "assistant",
              });
            }
            observer.next({
              type: EventType.TEXT_MESSAGE_CONTENT,
              messageId: currentTextMsgId,
              delta: part.text,
            });
          } else if (part.type === "tool-input-start") {
            if (currentTextMsgId) {
              observer.next({
                type: EventType.TEXT_MESSAGE_END,
                messageId: currentTextMsgId,
              });
              currentTextMsgId = null;
            }
            observer.next({
              type: EventType.TOOL_CALL_START,
              toolCallId: part.id,
              toolCallName: part.toolName,
            });
          } else if (part.type === "tool-input-delta") {
            observer.next({
              type: EventType.TOOL_CALL_ARGS,
              toolCallId: part.id,
              delta: part.delta,
            });
          } else if (part.type === "tool-input-end") {
            observer.next({
              type: EventType.TOOL_CALL_END,
              toolCallId: part.id,
            });
          } else if (part.type === "tool-result") {
            const resultMsgId = `result-${part.toolCallId}`;
            const output = (part as { output?: unknown }).output;
            observer.next({
              type: EventType.TOOL_CALL_RESULT,
              toolCallId: part.toolCallId,
              messageId: resultMsgId,
              content:
                typeof output === "string" ? output : JSON.stringify(output),
            });
          } else if (part.type === "finish-step" && currentTextMsgId) {
            observer.next({
              type: EventType.TEXT_MESSAGE_END,
              messageId: currentTextMsgId,
            });
            currentTextMsgId = null;
          }
        }

        if (currentTextMsgId) {
          observer.next({
            type: EventType.TEXT_MESSAGE_END,
            messageId: currentTextMsgId,
          });
        }

        observer.next({
          type: EventType.RUN_FINISHED,
          threadId: input.threadId,
          runId: input.runId,
        });
        observer.complete();
      })().catch((error) => {
        observer.next({
          type: EventType.RUN_ERROR,
          message: getErrorMessage(error),
        });
        observer.error(error);
      });
    });
  }
}
