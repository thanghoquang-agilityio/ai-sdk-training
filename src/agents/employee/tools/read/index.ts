import { tool, type LanguageModel } from "ai";
import { z } from "zod";
import type { MockAuthSession } from "@/lib/auth/session";
import {
  getMyTimeOffBalance,
  listMyTimeOffRequests,
} from "@/agents/handlers/time-off";
import { createDateResolutionTool } from "@/agents/date/tools/read/resolution";
import { EMPLOYEE_TOOL_DESCRIPTION, EMPLOYEE_TOOL_NAME } from "../common/definitions";

const leaveTypeSchema = z
  .enum(["annual", "sick", "personal", "unpaid"])
  .describe("Type of leave.");

const OPTIONAL_STATUS_SCHEMA = z
  .enum(["all", "upcoming", "pending", "approved", "cancelled", "rejected"])
  .nullish();

const OPTIONAL_QUERY_SCHEMA = z.string().min(1).nullish();

/**
 * Creates employee read tools.
 * @param {MockAuthSession} session
 * @param {{ skipDatePicker?: boolean }} options
 * @param {LanguageModel} model
 */
export function createEmployeeReadTools(
  session: MockAuthSession,
  options?: { skipDatePicker?: boolean },
  model?: LanguageModel,
) {
  const base = {
    ...createDateResolutionTool(session, model),

    [EMPLOYEE_TOOL_NAME.GET_MY_TIME_OFF_BALANCE]: tool({
      description: EMPLOYEE_TOOL_DESCRIPTION.GET_MY_TIME_OFF_BALANCE,
      inputSchema: z.object({}),
      execute: async () => getMyTimeOffBalance(session),
    }),

    [EMPLOYEE_TOOL_NAME.LIST_MY_TIME_OFF_REQUESTS]: tool({
      description: EMPLOYEE_TOOL_DESCRIPTION.LIST_MY_TIME_OFF_REQUESTS,
      inputSchema: z.object({
        status: OPTIONAL_STATUS_SCHEMA,
        query: OPTIONAL_QUERY_SCHEMA.describe(
          "Optional filter such as annual, pending, family trip, 2026-05-08, or approved.",
        ),
      }),
      execute: async ({ status, query }) =>
        listMyTimeOffRequests(session, { status: status ?? undefined, query: query ?? undefined }),
    }),
  };

  if (options?.skipDatePicker) {
    return base;
  }

  return {
    ...base,
    [EMPLOYEE_TOOL_NAME.COLLECT_DATE_RANGE]: tool({
      description: EMPLOYEE_TOOL_DESCRIPTION.COLLECT_DATE_RANGE,
      inputSchema: z.object({
        leaveType: leaveTypeSchema,
        reason: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe("Short reason for the leave, if already stated by the user."),
      }),
      execute: async () => ({ ok: true }),
    }),
  };
}
