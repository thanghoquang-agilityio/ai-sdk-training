import { runAgent, type AgentRunInput } from "@/agents/chat-core";
import { buildEmployeeConversationPrompt } from "@/agents/employee/prompt/conversation";
import { resolveAgentTools } from "@/agents/config";

/**
 * runEmployeeAgent helper.
 * @param {AgentRunInput} input
 */
export async function runEmployeeAgent(input: AgentRunInput) {
  return runAgent({
    agent: "employee",
    input,
    system: buildEmployeeConversationPrompt(input.session),
    tools: resolveAgentTools("employee", input.session, {}, input.model),
  });
}
