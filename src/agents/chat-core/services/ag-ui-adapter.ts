import { AbstractAgent } from "@ag-ui/client";
import {
  EventType,
  type AgentCapabilities,
  type BaseEvent,
  type RunAgentInput,
  type Message,
} from "@ag-ui/core";
import { Observable } from "rxjs";
import { type UIMessage } from "ai";
import { routeConversation } from "./coordinator";
import { runEmployeeFlow } from "./ag-ui-employee";
import { runManagerFlow } from "./ag-ui-manager";
import { streamSpecialistEvents } from "./ag-ui-stream";
import { emitState, type LeaveAssistantState, type PendingToolCall } from "./ag-ui-types";
import {
  ErrorBoundaryMiddleware,
  MetricsMiddleware,
  VerifyEventsMiddleware,
} from "@/lib/ag-ui/middleware";
import { getMockAuthSession } from "@/lib/auth/session-store";
import { isAppRole, type AppRole } from "@/lib/auth/session";
import {
  getChatModelCandidates,
  isAIProviderName,
  type AIProviderName,
} from "@/lib/ai-provider";
import { normalizeOllamaBaseUrl } from "@/lib/ollama-url";
import { agUIMessagesToUIMessages } from "@/utils/message-adapter";
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
  additionalInstructions?: string;
};

function parseAgentConfig(input: RunAgentInput): AgentConfig {
  const configEntry = input.context.find((c) =>
    c.description.startsWith("Leave assistant configuration"),
  );
  const instructionsEntry = input.context.find((c) =>
    c.description.startsWith("Additional behavioral instructions"),
  );

  let config: AgentConfig = {};
  if (configEntry) {
    try {
      config = JSON.parse(configEntry.value) as AgentConfig;
    } catch { /* fall through to forwardedProps */ }
  } else {
    config = (input.forwardedProps ?? {}) as AgentConfig;
  }

  if (instructionsEntry) {
    try {
      const parsed = JSON.parse(instructionsEntry.value) as { additionalInstructions?: string };
      if (parsed.additionalInstructions) {
        config = { ...config, additionalInstructions: parsed.additionalInstructions };
      }
    } catch { /* ignore malformed instructions entry */ }
  }

  return config;
}

async function handleResumedAction(
  observer: Observer<BaseEvent>,
  runId: string,
  pendingTool: PendingToolCall,
  approved: boolean,
  session: MockAuthSession,
  model: LanguageModel,
  inputMessages: Message[],
  additionalInstructions?: string,
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

  const basePrompt = pendingTool.specialist === "manager"
    ? buildManagerConversationPrompt(session)
    : buildEmployeeConversationPrompt(session);

  await streamSpecialistEvents(observer, {
    runId,
    model,
    uiMessages: [...existingUIMessages, toolUIMessage],
    baseSystemPrompt: additionalInstructions
      ? `${basePrompt}\n\n${additionalInstructions}`
      : basePrompt,
    tools,
    initialMessageId: msgId,
  });
}

export class LeaveAssistantAgent extends AbstractAgent {
  constructor() {
    super();
    // VerifyEvents outermost (protocol validation), ErrorBoundary innermost (catches agent errors).
    this.use(
      new VerifyEventsMiddleware(),
      new MetricsMiddleware(),
      new ErrorBoundaryMiddleware(),
    );
  }

  async getCapabilities(): Promise<AgentCapabilities> {
    return {
      identity: {
        name: "Leave Assistant",
        type: "custom",
        description: "Leave management assistant — balance checks, requests, approvals, and policy Q&A.",
      },
      transport: { streaming: true },
      state: { snapshots: true },
      humanInTheLoop: { supported: true, approvals: true },
    };
  }

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

        const forwardedCommand = (input.forwardedProps as Record<string, unknown> | undefined)?.command as Record<string, unknown> | undefined;
        const resume = forwardedCommand?.resume as { approved: boolean } | undefined;
        const prevState = input.state as LeaveAssistantState | undefined;

        if (resume !== undefined && prevState?.pendingTool) {
          await handleResumedAction(
            observer, input.runId, prevState.pendingTool, resume.approved,
            session, model, input.messages, config.additionalInstructions,
          );
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
          await runManagerFlow(observer, input.runId, uiMessages, session, model, config.additionalInstructions);
        } else {
          await runEmployeeFlow(observer, input.runId, uiMessages, session, model, config.additionalInstructions);
        }

        observer.next({ type: EventType.RUN_FINISHED, threadId: input.threadId, runId: input.runId });
        observer.complete();
      })().catch((error) => {
        // Let ErrorBoundaryMiddleware convert this Observable error into a RUN_ERROR event.
        observer.error(error instanceof Error ? error : new Error(String(error)));
      });
    });
  }
}
