import type { UIMessage } from "ai";
import { runAgent, type AgentRunInput } from "@/agents/chat-core";
import { buildEmployeeConversationPrompt, type PreResolvedDates } from "@/agents/employee/prompt/conversation";
import { resolveAgentTools } from "@/agents/config";
import { invokeDateAgent } from "@/agents/handlers/common/date-specialist";
import { getTodayIsoDate } from "@/agents/handlers/common/date";
import {
  DATE_MENTION_REGEX,
  extractLeaveType,
  isStartDateInPast,
  tryExtractIsoDatesDirect,
} from "@/agents/handlers/common/intent";
import { createPastDateResponse } from "@/agents/chat-core/utils/response";
import { getLatestUserText } from "@/utils/message";

function extractReason(text: string): string | undefined {
  const match = text.match(/\b(?:due to|because of?|for)\b\s+(.+?)(?:[.!?]|$)/i);
  return match?.[1]?.trim() || undefined;
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
