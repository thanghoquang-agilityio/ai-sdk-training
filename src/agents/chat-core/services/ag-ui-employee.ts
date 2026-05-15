import { EventType, type BaseEvent, type CustomEvent } from "@ag-ui/core";
import type { Observer } from "rxjs";
import type { LanguageModel, UIMessage } from "ai";
import type { MockAuthSession } from "@/lib/auth/session";
import type { LeaveType } from "@/lib/db/schema";
import {
  buildEmployeeConversationPrompt,
  type PreResolvedDates,
  type ExtractedLeaveContext,
  type PreVerifiedSubmit,
} from "@/agents/employee/prompt/conversation";
import { resolveAgentTools } from "@/agents/config";
import { invokeDateAgent } from "@/agents/handlers/common/date-specialist";
import { getTodayIsoDate, parseIsoDateToUtcDay, utcDayToIsoDate } from "@/agents/handlers/common/date";
import { submitMyTimeOffRequest } from "@/agents/handlers/time-off";
import { getTextParts } from "@/utils/message";
import { emitState, type PendingToolCall } from "./ag-ui-types";
import { streamSpecialistEvents } from "./ag-ui-stream";

const DATE_MENTION_REGEX =
  /\b(\d{4}-\d{2}-\d{2}|january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|next\s+\w+|\d+\s+days?\s+(from|starting|beginning))/i;

const LEAVE_TYPE_PATTERNS: Array<[RegExp, LeaveType]> = [
  [/\bsick\b/i, "sick"],
  [/\bannual\b/i, "annual"],
  [/\bpersonal\b/i, "personal"],
  [/\bunpaid\b/i, "unpaid"],
];

function extractLeaveType(text: string): "annual" | "sick" | "personal" | "unpaid" | null {
  for (const [regex, type] of LEAVE_TYPE_PATTERNS) {
    if (regex.test(text)) return type;
  }
  return null;
}

const MONTH_NAME_TO_NUMBER: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
  jan: "01", feb: "02", mar: "03", apr: "04", jun: "06", jul: "07",
  aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

// Parses "Month D, YYYY" or "Month D YYYY" → YYYY-MM-DD, returns null on failure.
function parseReadableDate(text: string): string | null {
  const m = text.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2}),?\s+(\d{4})\b/i);
  if (!m) return null;
  const mm = MONTH_NAME_TO_NUMBER[m[1].toLowerCase()];
  if (!mm) return null;
  const dd = m[2].padStart(2, "0");
  return `${m[3]}-${mm}-${dd}`;
}

function tryExtractIsoDatesDirect(text: string): PreResolvedDates | undefined {
  // ISO range: "2026-05-20 to 2026-05-21"
  const isoRange = text.match(/\b(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})\b/);
  if (isoRange) return { startDate: isoRange[1], endDate: isoRange[2] };
  // ISO single: "2026-05-20"
  const isoSingle = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoSingle) return { startDate: isoSingle[1], endDate: isoSingle[1] };
  // Human-readable range: "May 20, 2026 to June 5, 2026" (two dates with explicit year)
  const parts = text.split(/\s+to\s+/i);
  if (parts.length === 2) {
    const s = parseReadableDate(parts[0]);
    const e = parseReadableDate(parts[1]);
    if (s && e) return { startDate: s, endDate: e };
  }
  // Human-readable single: "May 20, 2026"
  const single = parseReadableDate(text);
  if (single) return { startDate: single, endDate: single };
  return undefined;
}

// Handles "N days starting/beginning from Month DD" patterns server-side.
const DURATION_REGEX =
  /(\d+)\s+days?\b.{0,20}\b(?:starting|beginning)(?:\s+(?:from|on))?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\b/i;

function tryExtractDurationDates(text: string): PreResolvedDates | undefined {
  const m = text.match(DURATION_REGEX);
  if (!m) return undefined;
  const days = parseInt(m[1]);
  const mm = MONTH_NAME_TO_NUMBER[m[2].toLowerCase()];
  if (!mm) return undefined;
  const dd = m[3].padStart(2, "0");
  const year = new Date().getFullYear();
  const startDateStr = `${year}-${mm}-${dd}`;
  const startDay = parseIsoDateToUtcDay(startDateStr);
  if (!Number.isFinite(startDay)) return undefined;
  return { startDate: startDateStr, endDate: utcDayToIsoDate(startDay + days) };
}

