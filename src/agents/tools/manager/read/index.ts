import { tool, type LanguageModel } from "ai";
import { z } from "zod";
import type { MockAuthSession } from "@/lib/auth/session";
import { listAllEmployees, listTeamMembers, listTeamTimeOffRequests } from "@/agents/handlers/time-off";
import { createDateResolutionTool } from "@/agents/tools/date/read/resolution";
import { createSearchLeavePolicyTool } from "@/agents/handlers/policy/tool";
import { MANAGER_TOOL_DESCRIPTION, MANAGER_TOOL_NAME } from "../common/definitions";

const OPTIONAL_STATUS_SCHEMA = z
  .enum(["all", "upcoming", "pending", "approved", "cancelled", "rejected"])
  .nullish();

const OPTIONAL_EMPLOYEE_QUERY_SCHEMA = z.string().min(1).nullish();

/**
 * Creates manager read tools.
 * @param {MockAuthSession} session
 * @param {LanguageModel} model
 */
export function createManagerReadTools(session: MockAuthSession, model?: LanguageModel) {
  return {
    ...createDateResolutionTool(session, model),
    ...createSearchLeavePolicyTool(),

    [MANAGER_TOOL_NAME.LIST_EMPLOYEES]: tool({
      description: MANAGER_TOOL_DESCRIPTION.LIST_EMPLOYEES,
      inputSchema: z.object({}),
      execute: async () => listAllEmployees(session),
    }),
    [MANAGER_TOOL_NAME.LIST_TEAM_MEMBERS]: tool({
      description: MANAGER_TOOL_DESCRIPTION.LIST_TEAM_MEMBERS,
      inputSchema: z.object({}),
      execute: async () => listTeamMembers(session),
    }),
    [MANAGER_TOOL_NAME.LIST_TEAM_TIME_OFF_REQUESTS]: tool({
      description: MANAGER_TOOL_DESCRIPTION.LIST_TEAM_TIME_OFF_REQUESTS,
      inputSchema: z.object({
        status: OPTIONAL_STATUS_SCHEMA.describe(
          "Filter by request status. Use 'pending' for approval queue, 'all' for everything, 'upcoming' for future approved leave. Omit when no status filter is needed.",
        ),
        employeeQuery: OPTIONAL_EMPLOYEE_QUERY_SCHEMA.describe(
          "A specific employee name to filter by (e.g. 'An Pham', 'Thang'). Only set this when the user explicitly names an individual employee. Leave unset for all-team queries.",
        ),
      }),
      execute: async ({ status, employeeQuery }) =>
        listTeamTimeOffRequests(session, { status: status ?? undefined, employeeQuery: employeeQuery ?? undefined }),
    }),
  };
}
