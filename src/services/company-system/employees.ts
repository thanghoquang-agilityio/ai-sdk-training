import "server-only";

import { COMPANY_SYSTEM_ENDPOINT_PATH } from "@/constants/db";
import type {
  EmployeeRecord,
  EmployeeRow,
  LeaveEntitlementRow,
  RoleProfileRow,
  TeamRow,
} from "@/lib/db/schema";
import { cloneRows, request } from "@/services/company-system/client";
import { getAvatarUrl } from "@/utils/avatar";

function isTeamRow(value: unknown): value is TeamRow {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TeamRow>;
  return typeof candidate.teamId === "string" && typeof candidate.name === "string";
}

function isEmployeeRow(value: unknown): value is EmployeeRow {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<EmployeeRow>;

  return (
    typeof candidate.employeeId === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.email === "string" &&
    (typeof candidate.avatar === "string" ||
      typeof candidate.avatar === "undefined") &&
    typeof candidate.teamId === "string" &&
    typeof candidate.timeZone === "string" &&
    (typeof candidate.managerEmployeeId === "string" ||
      typeof candidate.managerEmployeeId === "undefined" ||
      candidate.managerEmployeeId === null)
  );
}

function isLeaveEntitlementRow(value: unknown): value is LeaveEntitlementRow {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<LeaveEntitlementRow>;

  return (
    typeof candidate.employeeId === "string" &&
    typeof candidate.annual === "number" &&
    typeof candidate.sick === "number" &&
    typeof candidate.personal === "number"
  );
}

function isRoleProfileRow(value: unknown): value is RoleProfileRow {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<RoleProfileRow>;

  return (
    (candidate.role === "user" || candidate.role === "manager") &&
    typeof candidate.employeeId === "string"
  );
}

export async function listEmployeeRows(): Promise<EmployeeRow[]> {
  const rows = await request<unknown[]>(COMPANY_SYSTEM_ENDPOINT_PATH.employees);
  return cloneRows(rows.filter(isEmployeeRow));
}

export async function listRoleProfiles(): Promise<RoleProfileRow[]> {
  const rows = await request<unknown[]>(COMPANY_SYSTEM_ENDPOINT_PATH.roleProfiles);
  return cloneRows(rows.filter(isRoleProfileRow));
}

export async function listEmployeeDirectory(): Promise<EmployeeRecord[]> {
  const [teams, employees, leaveEntitlements] = await Promise.all([
    request<unknown[]>(COMPANY_SYSTEM_ENDPOINT_PATH.teams),
    request<unknown[]>(COMPANY_SYSTEM_ENDPOINT_PATH.employees),
    request<unknown[]>(
      COMPANY_SYSTEM_ENDPOINT_PATH.leaveEntitlements,
    ),
  ]);

  const validTeams = teams.filter(isTeamRow);
  const validEmployees = employees.filter(isEmployeeRow);
  const validLeaveEntitlements = leaveEntitlements.filter(isLeaveEntitlementRow);

  const teamNameByTeamId = new Map(
    validTeams.map((team) => [team.teamId, team.name]),
  );
  const employeeByEmployeeId = new Map(
    validEmployees.map((employee) => [employee.employeeId, employee]),
  );
  const entitlementByEmployeeId = new Map(
    validLeaveEntitlements.map((entitlement) => [entitlement.employeeId, entitlement]),
  );

  return validEmployees.map((employee) => {
    const managerName =
      employee.managerEmployeeId &&
      employeeByEmployeeId.get(employee.managerEmployeeId)?.name;
    const entitlement = entitlementByEmployeeId.get(employee.employeeId);

    return {
      employeeId: employee.employeeId,
      name: employee.name,
      email: employee.email,
      avatar: employee.avatar?.trim() || getAvatarUrl(employee.name),
      team: teamNameByTeamId.get(employee.teamId) ?? employee.teamId,
      manager: managerName ?? "Not assigned",
      timeZone: employee.timeZone,
      entitlements: {
        annual: entitlement?.annual ?? 0,
        sick: entitlement?.sick ?? 0,
        personal: entitlement?.personal ?? 0,
      },
    };
  });
}
