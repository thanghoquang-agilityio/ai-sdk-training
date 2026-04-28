import type { EmployeeRecord } from "@/lib/db/schema";

export const APP_ROLES = ["user", "manager"] as const;

export type AppRole = (typeof APP_ROLES)[number];

type MockSessionSeed = {
  sessionId: string;
  role: AppRole;
  employeeId: string;
  managedEmployeeIds: string[];
};

export type MockAuthSession = MockSessionSeed &
  EmployeeRecord & {
    roleLabel: string;
    managedEmployees: EmployeeRecord[];
  };

const ROLE_LABEL_BY_ROLE: Record<AppRole, string> = {
  user: "User mode",
  manager: "Manager mode",
};

export function getRoleLabel(role: AppRole): string {
  return ROLE_LABEL_BY_ROLE[role];
}

export function isAppRole(value: string): value is AppRole {
  return APP_ROLES.includes(value as AppRole);
}
