export const POLICY_TOOL_NAME = {
  SEARCH_LEAVE_POLICY: "search_leave_policy",
} as const;

export const POLICY_TOOL_DESCRIPTION = {
  [POLICY_TOOL_NAME.SEARCH_LEAVE_POLICY]:
    "Search the company leave policy document using semantic search. Use this for questions about: leave rules and entitlements, carryover limits, notice periods, medical certificate requirements, leave during probation, public holidays, team coverage rules, or cancellation policy. Do NOT use this for querying actual leave records or balances — use the balance and request tools for that.",
} as const;
