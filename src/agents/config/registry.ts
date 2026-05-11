import type {
  AgentConfigRegistry,
  AgentToolFactoryMap,
  PromptVersion,
  SpecialistAgentName,
} from "./types";

// ─── Prompt version maps ───
import { employeePromptVersions } from "@/agents/employee/prompt";
import { managerPromptVersions } from "@/agents/manager/prompt";
import { datePromptVersions } from "@/agents/specialists/date/prompt";

// ─── Tool factory maps ───
import { employeeToolFactories } from "@/agents/employee/tools";
import { managerToolFactories } from "@/agents/manager/tools";
import { dateToolFactories } from "@/agents/specialists/date/tools";

// ─── Tool Definitions ───
import {
  EMPLOYEE_TOOL_DESCRIPTION,
  EMPLOYEE_TOOL_NAME,
} from "@/agents/employee/tools/common/definitions";
import {
  MANAGER_TOOL_DESCRIPTION,
  MANAGER_TOOL_NAME,
} from "@/agents/manager/tools/common/definitions";
import { DATE_AGENT_TOOL_DESCRIPTION } from "@/agents/specialists/date/tools/definitions";

/* ================================================================
 * AGENT CONFIG — Single source of truth
 * ================================================================ */
export const AGENT_CONFIG: AgentConfigRegistry = {
  employee: {
    promptVersion: "v1",
    tools: {
      read: [
        EMPLOYEE_TOOL_NAME.GET_MY_TIME_OFF_BALANCE,
        EMPLOYEE_TOOL_NAME.LIST_MY_TIME_OFF_REQUESTS,
        EMPLOYEE_TOOL_NAME.CONSULT_DATE_SPECIALIST,
        EMPLOYEE_TOOL_NAME.COLLECT_DATE_RANGE,
        EMPLOYEE_TOOL_NAME.SEARCH_LEAVE_POLICY,
      ],
      mutation: [
        EMPLOYEE_TOOL_NAME.VERIFY_MY_TIME_OFF_REQUEST,
        EMPLOYEE_TOOL_NAME.SUBMIT_MY_TIME_OFF_REQUEST,
        EMPLOYEE_TOOL_NAME.CANCEL_MY_TIME_OFF_REQUEST,
      ],
    },
    flow: [
      "### Leave Request Workflow",
      "",
      "Follow these steps in order for every leave request:",
      "1. If leave type is missing, ask for it.",
      "2. If reason is missing (no 'due to', 'because', or explanation at all), ask for it.",
      `3. If dates/duration are missing entirely, call ${EMPLOYEE_TOOL_NAME.COLLECT_DATE_RANGE}.`,
      `4. If any date or duration is mentioned, call ${EMPLOYEE_TOOL_NAME.CONSULT_DATE_SPECIALIST} with the user's exact text to get YYYY-MM-DD dates.`,
      `5. Call ${EMPLOYEE_TOOL_NAME.VERIFY_MY_TIME_OFF_REQUEST} with the resolved dates, leave type, and reason.`,
      `6. If verify returns ok: true, call ${EMPLOYEE_TOOL_NAME.SUBMIT_MY_TIME_OFF_REQUEST}.`,
      `7. If verify returns code "PAST_DATE", say: "The dates you provided are in the past and are not valid for a new time-off request. Please select new dates." Then call ${EMPLOYEE_TOOL_NAME.COLLECT_DATE_RANGE}.`,
      `8. If verify returns any other error, explain it in one sentence then call ${EMPLOYEE_TOOL_NAME.COLLECT_DATE_RANGE} if dates need correction.`,
      "",
      "### Reference scenarios (read-only — do not replay these as actions)",
      "",
      `Scenario A — past dates: User mentions sick leave on April 30 and May 1 (past). Correct sequence: (1) ${EMPLOYEE_TOOL_NAME.CONSULT_DATE_SPECIALIST} resolves to 2026-04-30/2026-05-01, (2) ${EMPLOYEE_TOOL_NAME.VERIFY_MY_TIME_OFF_REQUEST} returns PAST_DATE, (3) reply with the past-date message, (4) call ${EMPLOYEE_TOOL_NAME.COLLECT_DATE_RANGE} once and stop.`,
      `Scenario B — duration: User says "2 days of annual leave starting from September 15, personal matters". Correct sequence: (1) ${EMPLOYEE_TOOL_NAME.CONSULT_DATE_SPECIALIST} resolves to 2026-09-15/2026-09-16, (2) ${EMPLOYEE_TOOL_NAME.VERIFY_MY_TIME_OFF_REQUEST} returns ok:true, (3) call ${EMPLOYEE_TOOL_NAME.SUBMIT_MY_TIME_OFF_REQUEST}.`,
      `Scenario C — no dates: User says "I want annual leave for a vacation" with no date mentioned. Correct sequence: (1) call ${EMPLOYEE_TOOL_NAME.COLLECT_DATE_RANGE} once and stop.`,
      "",
      "### Leave Policy Questions",
      "",
      `For questions about rules, entitlements, notice periods, carryover limits, medical certificate requirements, or any "how does X work" policy question — call ${EMPLOYEE_TOOL_NAME.SEARCH_LEAVE_POLICY} first, then answer using the returned sections. Do NOT use this tool for actual leave records or balances.`,
    ],
    label: "Employee Assistant",
  },
  manager: {
    promptVersion: "v1",
    tools: {
      read: [
        MANAGER_TOOL_NAME.LIST_EMPLOYEES,
        MANAGER_TOOL_NAME.LIST_TEAM_MEMBERS,
        MANAGER_TOOL_NAME.LIST_TEAM_TIME_OFF_REQUESTS,
        MANAGER_TOOL_NAME.CONSULT_DATE_SPECIALIST,
        MANAGER_TOOL_NAME.SEARCH_LEAVE_POLICY,
      ],
      mutation: [
        MANAGER_TOOL_NAME.APPROVE_TEAM_TIME_OFF_REQUEST,
        MANAGER_TOOL_NAME.REJECT_TEAM_TIME_OFF_REQUEST,
      ],
    },
    flow: [
      "1. Tool-first: call the relevant tool before writing any response that involves team data.",
      "2. Read-first by default: prefer reviewing pending team requests first unless the target is already explicit.",
      `3. Rejection reason: if missing, ask for one short reason before calling ${MANAGER_TOOL_NAME.REJECT_TEAM_TIME_OFF_REQUEST}.`,
      "4. After successful mutation (approve, reject): do NOT restate the approval/rejection. Go straight to showing remaining pending requests.",
      `5. For questions about leave rules, entitlements, notice periods, or policy — call ${MANAGER_TOOL_NAME.SEARCH_LEAVE_POLICY} first. Do NOT use this for actual leave records.`,
    ],
    label: "Manager Assistant",
  },
  date: {
    promptVersion: "v1",
    tools: {
      read: [EMPLOYEE_TOOL_NAME.COLLECT_DATE_RANGE],
    },
    label: "Date Specialist",
  },
};

/* ================================================================
 * Internal lookup tables
 * ================================================================ */
export const PROMPT_VERSIONS: Record<
  SpecialistAgentName,
  Record<PromptVersion, string>
> = {
  employee: employeePromptVersions,
  manager: managerPromptVersions,
  date: datePromptVersions,
};

export const TOOL_FACTORIES: Record<SpecialistAgentName, AgentToolFactoryMap> =
  {
    employee: employeeToolFactories,
    manager: managerToolFactories,
    date: dateToolFactories,
  };

export const DESCRIPTIONS: Record<string, string> = {
  ...EMPLOYEE_TOOL_DESCRIPTION,
  ...MANAGER_TOOL_DESCRIPTION,
  ...DATE_AGENT_TOOL_DESCRIPTION,
};
