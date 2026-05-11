import { DATE_AGENT_TOOL_NAME, DATE_AGENT_TOOL_DESCRIPTION } from "@/agents/specialists/date/tools/definitions";

export const EMPLOYEE_TOOL_NAME = {
  GET_MY_TIME_OFF_BALANCE: "get_my_time_off_balance",
  LIST_MY_TIME_OFF_REQUESTS: "list_my_time_off_requests",
  COLLECT_DATE_RANGE: "collect_date_range",
  VERIFY_MY_TIME_OFF_REQUEST: "verify_my_time_off_request",
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
    "Show a date range picker. FORBIDDEN when user mentioned any date/duration — use consult_date_agent instead. ONLY call this when the user gave zero date information, or after verify returns PAST_DATE error.",
  VERIFY_MY_TIME_OFF_REQUEST:
    "Verify if a leave request is valid (checks dates, overlaps, and balance) before submission. Use this ALWAYS before calling submit_my_time_off_request.",
  SUBMIT_MY_TIME_OFF_REQUEST:
    "Create a new time-off request for the current user. ONLY call this after verify_my_time_off_request has returned ok: true. This is a sensitive mutation and should go through UI approval before execution.",
  CANCEL_MY_TIME_OFF_REQUEST:
    "Cancel one of the current user's cancellable requests. This is a sensitive mutation and should go through UI approval before execution. Use a clear request description such as latest pending request, annual leave on 2026-06-15, or family trip request.",
  CONSULT_DATE_SPECIALIST: DATE_AGENT_TOOL_DESCRIPTION[DATE_AGENT_TOOL_NAME.CONSULT_DATE_AGENT],
} as const;
