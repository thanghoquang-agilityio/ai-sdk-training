import { EventType, type BaseEvent } from "@ag-ui/core";
import type { Observer } from "rxjs";
import {
  convertToModelMessages,
  smoothStream,
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
import type { PendingToolCall } from "./ag-ui-types";

// collect_date_range ends the turn immediately — the UI takes over to collect dates.
const TERMINAL_TOOL_NAMES = new Set(["collect_date_range"]);

// Frontend tools: server signals the call but lets the client execute them.
// No TOOL_CALL_RESULT is emitted — CopilotKit sees the pending tool call and
// dispatches it to the useFrontendTool handler registered on the client.
const FRONTEND_TOOL_NAMES = new Set(["collect_date_range"]);

// Fallback text emitted when a frontend tool fires before the model streamed any text.
// Prevents the assistant bubble from being empty (e.g. date picker without explanation).
const FRONTEND_TOOL_FALLBACK_TEXT: Record<string, string> = {
  collect_date_range: "Select dates for your time-off request.",
};

function hasCalledTerminalTool({
  steps,
}: {
  steps: StepResult<ToolSet>[];
}): boolean {
  const lastStep = steps[steps.length - 1];
  if (!lastStep) return false;
  return (lastStep.toolCalls ?? []).some((call) =>
    TERMINAL_TOOL_NAMES.has(call.toolName),
  );
}

const INTERRUPT_TOOL_NAMES = new Set([
  "submit_my_time_off_request",
  "cancel_my_time_off_request",
  "approve_team_time_off_request",
  "reject_team_time_off_request",
]);

const INTERRUPT_TOOL_LABELS: Record<string, string> = {
  submit_my_time_off_request: "Submit time-off request",
  cancel_my_time_off_request: "Cancel time-off request",
  approve_team_time_off_request: "Approve time-off request",
  reject_team_time_off_request: "Reject time-off request",
};

function wrapInterruptTools(tools: ToolSet): ToolSet {
  const result: ToolSet = {};
  for (const [name, t] of Object.entries(tools)) {
    if (INTERRUPT_TOOL_NAMES.has(name)) {
      result[name] = { ...t, execute: async () => ({ __pending: true }) };
    } else {
      result[name] = t;
    }
  }
  return result;
}

type StreamSpecialistOptions = {
  runId: string;
  model: LanguageModel;
  uiMessages: UIMessage[];
  baseSystemPrompt: string;
  tools: ToolSet;
  onInterrupt?: (pending: Omit<PendingToolCall, "specialist">) => void;
  onTextDelta?: (delta: string) => void;
  /** Fires when a frontend tool call completes (name of the tool). */
  onFrontendTool?: (toolName: string) => void;
  /** Pre-opened message ID — caller already emitted TEXT_MESSAGE_START; stream continues in it. */
  initialMessageId?: string;
};

export async function streamSpecialistEvents(
  observer: Observer<BaseEvent>,
  opts: StreamSpecialistOptions,
): Promise<void> {
  const runPolicy = resolveAgentRunPolicy();
  const conversation = buildConversationRuntimeContext({
    messages: opts.uiMessages,
    messageWindow: runPolicy.messageWindow,
  });
  const systemPrompt = buildRuntimeSystemPrompt({
    baseSystemPrompt: opts.baseSystemPrompt,
    latestUserText: conversation.latestUserText,
    olderContextSummary: conversation.olderContextSummary,
    hasCompactedHistory: conversation.hasCompactedHistory,
  });
  const modelMessages = await convertToModelMessages(
    conversation.recentMessages,
  );

  const result = streamText({
    model: opts.model,
    system: systemPrompt,
    messages: modelMessages,
    tools: wrapInterruptTools(opts.tools),
    stopWhen: [stepCountIs(runPolicy.stopStepCount), hasCalledTerminalTool],
    temperature: runPolicy.temperature,
    maxRetries: runPolicy.maxRetries,
    maxOutputTokens: runPolicy.maxOutputTokens,
    experimental_transform: smoothStream({
      delayInMs: runPolicy.streamChunkDelayMs,
      chunking: /[\s\S]/,
    }),
  });

  let currentTextMsgId: string | null = opts.initialMessageId ?? null;
  let textMsgSeq = 0;
  let hasToolCallInCurrentStep = false;
  const toolCallNames = new Map<string, string>();
  const toolCallArgsBuf = new Map<string, string>();

  // Interrupt tracking for mutation tools
  let interceptingToolId: string | null = null;
  let interceptingToolName: string | null = null;
  let interceptingArgsBuf = "";

  for await (const part of result.fullStream) {
    if (part.type === "text-delta") {
      if (!currentTextMsgId) {
        currentTextMsgId = `text-${opts.runId}-${textMsgSeq++}`;
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
      opts.onTextDelta?.(part.text);
    } else if (part.type === "tool-input-start") {
      if (INTERRUPT_TOOL_NAMES.has(part.toolName) && !interceptingToolId) {
        // Suppress this mutation tool — collect args silently
        interceptingToolId = part.id;
        interceptingToolName = part.toolName;
        interceptingArgsBuf = "";
      } else if (!interceptingToolId) {
        // Create the message now if none exists so the tool call is attached to it
        if (!currentTextMsgId) {
          currentTextMsgId = `text-${opts.runId}-${textMsgSeq++}`;
          observer.next({
            type: EventType.TEXT_MESSAGE_START,
            messageId: currentTextMsgId,
            role: "assistant",
          });
          // Frontend tools with no preceding text: inject a helpful default
          // message so the assistant bubble isn't empty alongside the UI widget.
          const fallback = FRONTEND_TOOL_FALLBACK_TEXT[part.toolName];
          if (fallback && FRONTEND_TOOL_NAMES.has(part.toolName)) {
            observer.next({
              type: EventType.TEXT_MESSAGE_CONTENT,
              messageId: currentTextMsgId,
              delta: fallback,
            });
            opts.onTextDelta?.(fallback);
          }
        }
        hasToolCallInCurrentStep = true;
        toolCallNames.set(part.id, part.toolName);
        toolCallArgsBuf.set(part.id, "");
        observer.next({
          type: EventType.TOOL_CALL_START,
          toolCallId: part.id,
          toolCallName: part.toolName,
          parentMessageId: currentTextMsgId,
        });
      }
    } else if (part.type === "tool-input-delta") {
      if (part.id === interceptingToolId) {
        interceptingArgsBuf += part.delta;
      } else {
        toolCallArgsBuf.set(
          part.id,
          (toolCallArgsBuf.get(part.id) ?? "") + part.delta,
        );
        observer.next({
          type: EventType.TOOL_CALL_ARGS,
          toolCallId: part.id,
          delta: part.delta,
        });
      }
    } else if (part.type === "tool-input-end") {
      if (part.id === interceptingToolId) {
        // Args fully received — fire interrupt and exit the stream
        if (currentTextMsgId) {
          observer.next({
            type: EventType.TEXT_MESSAGE_END,
            messageId: currentTextMsgId,
          });
          currentTextMsgId = null;
        }
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(interceptingArgsBuf);
        } catch {
          /* skip */
        }
        opts.onInterrupt?.({
          name: interceptingToolName!,
          args,
          label:
            INTERRUPT_TOOL_LABELS[interceptingToolName!] ??
            interceptingToolName!,
        });
        return;
      } else {
        observer.next({ type: EventType.TOOL_CALL_END, toolCallId: part.id });
        const completedToolName = toolCallNames.get(part.id);
        if (completedToolName && FRONTEND_TOOL_NAMES.has(completedToolName)) {
          opts.onFrontendTool?.(completedToolName);
        }
      }
    } else if (part.type === "tool-result") {
      const toolName = toolCallNames.get(part.toolCallId);
      if (!FRONTEND_TOOL_NAMES.has(toolName ?? "")) {
        // Backend tools: forward the result into the AG-UI message stream.
        const output = (part as { output?: unknown }).output;
        observer.next({
          type: EventType.TOOL_CALL_RESULT,
          toolCallId: part.toolCallId,
          messageId: `result-${part.toolCallId}`,
          content: typeof output === "string" ? output : JSON.stringify(output),
        });
      }
      // Frontend tools (e.g. collect_date_range): no TOOL_CALL_RESULT is emitted.
      // CopilotKit detects the unresolved tool call and invokes the useFrontendTool handler.
    } else if (part.type === "finish-step") {
      if (currentTextMsgId && !hasToolCallInCurrentStep) {
        observer.next({
          type: EventType.TEXT_MESSAGE_END,
          messageId: currentTextMsgId,
        });
        currentTextMsgId = null;
      }
      hasToolCallInCurrentStep = false;
    }
  }

  if (currentTextMsgId) {
    observer.next({
      type: EventType.TEXT_MESSAGE_END,
      messageId: currentTextMsgId,
    });
  }
}
