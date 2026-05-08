export const DATE_AGENT_TOOL_NAME = {
  CONSULT_DATE_AGENT: "consult_date_agent",
} as const;

export const DATE_AGENT_TOOL_DESCRIPTION = {
  [DATE_AGENT_TOOL_NAME.CONSULT_DATE_AGENT]:
    "Invoke the Date Agent (sub-agent) to resolve relative dates (e.g. 'next Monday'), calculate durations, or provide date suggestions. Use this BEFORE calling any tools that require specific dates if the user's dates are ambiguous or not yet in YYYY-MM-DD format.",
} as const;
