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

const TERMINAL_TOOL_NAMES = new Set(["collect_date_range"]);

function hasCalledTerminalTool({ steps }: { steps: StepResult<ToolSet>[] }): boolean {
  const lastStep = steps[steps.length - 1];
  if (!lastStep) return false;
  return (lastStep.toolCalls ?? []).some((call) => TERMINAL_TOOL_NAMES.has(call.toolName));
}

type StreamSpecialistOptions = {
  runId: string;
  model: LanguageModel;
  uiMessages: UIMessage[];
  baseSystemPrompt: string;
  tools: ToolSet;
  onCollectDateRange?: (leaveType?: string) => void;
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
    tools: opts.tools,
    stopWhen: [stepCountIs(runPolicy.stopStepCount), hasCalledTerminalTool],
    temperature: runPolicy.temperature,
    maxRetries: runPolicy.maxRetries,
    maxOutputTokens: runPolicy.maxOutputTokens,
  });

  let currentTextMsgId: string | null = null;
  const toolCallNames = new Map<string, string>();
  const toolCallArgsBuf = new Map<string, string>();

  for await (const part of result.fullStream) {
    if (part.type === "text-delta") {
      if (!currentTextMsgId) {
        currentTextMsgId = `text-${opts.runId}`;
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
    } else if (part.type === "tool-input-delta") {
      toolCallArgsBuf.set(part.id, (toolCallArgsBuf.get(part.id) ?? "") + part.delta);
      observer.next({ type: EventType.TOOL_CALL_ARGS, toolCallId: part.id, delta: part.delta });
    } else if (part.type === "tool-input-end") {
      observer.next({ type: EventType.TOOL_CALL_END, toolCallId: part.id });
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
