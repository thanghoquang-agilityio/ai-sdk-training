import { EventType, type BaseEvent } from "@ag-ui/core";
import type { Observer } from "rxjs";
import type { UIMessage } from "ai";
import { buildEmployeeConversationPrompt } from "@/agents/employee/prompt/conversation";
import { resolveAgentTools } from "@/agents/config";
import { invokeDateAgent } from "@/agents/handlers/common/date-specialist";
import { getTodayIsoDate } from "@/agents/handlers/common/date";
import { getMyTimeOffBalance, listMyTimeOffRequests, submitMyTimeOffRequest } from "@/agents/handlers/time-off";
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
import { emitState, emitInterrupt, type PendingToolCall, type AgentRunContext } from "./ag-ui-types";
import { streamSpecialistEvents } from "./ag-ui-stream";

const BALANCE_INTENT_REGEX =
  /\b(balance|remaining|days?\s+(left|remaining)|how\s+many|leave\s+allowance|entitlement)\b/i;
const LIST_REQUESTS_INTENT_REGEX =
  /\b(list\s+(?:all\s+)?my|show\s+(?:all\s+)?my|view\s+(?:all\s+)?my|my\s+(?:\S+\s+)?requests?)\b/i;

function buildBalanceSummaryText(result: unknown): string {
  const r = result as { balances?: Array<{ leaveType: string; remaining: number }> };
  if (!r?.balances?.length) return "Here's your leave balance.";
  const parts = r.balances
    .filter((b) => b.leaveType !== "unpaid")
    .map((b) => `${b.remaining} ${b.leaveType}`);
  return `You have ${parts.join(", ")} days remaining.`;
}

async function emitBypassToolCall(
  observer: Observer<BaseEvent>,
  runId: string,
  toolName: string,
  args: Record<string, unknown>,
  result: unknown,
  summaryText: string,
): Promise<void> {
  const msgId = `bypass-${runId}`;
  const tcId = `tc-bypass-${runId}`;
  observer.next({ type: EventType.STEP_STARTED, stepName: `step-${runId}-0` });
  observer.next({ type: EventType.TEXT_MESSAGE_START, messageId: msgId, role: "assistant" });

  // Stream the summary word by word so the UI shows text before the data table renders.
  for (const token of summaryText.split(" ")) {
    observer.next({ type: EventType.TEXT_MESSAGE_CONTENT, messageId: msgId, delta: `${token} ` });
    await new Promise<void>((r) => setTimeout(r, 25));
  }

  observer.next({ type: EventType.TOOL_CALL_START, toolCallId: tcId, toolCallName: toolName, parentMessageId: msgId });
  observer.next({ type: EventType.TOOL_CALL_ARGS, toolCallId: tcId, delta: JSON.stringify(args) });
  observer.next({ type: EventType.TOOL_CALL_END, toolCallId: tcId });
  observer.next({
    type: EventType.TOOL_CALL_RESULT,
    toolCallId: tcId,
    messageId: `result-${tcId}`,
    content: JSON.stringify(result),
  });
  observer.next({ type: EventType.STEP_FINISHED, stepName: `step-${runId}-0` });
  observer.next({ type: EventType.TEXT_MESSAGE_END, messageId: msgId });
}

export async function runEmployeeFlow(
  observer: Observer<BaseEvent>,
  runId: string,
  uiMessages: UIMessage[],
  ctx: AgentRunContext,
): Promise<void> {
  const { session, model, additionalInstructions } = ctx;
  const latestUserText = getLatestUserText(uiMessages);

  // Bypass the model for unambiguous read-only intents — weaker models (Ollama) often
  // generate conversational text instead of calling the tool directly.
  if (BALANCE_INTENT_REGEX.test(latestUserText) && !LIST_REQUESTS_INTENT_REGEX.test(latestUserText)) {
    emitState(observer, { phase: "executing", specialist: "employee" });
    try {
      const result = await getMyTimeOffBalance(session);
      await emitBypassToolCall(observer, runId, "get_my_time_off_balance", {}, result, buildBalanceSummaryText(result));
      return;
    } catch { /* fall through to model */ }
  }

  if (LIST_REQUESTS_INTENT_REGEX.test(latestUserText) && !BALANCE_INTENT_REGEX.test(latestUserText)) {
    emitState(observer, { phase: "executing", specialist: "employee" });
    try {
      const result = await listMyTimeOffRequests(session);
      await emitBypassToolCall(observer, runId, "list_my_time_off_requests", {}, result, "Here are your time-off requests.");
      return;
    } catch { /* fall through to model */ }
  }

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
    emitInterrupt(observer, "employee", {
      name: pendingTool.name,
      args: pendingTool.args,
      label: pendingTool.label,
    });
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
      emitInterrupt(observer, "employee", { name, args, label });
    },
  });

  // Fallback: if the model described dates in text instead of calling collect_date_range,
  // emit awaiting_dates so the date picker appears automatically.
  // Guard: skip for read-only intents (balance / list requests) — weaker models often
  // mention "dates" generically in those responses, which would falsely trigger the picker.
  const isReadOnlyIntent = /\b(balance|remaining|days?\s+(left|remaining)|how\s+many|list\s+(?:all\s+)?my|show\s+(?:all\s+)?my|view\s+(?:all\s+)?my|my\s+(?:\S+\s+)?requests?)\b/i.test(latestUserText);
  if (!collectDateRangeCalled && !isReadOnlyIntent && modelAskedForDatesInText(capturedText)) {
    const leaveType = extractLeaveTypeFromHistory(uiMessages) ?? undefined;
    emitState(observer, { phase: "awaiting_dates", specialist: "employee", collectDateRangeLeaveType: leaveType });
  }
}
