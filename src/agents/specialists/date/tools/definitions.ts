export const DATE_AGENT_TOOL_NAME = {
  CONSULT_DATE_AGENT: "consult_date_agent",
} as const;

export const DATE_AGENT_TOOL_DESCRIPTION = {
  [DATE_AGENT_TOOL_NAME.CONSULT_DATE_AGENT]:
    "Resolve any user date or duration expression into absolute YYYY-MM-DD start and end dates. Call this for ANY of: a named date ('September 15', 'April 30'), a relative date ('next Monday', 'tomorrow'), a date range ('April 30 to May 1'), or a duration ('2 days starting from September 15', '3 days from next Friday'). Pass the user's original text as the query. NEVER ask the user for dates — always call this tool instead.",
} as const;