function isStartDateInPast(startDate: string, timeZone: string): boolean {
  const startDay = parseIsoDateToUtcDay(startDate);
  const todayDay = parseIsoDateToUtcDay(getTodayIsoDate(timeZone));
  return Number.isFinite(startDay) && Number.isFinite(todayDay) && startDay < todayDay;
}

function getLatestUserText(messages: UIMessage[]): string {
  const latest = [...messages].reverse().find((m) => m.role === "user");
  if (!latest) return "";
  return getTextParts(latest).join(" ").trim();
}

// Scans all user messages in reverse order for the most recent date mention.
// Used as a fallback when the latest message contains no dates (e.g. user just sent a reason).
function extractDatesFromHistory(messages: UIMessage[]): PreResolvedDates | undefined {
  for (const msg of [...messages].reverse()) {
    if (msg.role !== "user") continue;
    const text = getTextParts(msg).join(" ").trim();
    const dates = tryExtractIsoDatesDirect(text) ?? tryExtractDurationDates(text);
    if (dates) return dates;
  }
  return undefined;
}

function extractLeaveTypeFromHistory(messages: UIMessage[]): "annual" | "sick" | "personal" | "unpaid" | null {
  for (const msg of [...messages].reverse()) {
    if (msg.role === "user") {
      const type = extractLeaveType(getTextParts(msg).join(" "));
      if (type) return type;
    } else if (msg.role === "assistant") {
      for (const part of msg.parts) {
        if (part.type === "dynamic-tool") {
          const input = part.input as Record<string, unknown>;
          if (input?.leaveType && typeof input.leaveType === "string") {
            const type = extractLeaveType(input.leaveType);
            if (type) return type;
          }
        }
      }
    }
  }
  return null;
}

const REASON_REGEX = /\b(?:due to|because of|because|for)\s+(.{4,80}?)(?:\.|,|$)/i;
function extractReasonFromHistory(messages: UIMessage[]): string | null {
  for (const msg of [...messages].reverse()) {
    if (msg.role === "user") {
      const text = getTextParts(msg).join(" ");
      const m = text.match(REASON_REGEX);
      if (m) return m[1].trim();
    } else if (msg.role === "assistant") {
      for (const part of msg.parts) {
        if (part.type === "dynamic-tool") {
          const input = part.input as Record<string, unknown>;
          if (input?.reason && typeof input.reason === "string") {
            return input.reason.trim();
          }
        }
      }
    }
  }
  return null;
}

