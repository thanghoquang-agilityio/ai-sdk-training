import type { UIMessage } from "ai";
import { runAgent, type AgentRunInput } from "@/agents/chat-core";
import { buildEmployeeConversationPrompt } from "@/agents/employee/prompt/conversation";
import { createEmployeeTools } from "@/agents/employee/tools";

// Matches ISO dates, "Month Day" patterns, and common relative date phrases.
const DATE_HINT_REGEX =
  /\b(\d{4}-\d{2}-\d{2}|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}|tomorrow|next\s+(?:monday|tuesday|wednesday|thursday|friday|week)|this\s+(?:monday|tuesday|wednesday|thursday|friday|week))\b/i;

function latestUserText(messages: UIMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === "user");
  if (!last) return "";
  return last.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join(" ");
}

/**
 * runEmployeeAgent helper.
 * @param {AgentRunInput} input
 */
export async function runEmployeeAgent(input: AgentRunInput) {
  const userText = latestUserText(input.messages);
  const skipDatePicker = DATE_HINT_REGEX.test(userText);

  return runAgent({
    agent: "employee",
    input,
    system: buildEmployeeConversationPrompt(input.session),
    tools: createEmployeeTools(input.session, { skipDatePicker }),
  });
}
