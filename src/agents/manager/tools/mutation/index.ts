import { tool } from "ai";
import { z } from "zod";
import type { MockAuthSession } from "@/lib/auth/session";
import {
  approveTeamTimeOffRequest,
  rejectTeamTimeOffRequest,
} from "@/agents/handlers/time-off";
import { MANAGER_TOOL_DESCRIPTION, MANAGER_TOOL_NAME } from "../common/definitions";

const OPTIONAL_COMMENT_SCHEMA = z.string().nullish();

/**
 * Creates manager mutation tools.
 * @param {MockAuthSession} session
 */
export function createManagerMutationTools(session: MockAuthSession) {
  return {
    [MANAGER_TOOL_NAME.APPROVE_TEAM_TIME_OFF_REQUEST]: tool({
      description: MANAGER_TOOL_DESCRIPTION.APPROVE_TEAM_TIME_OFF_REQUEST,
      needsApproval: true,
      inputSchema: z.object({
        requestQuery: z
          .string()
          .trim()
          .min(1)
          .describe(
            "A team request description such as latest pending request, Mia annual leave on 2026-05-12, or apartment paperwork request.",
          ),
        comment: OPTIONAL_COMMENT_SCHEMA,
        showTeamPending: z
          .boolean()
          .optional()
          .describe(
            "Set to true if the context is the team pending queue. Set to false if focusing on a specific member's history.",
          ),
      }),
      execute: async ({ requestQuery, comment, showTeamPending }) =>
        approveTeamTimeOffRequest(session, {
          requestQuery,
          comment: comment ?? undefined,
          showTeamPending,
        }),
    }),

    [MANAGER_TOOL_NAME.REJECT_TEAM_TIME_OFF_REQUEST]: tool({
      description: MANAGER_TOOL_DESCRIPTION.REJECT_TEAM_TIME_OFF_REQUEST,
      needsApproval: true,
      inputSchema: z.object({
        requestQuery: z
          .string()
          .trim()
          .min(1)
          .describe(
            "A team request description such as latest pending request, An personal leave on 2026-04-24, or paperwork request.",
          ),
        comment: z
          .string()
          .trim()
          .min(1)
          .describe("Short reason for the rejection."),
        showTeamPending: z
          .boolean()
          .optional()
          .describe(
            "Set to true if the context is the team pending queue. Set to false if focusing on a specific member's history.",
          ),
      }),
      execute: async ({ requestQuery, comment, showTeamPending }) =>
        rejectTeamTimeOffRequest(session, {
          requestQuery,
          comment,
          showTeamPending,
        }),
    }),
  };
}
