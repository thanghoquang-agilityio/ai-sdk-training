export const MANAGER_TOOL_NAME = {
  LIST_EMPLOYEES: "list_employees",
  LIST_TEAM_MEMBERS: "list_team_members",
  LIST_TEAM_TIME_OFF_REQUESTS: "list_team_time_off_requests",
  APPROVE_TEAM_TIME_OFF_REQUEST: "approve_team_time_off_request",
  REJECT_TEAM_TIME_OFF_REQUEST: "reject_team_time_off_request",
} as const;

export const MANAGER_TOOL_DESCRIPTION = {
  LIST_EMPLOYEES:
    "List all employees in the manager's project team with a summary of their pending, upcoming, and total time-off request counts. Use this when the user asks to browse or review all members in their project.",
  LIST_TEAM_MEMBERS:
    "List all direct reports for the current manager with a summary of their pending, upcoming, and total time-off request counts. Use this when the manager wants an overview of their team members before drilling into individual requests.",
  LIST_TEAM_TIME_OFF_REQUESTS:
    "List or filter team time-off requests for the current manager. Use this for pending approvals, upcoming absences, or employee-specific request reviews.",
  APPROVE_TEAM_TIME_OFF_REQUEST:
    "Approve one pending request from the current manager's team. This is a sensitive mutation and should go through UI approval before execution.",
  REJECT_TEAM_TIME_OFF_REQUEST:
    "Reject one pending request from the current manager's team and include a short reason. This is a sensitive mutation and should go through UI approval before execution.",
} as const;
