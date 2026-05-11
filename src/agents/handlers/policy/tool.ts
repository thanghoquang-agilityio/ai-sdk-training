import { tool } from "ai";
import { z } from "zod";
import { searchPolicy } from "@/lib/rag/policy-index";
import { POLICY_TOOL_NAME, POLICY_TOOL_DESCRIPTION } from "./definitions";

/**
 * Creates the search_leave_policy RAG tool.
 * Shared between employee and manager agents.
 * Falls back gracefully if the embedding model is unavailable (e.g. Ollama missing nomic-embed-text).
 */
export function createSearchLeavePolicyTool() {
  return {
    [POLICY_TOOL_NAME.SEARCH_LEAVE_POLICY]: tool({
      description: POLICY_TOOL_DESCRIPTION[POLICY_TOOL_NAME.SEARCH_LEAVE_POLICY],
      inputSchema: z.object({
        query: z
          .string()
          .min(1)
          .describe(
            "The policy topic or question to search for, e.g. 'carryover rules', 'sick leave certificate requirement', 'notice period for annual leave', 'leave during probation'.",
          ),
      }),
      execute: async ({ query }) => {
        try {
          const MIN_SCORE = 0.5;
          const allResults = await searchPolicy(query, 3);
          const results = allResults.filter((r) => r.score >= MIN_SCORE);
          if (results.length === 0) {
            return {
              ok: false,
              message: "No relevant policy sections found for this query.",
            };
          }
          return {
            ok: true,
            results: results.map((r) => ({
              section: r.title,
              content: r.body,
            })),
          };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          return {
            ok: false,
            message: `Policy search unavailable: ${message}`,
          };
        }
      },
    }),
  };
}
