import { EventType, type BaseEvent } from "@ag-ui/core";
import type { Observer } from "rxjs";
import type { LanguageModel, UIMessage } from "ai";
import type { MockAuthSession } from "@/lib/auth/session";
import {
  buildEmployeeConversationPrompt,
  type PreResolvedDates,
} from "@/agents/employee/prompt/conversation";
import { resolveAgentTools } from "@/agents/config";
import { invokeDateAgent } from "@/agents/handlers/common/date-specialist";
import { getTodayIsoDate, parseIsoDateToUtcDay } from "@/agents/handlers/common/date";
import { getTextParts } from "@/utils/message";
import { emitState } from "./ag-ui-types";
import { streamSpecialistEvents } from "./ag-ui-stream";

const DATE_MENTION_REGEX =
  /\b(\d{4}-\d{2}-\d{2}|january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|next\s+\w+|\d+\s+days?\s+(from|starting|beginning))/i;

const LEAVE_TYPE_PATTERNS: Array<[RegExp, "annual" | "sick" | "personal" | "unpaid"]> = [
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

function tryExtractIsoDatesDirect(text: string): PreResolvedDates | undefined {
  const rangeMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})\b/);
  if (rangeMatch) return { startDate: rangeMatch[1], endDate: rangeMatch[2] };
  const singleMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (singleMatch) return { startDate: singleMatch[1], endDate: singleMatch[1] };
  return undefined;
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

export async function runEmployeeFlow(
  observer: Observer<BaseEvent>,
  runId: string,
  uiMessages: UIMessage[],
  session: MockAuthSession,
  model: LanguageModel,
): Promise<void> {
  const latestUserText = getLatestUserText(uiMessages);
  let preResolvedDates: PreResolvedDates | undefined;

  const directDates = tryExtractIsoDatesDirect(latestUserText);
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

  await streamSpecialistEvents(observer, {
    runId,
    model,
    uiMessages,
    baseSystemPrompt: buildEmployeeConversationPrompt(session, preResolvedDates),
    tools: resolveAgentTools("employee", session, {}, model),
    onCollectDateRange: (leaveType) => {
      emitState(observer, { phase: "awaiting_dates", specialist: "employee", collectDateRangeLeaveType: leaveType });
    },
  });
}
