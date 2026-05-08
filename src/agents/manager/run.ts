import { runAgent, type AgentRunInput } from "@/agents/chat-core";
import { buildManagerConversationPrompt } from "@/agents/manager/prompt/conversation";
import { resolveAgentTools } from "@/agents/config";

/**
 * runManagerAgent helper.
 * @param {AgentRunInput} input
 */
export async function runManagerAgent(input: AgentRunInput) {
  return runAgent({
    agent: "manager",
    input,
    system: buildManagerConversationPrompt(input.session),
    tools: resolveAgentTools("manager", input.session, undefined, input.model),
  });
}
