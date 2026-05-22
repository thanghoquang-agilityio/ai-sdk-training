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
import {
  emitState,
  type AgentRunContext,
  type LeaveAssistantState,
  type PendingToolCall,
} from "./ag-ui-types";
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

function readContext(input: RunAgentInput, descriptionPrefix: string): string | undefined {
  const entry = input.context.find((c) => c.description.startsWith(descriptionPrefix));
  return entry?.value;
}

function tryParseJson<T>(value: string | undefined): T | undefined {
  if (!value) return undefined;
  try { return JSON.parse(value) as T; } catch { return undefined; }
}

async function buildAgentRunContext(input: RunAgentInput): Promise<AgentRunContext> {
  // 1. Parse each context entry by description — mirrors Mastra's typed context injection
  type RawConfig = { provider?: string; openaiApiKey?: string; ollamaBaseUrl?: string; authRole?: string };
  const rawConfig = tryParseJson<RawConfig>(readContext(input, "Leave assistant configuration"))
    ?? (input.forwardedProps as RawConfig | undefined)
    ?? {};

  const rawInstructions = tryParseJson<{ additionalInstructions?: string }>(
    readContext(input, "Additional behavioral instructions"),
  );
  const clientUserProfile = tryParseJson<Record<string, unknown>>(
    readContext(input, "Current authenticated user profile"),
  );

  // 2. Resolve session from DB using the auth role from context
  const rawRole = (rawConfig.authRole ?? "user").trim().toLowerCase();
  const session = await getMockAuthSession(isAppRole(rawRole) ? (rawRole as AppRole) : "user");

  // 3. Resolve model from provider config
  const providerOverride = isAIProviderName(rawConfig.provider ?? "")
    ? (rawConfig.provider as AIProviderName)
    : undefined;
  const { model } = getChatModelCandidates({
    provider: providerOverride,
    openaiApiKey: rawConfig.openaiApiKey,
    baseUrl: providerOverride === "ollama"
      ? (normalizeOllamaBaseUrl(rawConfig.ollamaBaseUrl ?? "") ?? undefined)
      : undefined,
  })[0];

  // 4. Merge additional instructions with client user profile section
  const profileSection = clientUserProfile
    ? `### Client user context (from browser)\n${Object.entries(clientUserProfile)
        .filter(([, v]) => v != null && v !== "")
        .map(([k, v]) => `- ${k}: ${v}`)
        .join("\n")}`
    : "";
  const additionalInstructions =
    [profileSection, rawInstructions?.additionalInstructions].filter(Boolean).join("\n\n") || undefined;

  return { session, model, additionalInstructions };
}

async function handleResumedAction(
  observer: Observer<BaseEvent>,
  runId: string,
  pendingTool: PendingToolCall,
  approved: boolean,
  ctx: AgentRunContext,
  inputMessages: Message[],
) {
  const { session, model, additionalInstructions } = ctx;
  emitState(observer, {
    phase: "executing",
    specialist: pendingTool.specialist,
  });

  if (!approved) {
    const msgId = `cancelled-${runId}`;
    observer.next({
      type: EventType.TEXT_MESSAGE_START,
      messageId: msgId,
      role: "assistant",
    });
    observer.next({
      type: EventType.TEXT_MESSAGE_CONTENT,
      messageId: msgId,
      delta:
        "Action cancelled. Let me know if there's anything else I can help you with.",
    });
    observer.next({ type: EventType.TEXT_MESSAGE_END, messageId: msgId });
    return;
  }

  const tools = resolveAgentTools(pendingTool.specialist, session, {}, model);
  const toolDef = tools[pendingTool.name];

  if (!toolDef?.execute) {
    const msgId = `error-${runId}`;
    observer.next({
      type: EventType.TEXT_MESSAGE_START,
      messageId: msgId,
      role: "assistant",
    });
    observer.next({
      type: EventType.TEXT_MESSAGE_CONTENT,
      messageId: msgId,
      delta: "Sorry, I couldn't complete that action. Please try again.",
    });
    observer.next({ type: EventType.TEXT_MESSAGE_END, messageId: msgId });
    return;
  }

  const msgId = `resume-msg-${runId}`;
  const toolCallId = `resume-tc-${runId}`;
  observer.next({
    type: EventType.TEXT_MESSAGE_START,
    messageId: msgId,
    role: "assistant",
  });
  observer.next({
    type: EventType.TOOL_CALL_START,
    toolCallId,
    toolCallName: pendingTool.name,
    parentMessageId: msgId,
  });
  observer.next({
    type: EventType.TOOL_CALL_ARGS,
    toolCallId,
    delta: JSON.stringify(pendingTool.args),
  });
  observer.next({ type: EventType.TOOL_CALL_END, toolCallId });

  const result = await (
    toolDef.execute as (args: unknown, opts: unknown) => Promise<unknown>
  )(pendingTool.args, {
    messages: [],
    toolCallId,
    abortSignal: new AbortController().signal,
  });

  const resultContent =
    typeof result === "string" ? result : JSON.stringify(result);
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
    parts: [
      {
        type: "dynamic-tool" as const,
        toolCallId,
        toolName: pendingTool.name,
        state: "output-available" as const,
        input: pendingTool.args,
        output: (() => {
          try {
            return JSON.parse(resultContent);
          } catch {
            return resultContent;
          }
        })(),
      },
    ],
  };

  const basePrompt =
    pendingTool.specialist === "manager"
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
        description:
          "Leave management assistant — balance checks, requests, approvals, and policy Q&A.",
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
        const ctx = await buildAgentRunContext(input);

        const forwardedCommand = (
          input.forwardedProps as Record<string, unknown> | undefined
        )?.command as Record<string, unknown> | undefined;
        const resume = forwardedCommand?.resume as
          | { approved: boolean }
          | undefined;
        const prevState = input.state as LeaveAssistantState | undefined;

        if (resume !== undefined && prevState?.pendingTool) {
          await handleResumedAction(
            observer,
            input.runId,
            prevState.pendingTool,
            resume.approved,
            ctx,
            input.messages,
          );
          observer.next({
            type: EventType.RUN_FINISHED,
            threadId: input.threadId,
            runId: input.runId,
          });
          observer.complete();
          return;
        }

        const uiMessages = agUIMessagesToUIMessages(input.messages);
        emitState(observer, { phase: "routing" });

        const decision = await routeConversation({
          model: ctx.model,
          messages: uiMessages,
          session: ctx.session,
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

        if (decision.specialist === "manager") {
          await runManagerFlow(observer, input.runId, uiMessages, ctx);
        } else {
          await runEmployeeFlow(observer, input.runId, uiMessages, ctx);
        }

        observer.next({
          type: EventType.RUN_FINISHED,
          threadId: input.threadId,
          runId: input.runId,
        });
        observer.complete();
      })().catch((error) => {
        // Let ErrorBoundaryMiddleware convert this Observable error into a RUN_ERROR event.
        observer.error(
          error instanceof Error ? error : new Error(String(error)),
        );
      });
    });
  }
}
