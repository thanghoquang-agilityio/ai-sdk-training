import { AbstractAgent } from "@ag-ui/client";
import { EventType, type BaseEvent, type RunAgentInput, type Message } from "@ag-ui/core";
import { Observable } from "rxjs";
import { type UIMessage } from "ai";
import { routeConversation } from "./coordinator";
import { runEmployeeFlow } from "./ag-ui-employee";
import { runManagerFlow } from "./ag-ui-manager";
import { streamSpecialistEvents } from "./ag-ui-stream";
import { emitState, type LeaveAssistantState, type PendingToolCall } from "./ag-ui-types";
import { getMockAuthSession } from "@/lib/auth/session-store";
import { isAppRole, type AppRole } from "@/lib/auth/session";
import {
  getChatModelCandidates,
  isAIProviderName,
  type AIProviderName,
} from "@/lib/ai-provider";
import { normalizeOllamaBaseUrl } from "@/lib/ollama-url";
import { getErrorMessage } from "@/utils/error";
import { resolveAgentTools } from "@/agents/config";
import { buildEmployeeConversationPrompt } from "@/agents/employee/prompt/conversation";
import { buildManagerConversationPrompt } from "@/agents/manager/prompt/conversation";
import type { Observer } from "rxjs";
import type { LanguageModel } from "ai";
import type { MockAuthSession } from "@/lib/auth/session";

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

async function handleResumedAction(
  observer: Observer<BaseEvent>,
  runId: string,
  pendingTool: PendingToolCall,
  approved: boolean,
  session: MockAuthSession,
  model: LanguageModel,
  inputMessages: Message[],
) {
  emitState(observer, { phase: "executing", specialist: pendingTool.specialist });

  if (!approved) {
    const msgId = `cancelled-${runId}`;
    observer.next({ type: EventType.TEXT_MESSAGE_START, messageId: msgId, role: "assistant" });
    observer.next({ type: EventType.TEXT_MESSAGE_CONTENT, messageId: msgId, delta: "Action cancelled. Let me know if there's anything else I can help you with." });
    observer.next({ type: EventType.TEXT_MESSAGE_END, messageId: msgId });
    return;
  }

  const tools = resolveAgentTools(pendingTool.specialist, session, {}, model);
  const toolDef = tools[pendingTool.name];

  if (!toolDef?.execute) {
    const msgId = `error-${runId}`;
    observer.next({ type: EventType.TEXT_MESSAGE_START, messageId: msgId, role: "assistant" });
    observer.next({ type: EventType.TEXT_MESSAGE_CONTENT, messageId: msgId, delta: "Sorry, I couldn't complete that action. Please try again." });
    observer.next({ type: EventType.TEXT_MESSAGE_END, messageId: msgId });
    return;
  }

  // Open the message that will contain both the tool call and the follow-up stream.
  const msgId = `resume-msg-${runId}`;
  const toolCallId = `resume-tc-${runId}`;
  observer.next({ type: EventType.TEXT_MESSAGE_START, messageId: msgId, role: "assistant" });
  observer.next({ type: EventType.TOOL_CALL_START, toolCallId, toolCallName: pendingTool.name, parentMessageId: msgId });
  observer.next({ type: EventType.TOOL_CALL_ARGS, toolCallId, delta: JSON.stringify(pendingTool.args) });
  observer.next({ type: EventType.TOOL_CALL_END, toolCallId });

  const result = await (toolDef.execute as (args: unknown, opts: unknown) => Promise<unknown>)(
    pendingTool.args,
    { messages: [], toolCallId, abortSignal: new AbortController().signal },
  );

  const resultContent = typeof result === "string" ? result : JSON.stringify(result);
  observer.next({
    type: EventType.TOOL_CALL_RESULT,
    toolCallId,
    messageId: `result-${toolCallId}`,
    content: resultContent,
  });

  // Stream a follow-up response using the same message so the result table and
  // the confirmation text end up in one chat bubble.
  const existingUIMessages = agUIMessagesToUIMessages(inputMessages);
  const toolUIMessage: UIMessage = {
    id: toolCallId,
    role: "assistant",
    parts: [{
      type: "dynamic-tool" as const,
      toolCallId,
      toolName: pendingTool.name,
      state: "output-available" as const,
      input: pendingTool.args,
      output: (() => { try { return JSON.parse(resultContent); } catch { return resultContent; } })(),
    }],
  };

  const baseSystemPrompt = pendingTool.specialist === "manager"
    ? buildManagerConversationPrompt(session)
    : buildEmployeeConversationPrompt(session);

  await streamSpecialistEvents(observer, {
    runId,
    model,
    uiMessages: [...existingUIMessages, toolUIMessage],
    baseSystemPrompt,
    tools,
    initialMessageId: msgId,
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

        // Check for HITL resume signal
        const forwardedCommand = (input.forwardedProps as Record<string, unknown> | undefined)?.command as Record<string, unknown> | undefined;
        const resume = forwardedCommand?.resume as { approved: boolean } | undefined;
        const prevState = input.state as LeaveAssistantState | undefined;

        if (resume !== undefined && prevState?.pendingTool) {
          await handleResumedAction(observer, input.runId, prevState.pendingTool, resume.approved, session, model, input.messages);
          observer.next({ type: EventType.RUN_FINISHED, threadId: input.threadId, runId: input.runId });
          observer.complete();
          return;
        }

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
