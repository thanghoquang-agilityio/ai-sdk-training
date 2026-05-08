import { runAgent, type AgentRunInput } from "@/agents/chat-core";
import { buildDateConversationPrompt } from "./prompt/conversation";
import { resolveAgentTools } from "@/agents/config";

/**
 * runDateAgent helper.
 * @param {AgentRunInput} input
 */
export async function runDateAgent(input: AgentRunInput) {
  return runAgent({
    agent: "date",
    input,
    system: buildDateConversationPrompt(input.session),
    tools: resolveAgentTools("date", input.session),
  });
}
