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
      ],
      mutation: [
        EMPLOYEE_TOOL_NAME.VERIFY_MY_TIME_OFF_REQUEST,
        EMPLOYEE_TOOL_NAME.SUBMIT_MY_TIME_OFF_REQUEST,
        EMPLOYEE_TOOL_NAME.CANCEL_MY_TIME_OFF_REQUEST,
      ],
    },
    flow: [
      "Global Rules:",
      `  - VALID LEAVE TYPES: "annual", "sick", "personal", "unpaid". If the user mentions "sick leave", it is VALID.`,
      `  - PAST DATES: If the user provides dates in the past (e.g. "April 30" when today is May 8), you MUST explain that dates are in the past AND IMMEDIATELY call ${EMPLOYEE_TOOL_NAME.COLLECT_DATE_RANGE}.`,
      `  - NO TEXT SUGGESTIONS: NEVER suggest dates in text (e.g. "How about next Monday?"). ALWAYS show the date picker tool instead.`,
      `  - NO TEXT CONFIRMATION: NEVER ask "Is this correct?" or "Do you want to proceed?" in text. If you have the info, call the tool IMMEDIATELY.`,
      `  - NEVER validate dates or balances in text. ALWAYS call a tool first.`,
      `  - VERIFY BEFORE SUBMIT: Call ${EMPLOYEE_TOOL_NAME.VERIFY_MY_TIME_OFF_REQUEST} before ${EMPLOYEE_TOOL_NAME.SUBMIT_MY_TIME_OFF_REQUEST}.`,
      `  - NO CONFIRMATION TEXT: Simply call the tool and STOP.`,
      "",
      "Workflow for Leave Requests:",
      `  1. ERROR HANDLING: If dates are missing, invalid (past), or verification fails, IMMEDIATELY call ${EMPLOYEE_TOOL_NAME.COLLECT_DATE_RANGE} to show the picker. NEVER ask for permission.`,
      `  2. PRE-FLIGHT VERIFICATION: Once you have absolute dates (YYYY-MM-DD), call ${EMPLOYEE_TOOL_NAME.VERIFY_MY_TIME_OFF_REQUEST} to check for overlaps and balance.`,
      `    → If ok: true, call ${EMPLOYEE_TOOL_NAME.SUBMIT_MY_TIME_OFF_REQUEST} to show the final "Confirm" UI and save to database.`,
      `    → If ok: false, explain why and IMMEDIATELY show the date picker via ${EMPLOYEE_TOOL_NAME.COLLECT_DATE_RANGE}. STOP.`,
      `  3. MISSING INFO: Ask for leave type or reason if missing before proceeding to verification.`,
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
