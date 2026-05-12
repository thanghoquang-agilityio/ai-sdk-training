import { EventType, type BaseEvent } from "@ag-ui/core";
import type { Observer } from "rxjs";
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
import type { PendingToolCall } from "./ag-ui-types";

function hasCalledAnyTool({ steps }: { steps: StepResult<ToolSet>[] }): boolean {
  const lastStep = steps[steps.length - 1];
  if (!lastStep) return false;
  return (lastStep.toolCalls ?? []).length > 0;
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
  onCollectDateRange?: (leaveType?: string) => void;
  onInterrupt?: (pending: Omit<PendingToolCall, "specialist">) => void;
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
  const modelMessages = await convertToModelMessages(conversation.recentMessages);

  const result = streamText({
    model: opts.model,
    system: systemPrompt,
    messages: modelMessages,
    tools: wrapInterruptTools(opts.tools),
    stopWhen: [stepCountIs(runPolicy.stopStepCount), hasCalledAnyTool],
    temperature: runPolicy.temperature,
    maxRetries: runPolicy.maxRetries,
    maxOutputTokens: runPolicy.maxOutputTokens,
  });

  let currentTextMsgId: string | null = null;
  let textMsgSeq = 0;
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
    } else if (part.type === "tool-input-start") {
      if (INTERRUPT_TOOL_NAMES.has(part.toolName) && !interceptingToolId) {
        // Suppress this mutation tool — collect args silently
        interceptingToolId = part.id;
        interceptingToolName = part.toolName;
        interceptingArgsBuf = "";
      } else if (!interceptingToolId) {
        if (currentTextMsgId) {
          observer.next({ type: EventType.TEXT_MESSAGE_END, messageId: currentTextMsgId });
          currentTextMsgId = null;
        }
        toolCallNames.set(part.id, part.toolName);
        toolCallArgsBuf.set(part.id, "");
        observer.next({
          type: EventType.TOOL_CALL_START,
          toolCallId: part.id,
          toolCallName: part.toolName,
        });
      }
    } else if (part.type === "tool-input-delta") {
      if (part.id === interceptingToolId) {
        interceptingArgsBuf += part.delta;
      } else {
        toolCallArgsBuf.set(part.id, (toolCallArgsBuf.get(part.id) ?? "") + part.delta);
        observer.next({ type: EventType.TOOL_CALL_ARGS, toolCallId: part.id, delta: part.delta });
      }
    } else if (part.type === "tool-input-end") {
      if (part.id === interceptingToolId) {
        // Args fully received — fire interrupt and exit the stream
        if (currentTextMsgId) {
          observer.next({ type: EventType.TEXT_MESSAGE_END, messageId: currentTextMsgId });
          currentTextMsgId = null;
        }
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(interceptingArgsBuf); } catch { /* skip */ }
        opts.onInterrupt?.({
          name: interceptingToolName!,
          args,
          label: INTERRUPT_TOOL_LABELS[interceptingToolName!] ?? interceptingToolName!,
        });
        return;
      } else {
        observer.next({ type: EventType.TOOL_CALL_END, toolCallId: part.id });
      }
    } else if (part.type === "tool-result") {
      const output = (part as { output?: unknown }).output;
      observer.next({
        type: EventType.TOOL_CALL_RESULT,
        toolCallId: part.toolCallId,
        messageId: `result-${part.toolCallId}`,
        content: typeof output === "string" ? output : JSON.stringify(output),
      });

      if (toolCallNames.get(part.toolCallId) === "collect_date_range" && opts.onCollectDateRange) {
        const argsStr = toolCallArgsBuf.get(part.toolCallId) ?? "{}";
        let leaveType: string | undefined;
        try {
          leaveType = (JSON.parse(argsStr) as Record<string, unknown>).leaveType as string | undefined;
        } catch { /* skip */ }
        opts.onCollectDateRange(leaveType);
      }
    } else if (part.type === "finish-step" && currentTextMsgId) {
      observer.next({ type: EventType.TEXT_MESSAGE_END, messageId: currentTextMsgId });
      currentTextMsgId = null;
    }
  }

  if (currentTextMsgId) {
    observer.next({ type: EventType.TEXT_MESSAGE_END, messageId: currentTextMsgId });
  }
}
