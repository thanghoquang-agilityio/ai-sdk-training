import type { UIMessage } from "ai";
import { runAgent, type AgentRunInput } from "@/agents/chat-core";
import { buildEmployeeConversationPrompt, type PreResolvedDates } from "@/agents/employee/prompt/conversation";
import { resolveAgentTools } from "@/agents/config";
import { invokeDateAgent } from "@/agents/handlers/common/date-specialist";
import { getTodayIsoDate, parseIsoDateToUtcDay } from "@/agents/handlers/common/date";
import { createPastDateResponse } from "@/agents/chat-core/utils/response";
import { getTextParts } from "@/utils/message";

// Matches month names, weekday names, relative terms, duration patterns, and ISO dates.
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

function extractReason(text: string): string | undefined {
  const match = text.match(/\b(?:due to|because of?|for)\b\s+(.+?)(?:[.!?]|$)/i);
  return match?.[1]?.trim() || undefined;
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

// Directly extract ISO dates without calling the LLM — handles date picker output.
// "2026-05-25 to 2026-05-26" → range; "2026-05-25" → single day.
function tryExtractIsoDatesDirect(text: string): PreResolvedDates | undefined {
  const rangeMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})\b/);
  if (rangeMatch) return { startDate: rangeMatch[1], endDate: rangeMatch[2] };
  const singleMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (singleMatch) return { startDate: singleMatch[1], endDate: singleMatch[1] };
  return undefined;
}

async function tryResolveDates(
  userText: string,
  input: AgentRunInput,
): Promise<PreResolvedDates | undefined> {
  // Fast path: already ISO dates (e.g. from the date range picker) — no LLM needed.
  const direct = tryExtractIsoDatesDirect(userText);
  if (direct) return direct;

  if (!DATE_MENTION_REGEX.test(userText)) return undefined;
  try {
    const result = await invokeDateAgent(userText, input.session, input.model);
    if (!result.isAmbiguous && result.startDate && result.endDate) {
      return { startDate: result.startDate, endDate: result.endDate };
    }
  } catch {
    // silently skip — proceed without pre-resolved dates
  }
  return undefined;
}

/**
 * Runs the employee agent, pre-resolving any date mentions in the latest user message
 * so the employee agent can go directly to verify_my_time_off_request.
 *
 * If the pre-resolved dates are in the past, short-circuits with a synthetic streaming
 * response that emits the PAST_DATE error text and opens the date picker automatically,
 * bypassing the LLM entirely for this scenario.
 */
export async function runEmployeeAgent(input: AgentRunInput) {
  const latestUserText = getLatestUserText(input.messages);
  const preResolvedDates = await tryResolveDates(latestUserText, input);

  if (preResolvedDates && isStartDateInPast(preResolvedDates.startDate, input.session.timeZone)) {
    const today = getTodayIsoDate(input.session.timeZone);
    const errorText =
      `The dates you provided (${preResolvedDates.startDate} to ${preResolvedDates.endDate}) are in the past and are not valid for a new time-off request. Today is ${today}. Please select new dates.`;

    return createPastDateResponse({
      errorText,
      leaveType: extractLeaveType(latestUserText) ?? "annual",
      reason: extractReason(latestUserText),
      agent: "employee",
      accessRole: input.session.role,
      provider: input.provider,
      modelId: input.modelId,
    });
  }

  return runAgent({
    agent: "employee",
    input,
    system: buildEmployeeConversationPrompt(input.session, preResolvedDates),
    tools: resolveAgentTools("employee", input.session, {}, input.model),
  });
}
