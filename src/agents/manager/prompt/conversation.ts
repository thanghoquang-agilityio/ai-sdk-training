import type { MockAuthSession } from "@/lib/auth/session";
import { resolveAgentFlow, resolveRoutingHints, resolveSystemPrompt } from "@/agents/config";

/**
 * Builds manager conversation prompt.
 * @param {MockAuthSession} session
 * @returns {string}
 */
export function buildManagerConversationPrompt(
  session: MockAuthSession,
): string {
  const systemPrompt = resolveSystemPrompt("manager");
  const managedEmployees = session.managedEmployees
    .map((e) => `- ${e.name} (${e.employeeId}, ${e.team})`)
    .join("\n");

  return `
${systemPrompt}

${resolveAgentFlow("manager")}

${resolveRoutingHints("manager")}

Current manager:
- name: ${session.name}
- employeeId: ${session.employeeId}
- email: ${session.email}
- team: ${session.team}

Direct reports:
${managedEmployees || "- none"}
`.trim();
}
