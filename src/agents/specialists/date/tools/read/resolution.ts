import { tool, type LanguageModel } from "ai";
import { z } from "zod";
import type { MockAuthSession } from "@/lib/auth/session";
import { invokeDateAgent } from "@/agents/handlers/common/date-specialist";
import { DATE_AGENT_TOOL_DESCRIPTION, DATE_AGENT_TOOL_NAME } from "../definitions";

/**
 * Creates the date resolution tool.
 * This tool allows an agent to consult the Date Specialist sub-agent.
 */
export function createDateResolutionTool(
  session: MockAuthSession,
  model?: LanguageModel,
) {
  return {
    [DATE_AGENT_TOOL_NAME.CONSULT_DATE_AGENT]: tool({
      description: DATE_AGENT_TOOL_DESCRIPTION[DATE_AGENT_TOOL_NAME.CONSULT_DATE_AGENT],
      inputSchema: z.object({
        query: z.string().describe("The user's date-related query to resolve."),
      }),
      execute: async ({ query }) => {
        if (!model) throw new Error("Language model is required for date agent.");
        return invokeDateAgent(query, session, model);
      },
    }),
  };
}