// Patterns that indicate the model's last assistant message asked the user for a reason.
const ASKED_FOR_REASON_PATTERNS = [
  /\bdo\s+you\s+have\s+a\s+(?:specific\s+)?reason\b/i,
  /\bprovide\b.{0,30}\breason\b/i,
  /\breason\s+for\s+(this|your)\s+(leave|request)\b/i,
  /\bwhy\b.{0,30}\b(leave|time.?off|request)\b/i,
  /\bwhat('s|\s+is)\s+(the\s+)?reason\b/i,
  /\bany\s+(additional\s+)?details?\b/i,
];

function lastAssistantAskedForReason(messages: UIMessage[]): boolean {
  for (const msg of [...messages].reverse()) {
    if (msg.role !== "assistant") continue;
    const text = getTextParts(msg).join(" ");
    return ASKED_FOR_REASON_PATTERNS.some((p) => p.test(text));
  }
  return false;
}

function extractLeaveContextFromHistory(messages: UIMessage[]): ExtractedLeaveContext {
  const leaveType = extractLeaveTypeFromHistory(messages) ?? undefined;
  let reason = extractReasonFromHistory(messages) ?? undefined;

  // If no trigger-phrase reason found, check whether the model's last turn asked for a reason.
  // If so, treat the user's latest message as the reason (it's a direct reply to that question).
  if (!reason && lastAssistantAskedForReason(messages)) {
    const latestUserText = getLatestUserText(messages);
    if (
      latestUserText.length >= 2 &&
      latestUserText.length <= 200 &&
      !DATE_MENTION_REGEX.test(latestUserText) &&
      !LEAVE_TYPE_PATTERNS.some(([rx]) => rx.test(latestUserText) && latestUserText.split(/\s+/).length <= 4)
    ) {
      reason = latestUserText;
    }
  }

  return { leaveType, reason };
}

// Detects when the model asked for dates in plain text instead of calling collect_date_range.
const DATE_REQUEST_PATTERNS = [
  // Require a request verb before "start and end date" to avoid false-positive on
  // confirmations like "You have provided the start and end dates as 2026-07-16."
  /\b(provide|enter|specify|select|what)\b.{0,30}\bstart\s+and\s+end\s+date/i,
  /\bprovide\b.{0,40}\bdate/i,
  /\byyyy-mm-dd\b/i,
  /\bwhen\b.{0,30}\b(leave|vacation|time.?off|day)/i,
  /\bwhich\s+date/i,
  /\bwhat\s+date/i,
  /\bselect\s+(the\s+)?dates?\b/i,
];
// ISO date present in the response → model already has the dates, not requesting them.
const ISO_DATE_IN_RESPONSE = /\b\d{4}-\d{2}-\d{2}\b/;
function modelAskedForDatesInText(text: string): boolean {
  if (ISO_DATE_IN_RESPONSE.test(text)) return false;
  return DATE_REQUEST_PATTERNS.some((p) => p.test(text));
}

export async function runEmployeeFlow(
  observer: Observer<BaseEvent>,
  runId: string,
  uiMessages: UIMessage[],
  session: MockAuthSession,
  model: LanguageModel,
): Promise<void> {
  const latestUserText = getLatestUserText(uiMessages);
  let preResolvedDates: PreResolvedDates | undefined;

  const directDates = tryExtractIsoDatesDirect(latestUserText) ?? tryExtractDurationDates(latestUserText);
  if (directDates) {
    preResolvedDates = directDates;
  } else if (DATE_MENTION_REGEX.test(latestUserText)) {
    emitState(observer, { phase: "resolving_dates", specialist: "employee" });
    try {
      const result = await invokeDateAgent(latestUserText, session, model);
      if (!result.isAmbiguous && result.startDate && result.endDate) {
        preResolvedDates = { startDate: result.startDate, endDate: result.endDate };
      }
    } catch { /* proceed without pre-resolved dates */ }
  }

  // If the latest message has no dates (e.g. user just replied with a reason),
  // fall back to the most recent date mention in conversation history.
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

  // When all required fields are available, pre-verify server-side so the model
  // only needs to call submit_my_time_off_request (one step instead of three).
  let preVerified: PreVerifiedSubmit | undefined;
  const extractedCtx = extractLeaveContextFromHistory(uiMessages);
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
        // Reuse the existing past-date path: show error + date picker
        const msgId = `verify-pd-${runId}`;
        observer.next({ type: EventType.TEXT_MESSAGE_START, messageId: msgId, role: "assistant" });
        observer.next({ type: EventType.TEXT_MESSAGE_CONTENT, messageId: msgId, delta: (verifyResult as { message: string }).message });
        observer.next({ type: EventType.TEXT_MESSAGE_END, messageId: msgId });
        emitState(observer, { phase: "awaiting_dates", specialist: "employee", collectDateRangeLeaveType: extractedCtx.leaveType });
        return;
      }
      // Other verify errors fall through — let the model handle them with full context.
    } catch { /* proceed without pre-verify */ }
  }

  // When all fields are verified server-side, bypass the model entirely and emit the
  // interrupt directly. Asking the model to call submit_my_time_off_request is unreliable
  // with Ollama — it generates conversational text ("Would you like me to submit?") instead
  // of the tool call, which means wrapInterruptTools never intercepts it.
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

  await streamSpecialistEvents(observer, {
    runId,
    model,
    uiMessages,
    baseSystemPrompt: buildEmployeeConversationPrompt(session, preResolvedDates, extractedCtx),
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

  // Fallback for models that ask for dates in text instead of calling collect_date_range.
  // If the model's response asked for dates but never called the tool, emit awaiting_dates
  // so the date picker appears automatically.
  if (!collectDateRangeCalled && modelAskedForDatesInText(capturedText)) {
    const leaveType = extractLeaveTypeFromHistory(uiMessages) ?? undefined;
    emitState(observer, { phase: "awaiting_dates", specialist: "employee", collectDateRangeLeaveType: leaveType });
  }
}
