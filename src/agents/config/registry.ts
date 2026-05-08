import type {
  AgentConfigRegistry,
  AgentToolFactoryMap,
  PromptVersion,
  SpecialistAgentName,
} from "./types";

// ─── Prompt version maps ───
import { employeePromptVersions } from "@/agents/employee/prompt";
import { managerPromptVersions } from "@/agents/manager/prompt";
import { datePromptVersions } from "@/agents/date/prompt";

// ─── Tool factory maps ───
import { employeeToolFactories } from "@/agents/employee/tools";
import { managerToolFactories } from "@/agents/manager/tools";
import { dateToolFactories } from "@/agents/date/tools";

// ─── Tool Definitions ───
import {
  EMPLOYEE_TOOL_DESCRIPTION,
  EMPLOYEE_TOOL_NAME,
} from "@/agents/employee/tools/common/definitions";
import {
  MANAGER_TOOL_DESCRIPTION,
  MANAGER_TOOL_NAME,
} from "@/agents/manager/tools/common/definitions";
import { DATE_AGENT_TOOL_DESCRIPTION } from "@/agents/date/tools/definitions";

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
      ],
      mutation: [
        EMPLOYEE_TOOL_NAME.SUBMIT_MY_TIME_OFF_REQUEST,
        EMPLOYEE_TOOL_NAME.CANCEL_MY_TIME_OFF_REQUEST,
      ],
    },
    flow: [
      "New leave request — follow EXACTLY in order:",
      `  STEP A: Does the user's message contain ALL of: leave type + explicit date or date range + reason?`,
      `    → YES to all three: call ${EMPLOYEE_TOOL_NAME.SUBMIT_MY_TIME_OFF_REQUEST} immediately. Do NOT call ${EMPLOYEE_TOOL_NAME.COLLECT_DATE_RANGE}. Use YYYY-MM-DD dates only.`,
      `  STEP B: Is the leave type unknown?`,
      `    → ask for leave type in a single short sentence. Do not ask about dates or reason yet.`,
      `  STEP C: Leave type is known but NO explicit dates are provided?`,
      `    → call ${EMPLOYEE_TOOL_NAME.CONSULT_DATE_SPECIALIST} first to get suggestions. Present these suggestions and show the date picker via ${EMPLOYEE_TOOL_NAME.COLLECT_DATE_RANGE}.`,
      `  STEP D: Leave type + dates are present but reason is missing?`,
      `    → ask for reason in a single short sentence.`,
      `5. After ${EMPLOYEE_TOOL_NAME.SUBMIT_MY_TIME_OFF_REQUEST} is called, do not write confirmation text — the UI handles approval.`,
      `6. Cancellation: if leave type + date are specified, call ${EMPLOYEE_TOOL_NAME.CANCEL_MY_TIME_OFF_REQUEST} immediately.`,
      `7. Date Handling: You MUST call ${EMPLOYEE_TOOL_NAME.CONSULT_DATE_SPECIALIST} for relative dates or month+day queries. Do NOT guess dates.`,
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
    ],
    label: "Manager Assistant",
  },
  date: {
    promptVersion: "v1",
    tools: {
      read: ["consult_date_agent"]
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

export const TOOL_FACTORIES: Record<SpecialistAgentName, AgentToolFactoryMap> = {
  employee: employeeToolFactories,
  manager: managerToolFactories,
  date: dateToolFactories,
};

export const DESCRIPTIONS: Record<string, string> = {
  ...EMPLOYEE_TOOL_DESCRIPTION,
  ...MANAGER_TOOL_DESCRIPTION,
  ...DATE_AGENT_TOOL_DESCRIPTION,
};
