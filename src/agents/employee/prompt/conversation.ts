import type { MockAuthSession } from "@/lib/auth/session";
import { getTodayIsoDate } from "@/agents/handlers/common/date";
import { resolveAgentFlow, resolveRoutingHints, resolveSystemPrompt } from "@/agents/config";

export type PreResolvedDates = {
  startDate: string;
  endDate: string;
};

/**
 * Builds employee conversation prompt.
 * @param {MockAuthSession} session
 * @param {PreResolvedDates | undefined} preResolvedDates - already resolved YYYY-MM-DD dates from user message
 * @returns {string}
 */
export function buildEmployeeConversationPrompt(
  session: MockAuthSession,
  preResolvedDates?: PreResolvedDates,
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

  if (!preResolvedDates) return base;

  return `${base}

### Pre-resolved dates
The user's message contained date mentions that have already been resolved server-side.
startDate: ${preResolvedDates.startDate}
endDate: ${preResolvedDates.endDate}
Skip step 4 (consult_date_agent). Go directly to step 5: call verify_my_time_off_request with these dates.`;
}
