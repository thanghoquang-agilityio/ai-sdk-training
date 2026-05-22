import type { MockAuthSession } from "@/lib/auth/session";
import type { LeaveType } from "@/lib/db/schema";
import { getTodayIsoDate } from "@/agents/memory/date";
import {
  resolveAgentFlow,
  resolveRoutingHints,
  resolveSystemPrompt,
} from "@/agents/config";

export type PreResolvedDates = {
  startDate: string;
  endDate: string;
};

export type ExtractedLeaveContext = {
  leaveType?: LeaveType;
  reason?: string;
};

export type PreVerifiedSubmit = {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
};

/**
 * Builds employee conversation prompt.
 * @param {MockAuthSession} session
 * @param {PreResolvedDates | undefined} preResolvedDates - already resolved YYYY-MM-DD dates from user message
 * @param {ExtractedLeaveContext | undefined} extractedContext - leave type and reason extracted from conversation history
 * @param {PreVerifiedSubmit | undefined} preVerified - when server-side verify already passed; model only needs to call submit
 * @returns {string}
 */
export function buildEmployeeConversationPrompt(
  session: MockAuthSession,
  preResolvedDates?: PreResolvedDates,
  extractedContext?: ExtractedLeaveContext,
  preVerified?: PreVerifiedSubmit,
): string {
  const systemPrompt = resolveSystemPrompt("employee");
  const today = getTodayIsoDate(session.timeZone);
  const base = `
${systemPrompt}

${resolveAgentFlow("employee")}

${resolveRoutingHints("employee")}

Today's date: ${today}
Current access role: ${session.roleLabel}
Current user:
- name: ${session.name}
- employeeId: ${session.employeeId}
- email: ${session.email}
- team: ${session.team}
- manager: ${session.manager}
- timezone: ${session.timeZone}
`.trim();

  // When server-side verify already passed — model only needs to call submit.
  // IMPORTANT: do NOT reference conversation history or a synthetic verify message here.
  // The args are provided explicitly so the model calls submit_my_time_off_request via
  // the normal tool-calling path (which wrapInterruptTools can intercept for HITL).
  if (preVerified) {
    return `${base}

### Pre-verification complete — submit immediately
Server-side validation has already confirmed this request is valid:
- leaveType: ${preVerified.leaveType}
- startDate: ${preVerified.startDate}
- endDate: ${preVerified.endDate}
- reason: ${preVerified.reason}

Your ONLY action: call submit_my_time_off_request with these exact values.
Do NOT write any text before the tool call. Do NOT call verify_my_time_off_request again. Just call submit_my_time_off_request immediately.`;
  }

  // No dates yet but some context is known — tell the model what's already collected so it
  // doesn't re-ask, and direct it to call collect_date_range for the missing dates.
  if (
    !preResolvedDates &&
    (extractedContext?.leaveType || extractedContext?.reason)
  ) {
    const knownParts: string[] = [];
    if (extractedContext.leaveType)
      knownParts.push(`leaveType: ${extractedContext.leaveType}`);
    if (extractedContext.reason)
      knownParts.push(`reason: ${extractedContext.reason}`);
    return `${base}

### Context already collected — dates still needed
The following has already been provided in this conversation:
${knownParts.join("\n")}
Do NOT ask for these again. Your ONLY next action is to call collect_date_range immediately to collect the missing dates.`;
  }

  if (!preResolvedDates) return base;

  const knownLines: string[] = [];
  if (extractedContext?.leaveType)
    knownLines.push(`leaveType: ${extractedContext?.leaveType}`);
  if (extractedContext?.reason)
    knownLines.push(`reason: ${extractedContext?.reason}`);
  knownLines.push(`startDate: ${preResolvedDates.startDate}`);
  knownLines.push(`endDate: ${preResolvedDates.endDate}`);

  const knownBlock = knownLines.join("\n");

  if (!extractedContext?.leaveType || !extractedContext?.reason) {
    const missingFields: string[] = [];
    if (!extractedContext?.leaveType) missingFields.push("leave type");
    if (!extractedContext?.reason) missingFields.push("reason");

    return `${base}

### Missing Context
${knownBlock}

[SYSTEM_INSTRUCTION]
Ask the user for the ${missingFields.join(" and ")}.
Do NOT call any tools. Do NOT recap or summarize known fields.`;
  }

  return `${base}

### Context Complete
${knownBlock}

[SYSTEM_INSTRUCTION]
Call verify_my_time_off_request immediately with the values above.
Do NOT call any tools or recap dates. Stop after tool call.`;
}
