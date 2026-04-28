export const COMPANY_SYSTEM_DEFAULT_BASE_URL = "http://127.0.0.1:4100";

export const COMPANY_SYSTEM_ENDPOINT_PATH = {
  teams: "/teams",
  employees: "/employees",
  leaveEntitlements: "/leave-entitlements",
  roleProfiles: "/role-profiles",
  timeOffRequests: "/time-off-requests",
} as const;

export const COMPANY_SYSTEM_COPY = {
  requestFailedPrefix: "Company system request failed",
  noResponseBody: "No response body",
} as const;
