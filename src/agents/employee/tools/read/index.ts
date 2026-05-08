import { tool, type LanguageModel } from "ai";
import { z } from "zod";
import type { MockAuthSession } from "@/lib/auth/session";
import {
  getMyTimeOffBalance,
  listMyTimeOffRequests,
} from "@/agents/handlers/time-off";
import { createDateResolutionTool } from "@/agents/specialists/date/tools/read/resolution";
import { createCollectDateRangeTool } from "@/agents/specialists/date/tools/read/collect";
import { EMPLOYEE_TOOL_DESCRIPTION, EMPLOYEE_TOOL_NAME } from "../common/definitions";

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
    ...createCollectDateRangeTool(),
  };
}
