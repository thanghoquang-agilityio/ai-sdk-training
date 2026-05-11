import { tool } from "ai";
import { z } from "zod";
import type { MockAuthSession } from "@/lib/auth/session";
import {
  cancelMyTimeOffRequest,
  submitMyTimeOffRequest,
} from "@/agents/handlers/time-off";
import { EMPLOYEE_TOOL_DESCRIPTION, EMPLOYEE_TOOL_NAME } from "../common/definitions";

const leaveTypeSchema = z
  .enum(["annual", "sick", "personal", "unpaid"])
  .describe(
    "Type of leave. Map vacation/PTO to annual, illness/doctor to sick, personal errand to personal.",
  );

const OPTIONAL_NOTE_SCHEMA = z.preprocess(
  (value) => {
    if (value == null) return undefined;
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  },
  z.string().optional(),
);

/**
 * Creates employee mutation tools.
 * @param {MockAuthSession} session
 */
export function createEmployeeMutationTools(session: MockAuthSession) {
  return {
    [EMPLOYEE_TOOL_NAME.VERIFY_MY_TIME_OFF_REQUEST]: tool({
      description: EMPLOYEE_TOOL_DESCRIPTION.VERIFY_MY_TIME_OFF_REQUEST,
      needsApproval: false,
      inputSchema: z.object({
        leaveType: leaveTypeSchema,
        startDate: z
          .string()
          .trim()
          .min(1)
          .describe("Start date, e.g. 2026-05-02, tomorrow, or next monday."),
        endDate: z
          .string()
          .trim()
          .min(1)
          .describe("End date, e.g. 2026-05-02 or next friday."),
        reason: z.string().trim().min(1).describe("Short reason extracted from the user's message (e.g. 'due to a doctor's appointment' → 'doctor's appointment')."),
        note: OPTIONAL_NOTE_SCHEMA,
      }),
      execute: async ({ leaveType, startDate, endDate, reason, note }) =>
        submitMyTimeOffRequest(session, {
          leaveType,
          startDate,
          endDate,
          reason,
          note,
          dryRun: true,
        }),
    }),

    [EMPLOYEE_TOOL_NAME.SUBMIT_MY_TIME_OFF_REQUEST]: tool({
      description: EMPLOYEE_TOOL_DESCRIPTION.SUBMIT_MY_TIME_OFF_REQUEST,
      needsApproval: false,
      inputSchema: z.object({
        leaveType: leaveTypeSchema,
        startDate: z
          .string()
          .trim()
          .min(1)
          .describe("Start date, e.g. 2026-05-02, tomorrow, or next monday."),
        endDate: z
          .string()
          .trim()
          .min(1)
          .describe("End date, e.g. 2026-05-02 or next friday."),
        reason: z.string().trim().min(1).describe("Short reason extracted from the user's message (e.g. 'due to a doctor's appointment' → 'doctor's appointment')."),
        note: OPTIONAL_NOTE_SCHEMA,
      }),
      execute: async ({ leaveType, startDate, endDate, reason, note }) =>
        submitMyTimeOffRequest(session, {
          leaveType,
          startDate,
          endDate,
          reason,
          note,
          dryRun: false,
        }),
    }),

    [EMPLOYEE_TOOL_NAME.CANCEL_MY_TIME_OFF_REQUEST]: tool({
      description: EMPLOYEE_TOOL_DESCRIPTION.CANCEL_MY_TIME_OFF_REQUEST,
      needsApproval: false,
      inputSchema: z.object({
        requestQuery: z
          .string()
          .trim()
          .min(1)
          .describe(
            "Human description of the request to cancel, such as latest pending request or annual leave on 2026-06-15.",
          ),
      }),
      execute: async ({ requestQuery }) =>
        cancelMyTimeOffRequest(session, { requestQuery }),
    }),
  };
}
