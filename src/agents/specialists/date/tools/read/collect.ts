import { tool } from "ai";
import { z } from "zod";
import { EMPLOYEE_TOOL_DESCRIPTION, EMPLOYEE_TOOL_NAME } from "@/agents/employee/tools/common/definitions";

export const leaveTypeSchema = z
  .enum(["annual", "sick", "personal", "unpaid"])
  .describe("Type of leave.");

/**
 * Creates the collect_date_range tool.
 * This tool shows a date picker in the UI.
 */
export function createCollectDateRangeTool() {
  return {
    [EMPLOYEE_TOOL_NAME.COLLECT_DATE_RANGE]: tool({
      description:
        EMPLOYEE_TOOL_DESCRIPTION.COLLECT_DATE_RANGE +
        " *** FORBIDDEN if the user mentioned ANY date, day, month, or duration in their message — call consult_date_agent instead. *** Use ONLY when zero date information was given, or after a PAST_DATE error. After calling, STOP and wait for user selection.",
      inputSchema: z.object({
        leaveType: leaveTypeSchema,
        reason: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe("Short reason for the leave, if already stated by the user."),
      }),
      execute: async () => ({
        ok: true,
        message:
          "Date picker displayed. Waiting for user to select a date range.",
      }),
    }),
  };
}
