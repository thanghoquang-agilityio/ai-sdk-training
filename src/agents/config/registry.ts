import type {
  AgentConfigRegistry,
  AgentToolFactoryMap,
  PromptVersion,
  SpecialistAgentName,
} from "./types";

// ─── Prompt version maps ───
import { employeePromptVersions } from "@/agents/context/employee";
import { managerPromptVersions } from "@/agents/context/manager";
import { datePromptVersions } from "@/agents/context/date";

// ─── Tool factory maps ───
import { employeeToolFactories } from "@/agents/tools/employee";
import { managerToolFactories } from "@/agents/tools/manager";
import { dateToolFactories } from "@/agents/tools/date";

// ─── Tool Definitions ───
import {
  EMPLOYEE_TOOL_DESCRIPTION,
  EMPLOYEE_TOOL_NAME,
} from "@/agents/tools/employee/common/definitions";
import {
  MANAGER_TOOL_DESCRIPTION,
  MANAGER_TOOL_NAME,
} from "@/agents/tools/manager/common/definitions";
import { DATE_AGENT_TOOL_DESCRIPTION } from "@/agents/tools/date/definitions";

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
      "### Read Operations",
      "",
      `RULE: If the user asks about their balance, remaining days, how many days they have left, or their leave allowance → call ${EMPLOYEE_TOOL_NAME.GET_MY_TIME_OFF_BALANCE} ONCE with NO text before it. Do NOT ask the user — you already have their information. After the tool returns, write 1 short sentence then STOP. Do NOT call it again.`,
      `RULE: If the user asks to list, view, or show their requests (pending, upcoming, history, all) → call ${EMPLOYEE_TOOL_NAME.LIST_MY_TIME_OFF_REQUESTS} ONCE with NO text before it. After the tool returns, write 1 short sentence then STOP.`,
      "FORBIDDEN for all read operations: writing any greeting, introduction, or explanation before calling the tool. FORBIDDEN: calling the same read tool more than once per turn.",
      "",
      "### Leave Policy Questions",
      "",
      `RULE: If the user asks about or mentions policy (e.g., "leave policy question", "how does carryover work", "what is the notice period") — ALWAYS call ${EMPLOYEE_TOOL_NAME.SEARCH_LEAVE_POLICY} FIRST. If the user's message is too vague to form a search query (e.g., just "leave policy question"), ask exactly one clarifying question: "What would you like to know about leave policy?" Do NOT refuse or apply the scope rejection. Never answer policy questions from memory or training data.`,
      `FORBIDDEN: Telling the user to "ask your manager" for a policy question. You have ${EMPLOYEE_TOOL_NAME.SEARCH_LEAVE_POLICY} — use it.`,
      `Example: User asks "How many days can I carry over?" → call ${EMPLOYEE_TOOL_NAME.SEARCH_LEAVE_POLICY} with query "carryover rules" → reply using the returned policy sections.`,
      "",
      "### Leave Request Workflow",
      "",
      "FORBIDDEN at all times: mentioning any date format to the user. Never write 'YYYY-MM-DD', never write 'date picker if it appears', never write 'use the format', never write 'select them using'. The date picker appears automatically — you do not need to tell the user about it.",
      "FORBIDDEN at all times: recapping or displaying a summary of what the user already said (leave type, dates, reason). Never show bullet-point summaries of known fields. Never say 'Let me verify...' or 'Here is what we have so far'. Ask only for what is missing — nothing else.",
      "FORBIDDEN when asking for the reason: do NOT proactively say 'For example, ...', 'such as ...', or suggest example phrases. Just ask the question. This rule applies to reason only — if the user asks what options mean for any other field, answer them.",
      "",
      "Follow these steps in order for every leave request:",
      "1. If leave type is missing, ask: 'What type of leave do you want to submit?' If the user responds with confusion or asks for help (e.g., 'I don't know', 'give me examples', 'what types are there?', 'what options do I have?'), reply with: 'There are four types: annual (vacation or planned time off), sick (illness or medical appointments), personal (personal matters), unpaid (no paid leave remaining). Which applies to you?' Do NOT apply the no-examples rule here — this is a reactive clarification, not a proactive suggestion.",
      `2. If dates/duration are missing entirely, CALL ${EMPLOYEE_TOOL_NAME.COLLECT_DATE_RANGE} IMMEDIATELY with NO text before it. Do NOT write any message. Do NOT say "please provide dates", "use YYYY-MM-DD", "select them using the date picker", or anything about dates. Just call the tool silently.`,
      "3. If reason is missing (no 'due to', 'because', or explanation at all), ask for it in ONE short question only. Do NOT provide examples of what they could say. Do NOT recap dates. Do NOT list known fields. Example: 'Could you please provide the reason for your leave?'",
      `4. If any date or duration is mentioned, call ${EMPLOYEE_TOOL_NAME.CONSULT_DATE_SPECIALIST} with the user's exact text to get YYYY-MM-DD dates.`,
      `5. Call ${EMPLOYEE_TOOL_NAME.VERIFY_MY_TIME_OFF_REQUEST} with the resolved dates, leave type, and reason.`,
      `6. If verify returns ok: true, IMMEDIATELY call ${EMPLOYEE_TOOL_NAME.SUBMIT_MY_TIME_OFF_REQUEST}. Do NOT say "you can now submit", do NOT ask the user if they want to submit — just call the tool directly. The UI handles user confirmation automatically.`,
      `7. If verify returns code "PAST_DATE", say: "The dates you provided are in the past and are not valid for a new time-off request. Please select new dates." Then call ${EMPLOYEE_TOOL_NAME.COLLECT_DATE_RANGE}.`,
      `8. If verify returns any other error, explain it in one sentence then call ${EMPLOYEE_TOOL_NAME.COLLECT_DATE_RANGE} if dates need correction.`,
      "",
      "### Reference scenarios (read-only — do not replay these as actions)",
      "",
      `Scenario A — past dates: User mentions sick leave on April 30 and May 1 (past). Correct sequence: (1) ${EMPLOYEE_TOOL_NAME.CONSULT_DATE_SPECIALIST} resolves to 2026-04-30/2026-05-01, (2) ${EMPLOYEE_TOOL_NAME.VERIFY_MY_TIME_OFF_REQUEST} returns PAST_DATE, (3) reply with the past-date message, (4) call ${EMPLOYEE_TOOL_NAME.COLLECT_DATE_RANGE} once and stop.`,
      `Scenario B — duration: User says "2 days of annual leave starting from September 15, personal matters". Correct sequence: (1) ${EMPLOYEE_TOOL_NAME.CONSULT_DATE_SPECIALIST} resolves to 2026-09-15/2026-09-17, (2) ${EMPLOYEE_TOOL_NAME.VERIFY_MY_TIME_OFF_REQUEST} returns ok:true, (3) call ${EMPLOYEE_TOOL_NAME.SUBMIT_MY_TIME_OFF_REQUEST}.`,
      `Scenario C — no dates: User says "I want annual leave for a vacation" with no date mentioned. Correct sequence: (1) call ${EMPLOYEE_TOOL_NAME.COLLECT_DATE_RANGE} once and stop. WRONG: replying with "Please provide the start and end dates" in text.`,
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
      `5. For questions about leave rules, entitlements, notice periods, carryover, or any policy question — ALWAYS call ${MANAGER_TOOL_NAME.SEARCH_LEAVE_POLICY} first. Never answer policy questions from memory.`,
      "6. For every approval or rejection tool call, ALWAYS include the `employeeEmail` and `employeeAvatar` of the target employee to ensure the UI renders correctly.",
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
