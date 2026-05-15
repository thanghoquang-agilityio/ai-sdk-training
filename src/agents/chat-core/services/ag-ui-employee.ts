import { EventType, type BaseEvent, type CustomEvent } from "@ag-ui/core";
import type { Observer } from "rxjs";
import type { LanguageModel, UIMessage } from "ai";
import type { MockAuthSession } from "@/lib/auth/session";
import { buildEmployeeConversationPrompt } from "@/agents/employee/prompt/conversation";
import { resolveAgentTools } from "@/agents/config";
import { invokeDateAgent } from "@/agents/handlers/common/date-specialist";
import { getTodayIsoDate } from "@/agents/handlers/common/date";
import { submitMyTimeOffRequest } from "@/agents/handlers/time-off";
import { getLatestUserText } from "@/utils/message";
import {
  DATE_MENTION_REGEX,
  extractDatesFromHistory,
  extractLeaveContextFromHistory,
  extractLeaveType,
  isStartDateInPast,
  modelAskedForDatesInText,
  tryExtractDurationDates,
  tryExtractIsoDatesDirect,
  extractLeaveTypeFromHistory,
} from "@/agents/handlers/common/intent";
import { emitState, type PendingToolCall } from "./ag-ui-types";
import { streamSpecialistEvents } from "./ag-ui-stream";

export async function runEmployeeFlow(
  observer: Observer<BaseEvent>,
  runId: string,
  uiMessages: UIMessage[],
  session: MockAuthSession,
  model: LanguageModel,
  additionalInstructions?: string,
): Promise<void> {
  const latestUserText = getLatestUserText(uiMessages);
  let preResolvedDates = tryExtractIsoDatesDirect(latestUserText) ?? tryExtractDurationDates(latestUserText);

  if (!preResolvedDates && DATE_MENTION_REGEX.test(latestUserText)) {
    emitState(observer, { phase: "resolving_dates", specialist: "employee" });
    try {
      const result = await invokeDateAgent(latestUserText, session, model);
      if (!result.isAmbiguous && result.startDate && result.endDate) {
        preResolvedDates = { startDate: result.startDate, endDate: result.endDate };
      }
    } catch { /* proceed without pre-resolved dates */ }
  }

  // Fall back to the most recent date mention in history when the latest message has no dates.
  if (!preResolvedDates) {
    preResolvedDates = extractDatesFromHistory(uiMessages.slice(0, -1));
  }

  if (preResolvedDates && isStartDateInPast(preResolvedDates.startDate, session.timeZone)) {
    const today = getTodayIsoDate(session.timeZone);
    const leaveType = extractLeaveType(latestUserText) ?? "annual";
    const errorText =
      `The dates you provided (${preResolvedDates.startDate} to ${preResolvedDates.endDate}) are in the past and are not valid for a new time-off request. Today is ${today}. Please select new dates.`;

    const msgId = `past-date-${runId}`;
    observer.next({ type: EventType.TEXT_MESSAGE_START, messageId: msgId, role: "assistant" });
    observer.next({ type: EventType.TEXT_MESSAGE_CONTENT, messageId: msgId, delta: errorText });
    observer.next({ type: EventType.TEXT_MESSAGE_END, messageId: msgId });
    emitState(observer, { phase: "awaiting_dates", specialist: "employee", collectDateRangeLeaveType: leaveType });
    return;
  }

  emitState(observer, { phase: "executing", specialist: "employee" });

  // Pre-verify server-side when all required fields are available so the model skips
  // the verify step and goes straight to submit.
  const extractedCtx = extractLeaveContextFromHistory(uiMessages);
  let preVerified: { leaveType: string; startDate: string; endDate: string; reason: string } | undefined;

  if (preResolvedDates && extractedCtx?.leaveType && extractedCtx.reason) {
    try {
      const verifyResult = await submitMyTimeOffRequest(session, {
        leaveType: extractedCtx.leaveType,
        startDate: preResolvedDates.startDate,
        endDate: preResolvedDates.endDate,
        reason: extractedCtx.reason,
        dryRun: true,
      });
      if (verifyResult.ok) {
        preVerified = {
          leaveType: extractedCtx.leaveType,
          startDate: preResolvedDates.startDate,
          endDate: preResolvedDates.endDate,
          reason: extractedCtx.reason,
        };
      } else if ((verifyResult as { code?: string }).code === "PAST_DATE") {
        const msgId = `verify-pd-${runId}`;
        observer.next({ type: EventType.TEXT_MESSAGE_START, messageId: msgId, role: "assistant" });
        observer.next({ type: EventType.TEXT_MESSAGE_CONTENT, messageId: msgId, delta: (verifyResult as { message: string }).message });
        observer.next({ type: EventType.TEXT_MESSAGE_END, messageId: msgId });
        emitState(observer, { phase: "awaiting_dates", specialist: "employee", collectDateRangeLeaveType: extractedCtx.leaveType });
        return;
      }
    } catch { /* proceed without pre-verify */ }
  }

  // Bypass the model entirely when all fields are pre-verified — emit the interrupt directly.
  // This avoids Ollama generating conversational text instead of a tool call.
  if (preVerified) {
    const pendingTool: PendingToolCall = {
      name: "submit_my_time_off_request",
      args: {
        leaveType: preVerified.leaveType,
        startDate: preVerified.startDate,
        endDate: preVerified.endDate,
        reason: preVerified.reason,
      },
      specialist: "employee",
      label: "Submit time-off request",
    };
    emitState(observer, { phase: "awaiting_confirmation", specialist: "employee", pendingTool });
    observer.next({
      type: EventType.CUSTOM,
      name: "on_interrupt",
      value: { toolName: pendingTool.name, args: pendingTool.args, label: pendingTool.label },
    } as CustomEvent);
    return;
  }

  let capturedText = "";
  let collectDateRangeCalled = false;

  const baseEmployeePrompt = buildEmployeeConversationPrompt(session, preResolvedDates, extractedCtx);

  await streamSpecialistEvents(observer, {
    runId,
    model,
    uiMessages,
    baseSystemPrompt: additionalInstructions
      ? `${baseEmployeePrompt}\n\n${additionalInstructions}`
      : baseEmployeePrompt,
    tools: resolveAgentTools("employee", session, {}, model),
    onTextDelta: (delta) => { capturedText += delta; },
    onFrontendTool: (toolName) => { if (toolName === "collect_date_range") collectDateRangeCalled = true; },
    onInterrupt: ({ name, args, label }) => {
      emitState(observer, {
        phase: "awaiting_confirmation",
        specialist: "employee",
        pendingTool: { name, args, specialist: "employee", label },
      });
      observer.next({
        type: EventType.CUSTOM,
        name: "on_interrupt",
        value: { toolName: name, args, label },
      } as CustomEvent);
    },
  });

  // Fallback: if the model described dates in text instead of calling collect_date_range,
  // emit awaiting_dates so the date picker appears automatically.
  if (!collectDateRangeCalled && modelAskedForDatesInText(capturedText)) {
    const leaveType = extractLeaveTypeFromHistory(uiMessages) ?? undefined;
    emitState(observer, { phase: "awaiting_dates", specialist: "employee", collectDateRangeLeaveType: leaveType });
  }
}
