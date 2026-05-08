import type { MockAuthSession } from "@/lib/auth/session";
import { getTodayIsoDate } from "@/agents/handlers/common/date";
import { resolveAgentFlow, resolveRoutingHints, resolveSystemPrompt } from "@/agents/config";

/**
 * Builds employee conversation prompt.
 * @param {MockAuthSession} session
 * @returns {string}
 */
export function buildEmployeeConversationPrompt(session: MockAuthSession): string {
  const systemPrompt = resolveSystemPrompt("employee");
  const today = getTodayIsoDate(session.timeZone);
  return `
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
}
