import type { MockAuthSession } from "@/lib/auth/session";
import { MANAGER_AGENT_SYSTEM_PROMPT } from "./system";

/**
 * Builds manager conversation prompt.
 * @param {MockAuthSession} session
 * @returns {string}
 */
export function buildManagerConversationPrompt(
  session: MockAuthSession,
): string {
  const managedEmployees = session.managedEmployees
    .map((e) => `- ${e.name} (${e.employeeId}, ${e.team})`)
    .join("\n");

  return `${MANAGER_AGENT_SYSTEM_PROMPT}

Current manager:
- name: ${session.name}
- employeeId: ${session.employeeId}
- email: ${session.email}
- team: ${session.team}

Direct reports:
${managedEmployees || "- none"}
`.trim();
}
