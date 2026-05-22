import type { UIMessage } from "ai";
import type { LeaveType } from "@/lib/db/schema";
import type { ExtractedLeaveContext, PreResolvedDates } from "@/agents/employee/prompt/conversation";
import { getTextParts, getLatestUserText } from "@/utils/message";
import { getTodayIsoDate, parseIsoDateToUtcDay, utcDayToIsoDate } from "./date";

export const DATE_MENTION_REGEX =
  /\b(\d{4}-\d{2}-\d{2}|january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|next\s+\w+|\d+\s+days?\s+(from|starting|beginning))/i;

export const LEAVE_TYPE_PATTERNS: Array<[RegExp, LeaveType]> = [
  [/\bsick\b/i, "sick"],
  [/\bannual\b/i, "annual"],
  [/\bpersonal\b/i, "personal"],
  [/\bunpaid\b/i, "unpaid"],
];

const MONTH_NAME_TO_NUMBER: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
  jan: "01", feb: "02", mar: "03", apr: "04", jun: "06", jul: "07",
  aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

export function extractLeaveType(text: string): LeaveType | null {
  for (const [regex, type] of LEAVE_TYPE_PATTERNS) {
    if (regex.test(text)) return type;
  }
  return null;
}

// Parses "Month D, YYYY" or "Month D YYYY" → YYYY-MM-DD
function parseReadableDate(text: string): string | null {
  const m = text.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2}),?\s+(\d{4})\b/i,
  );
  if (!m) return null;
  const mm = MONTH_NAME_TO_NUMBER[m[1].toLowerCase()];
  if (!mm) return null;
  return `${m[3]}-${mm}-${m[2].padStart(2, "0")}`;
}

export function tryExtractIsoDatesDirect(text: string): PreResolvedDates | undefined {
  const isoRange = text.match(/\b(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})\b/);
  if (isoRange) return { startDate: isoRange[1], endDate: isoRange[2] };

  const isoSingle = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoSingle) return { startDate: isoSingle[1], endDate: isoSingle[1] };

  const parts = text.split(/\s+to\s+/i);
  if (parts.length === 2) {
    const s = parseReadableDate(parts[0]);
    const e = parseReadableDate(parts[1]);
    if (s && e) return { startDate: s, endDate: e };
  }

  const single = parseReadableDate(text);
  if (single) return { startDate: single, endDate: single };

  return undefined;
}

const DURATION_REGEX =
  /(\d+)\s+days?\b.{0,20}\b(?:starting|beginning)(?:\s+(?:from|on))?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\b/i;

export function tryExtractDurationDates(text: string): PreResolvedDates | undefined {
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

export function isStartDateInPast(startDate: string, timeZone: string): boolean {
  const startDay = parseIsoDateToUtcDay(startDate);
  const todayDay = parseIsoDateToUtcDay(getTodayIsoDate(timeZone));
  return Number.isFinite(startDay) && Number.isFinite(todayDay) && startDay < todayDay;
}

export function extractDatesFromHistory(messages: UIMessage[]): PreResolvedDates | undefined {
  for (const msg of [...messages].reverse()) {
    if (msg.role !== "user") continue;
    const text = getTextParts(msg).join(" ").trim();
    const dates = tryExtractIsoDatesDirect(text) ?? tryExtractDurationDates(text);
    if (dates) return dates;
  }
  return undefined;
}

export function extractLeaveTypeFromHistory(messages: UIMessage[]): LeaveType | null {
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

const ASKED_FOR_REASON_PATTERNS = [
  /\bdo\s+you\s+have\s+a\s+(?:specific\s+)?reason\b/i,
  /\bprovide\b.{0,30}\breason\b/i,
  /\breason\s+for\s+(this|your)\s+(leave|request)\b/i,
  /\bwhy\b.{0,30}\b(leave|vacation|time.?off|request)\b/i,
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

export function extractLeaveContextFromHistory(messages: UIMessage[]): ExtractedLeaveContext {
  const leaveType = extractLeaveTypeFromHistory(messages) ?? undefined;
  let reason = extractReasonFromHistory(messages) ?? undefined;

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

const DATE_REQUEST_PATTERNS = [
  /\b(provide|enter|specify|select|what)\b.{0,30}\bstart\s+and\s+end\s+date/i,
  /\bprovide\b.{0,18}\b(the\s+)?dates?\b/i,
  /\byyyy-mm-dd\b/i,
  /\bwhen\b.{0,30}\b(leave|vacation|time.?off|day)/i,
  /\bwhich\s+date/i,
  /\bwhat\s+date/i,
  /\bselect\s+(the\s+)?dates?\b/i,
];

const ISO_DATE_IN_RESPONSE = /\b\d{4}-\d{2}-\d{2}\b/;

export function modelAskedForDatesInText(text: string): boolean {
  if (ISO_DATE_IN_RESPONSE.test(text)) return false;
  return DATE_REQUEST_PATTERNS.some((p) => p.test(text));
}
