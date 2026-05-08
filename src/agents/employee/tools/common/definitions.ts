import { DATE_AGENT_TOOL_NAME, DATE_AGENT_TOOL_DESCRIPTION } from "@/agents/date/tools/definitions";

export const EMPLOYEE_TOOL_NAME = {
  GET_MY_TIME_OFF_BALANCE: "get_my_time_off_balance",
  LIST_MY_TIME_OFF_REQUESTS: "list_my_time_off_requests",
  COLLECT_DATE_RANGE: "collect_date_range",
  SUBMIT_MY_TIME_OFF_REQUEST: "submit_my_time_off_request",
  CANCEL_MY_TIME_OFF_REQUEST: "cancel_my_time_off_request",
  CONSULT_DATE_SPECIALIST: DATE_AGENT_TOOL_NAME.CONSULT_DATE_AGENT,
} as const;

export const EMPLOYEE_TOOL_DESCRIPTION = {
  GET_MY_TIME_OFF_BALANCE:
    "Get the current user's leave balances, approver, and the next few upcoming requests.",
  LIST_MY_TIME_OFF_REQUESTS:
    "List the current user's time-off requests. Use for upcoming requests, history, or when you need to identify a request before cancelling.",
  COLLECT_DATE_RANGE:
    "Show a date range picker in the UI so the user can select start and end dates. Call this as soon as leaveType is known and no dates have been provided. Reason is optional — include it only if the user has already stated it.",
  SUBMIT_MY_TIME_OFF_REQUEST:
    "Create a new time-off request for the current user. This is a sensitive mutation and should go through UI approval before execution.",
  CANCEL_MY_TIME_OFF_REQUEST:
    "Cancel one of the current user's cancellable requests. This is a sensitive mutation and should go through UI approval before execution. Use a clear request description such as latest pending request, annual leave on 2026-06-15, or family trip request.",
  CONSULT_DATE_SPECIALIST: DATE_AGENT_TOOL_DESCRIPTION[DATE_AGENT_TOOL_NAME.CONSULT_DATE_AGENT],
} as const;
