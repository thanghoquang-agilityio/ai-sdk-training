import { DATE_AGENT_TOOL_NAME, DATE_AGENT_TOOL_DESCRIPTION } from "@/agents/specialists/date/tools/definitions";
import { POLICY_TOOL_NAME, POLICY_TOOL_DESCRIPTION } from "@/agents/handlers/policy/definitions";

export const MANAGER_TOOL_NAME = {
  LIST_EMPLOYEES: "list_employees",
  LIST_TEAM_MEMBERS: "list_team_members",
  LIST_TEAM_TIME_OFF_REQUESTS: "list_team_time_off_requests",
  APPROVE_TEAM_TIME_OFF_REQUEST: "approve_team_time_off_request",
  REJECT_TEAM_TIME_OFF_REQUEST: "reject_team_time_off_request",
  CONSULT_DATE_SPECIALIST: DATE_AGENT_TOOL_NAME.CONSULT_DATE_AGENT,
  SEARCH_LEAVE_POLICY: POLICY_TOOL_NAME.SEARCH_LEAVE_POLICY,
} as const;

export const MANAGER_TOOL_DESCRIPTION = {
  LIST_EMPLOYEES:
    "List all employees in the system. Use when you need to find someone who is not on the current manager's team.",
  LIST_TEAM_MEMBERS:
    "List all members on the current manager's team and their basic details.",
  LIST_TEAM_TIME_OFF_REQUESTS:
    "List all pending, upcoming, or past time-off requests for the current manager's team.",
  APPROVE_TEAM_TIME_OFF_REQUEST:
    "Approve one pending request from the current manager's team. This is a sensitive mutation and should go through UI approval before execution.",
  REJECT_TEAM_TIME_OFF_REQUEST:
    "Reject one pending or approved request from the current manager's team and include a short reason. This is a sensitive mutation and should go through UI approval before execution.",
  CONSULT_DATE_SPECIALIST: DATE_AGENT_TOOL_DESCRIPTION[DATE_AGENT_TOOL_NAME.CONSULT_DATE_AGENT],
  SEARCH_LEAVE_POLICY: POLICY_TOOL_DESCRIPTION[POLICY_TOOL_NAME.SEARCH_LEAVE_POLICY],
} as const;
