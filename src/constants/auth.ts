import type { AppRole } from "@/lib/auth/session";

export const ROLE_HELPER_COPY_BY_ROLE: Record<AppRole, string> = {
  user: "User mode routes to the Employee Assistant for your personal leave requests and balance checks.",
  manager:
    "Manager mode unlocks team approval workflows while still supporting personal leave questions.",
};

export const AUTH_PANEL_COPY = {
  title: "User mode selection",
  modeLabel: "Select mode",
  userModeLabel: "User mode",
  managerModeLabel: "Manager mode",
  managerLabelPrefix: "Manager",
  projectLabel: "Project",
  emailLabel: "Email",
  directReportsLabel: "Direct reports",
} as const;

export const SESSION_ID_BY_ROLE: Record<AppRole, string> = {
  user: "db-user-session",
  manager: "db-manager-session",
};

export const AUTH_HEADER = {
  role: "x-auth-role",
  resolvedRole: "x-resolved-role",
} as const;
