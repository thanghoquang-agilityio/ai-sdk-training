import type { MockAuthSession } from "@/lib/auth/session";
import { getTodayIsoDate } from "@/agents/handlers/common/date";
import { resolveRoutingHints, resolveSystemPrompt } from "@/agents/config";

/**
 * Builds date conversation prompt.
 * @param {MockAuthSession} session
 * @returns {string}
 */
export function buildDateConversationPrompt(session: MockAuthSession): string {
  const systemPrompt = resolveSystemPrompt("date");
  const today = getTodayIsoDate(session.timeZone);

  return `
${systemPrompt}

${resolveRoutingHints("date")}

Today's date: ${today}
Timezone: ${session.timeZone}
Current user: ${session.name}
`.trim();
}
