import "server-only";

import { SESSION_ID_BY_ROLE } from "@/constants/auth";
import type { EmployeeRecord, EmployeeRow, RoleProfileRow } from "@/lib/db/schema";
import {
  listEmployeeDirectory,
  listEmployeeRows,
  listRoleProfiles,
} from "@/services/company-system/employees";
import {
  getRoleLabel,
  type AppRole,
  type MockAuthSession,
} from "@/lib/auth/session";

function buildSession(
  role: AppRole,
  employeeDirectory: EmployeeRecord[],
  employeeRows: EmployeeRow[],
  roleProfiles: RoleProfileRow[],
): MockAuthSession {
  const employeeById = new Map(
    employeeDirectory.map((employee) => [employee.employeeId, employee]),
  );
  const roleEmployeeIdMap = new Map(
    roleProfiles.map((profile) => [profile.role, profile.employeeId]),
  );

  const managerFallbackEmployeeId = employeeRows.find((employee) =>
    employeeRows.some(
      (candidate) => candidate.managerEmployeeId === employee.employeeId,
    ),
  )?.employeeId;
  const fallbackEmployeeId =
    role === "manager" ? managerFallbackEmployeeId : employeeRows[0]?.employeeId;
  const roleEmployeeId =
    roleEmployeeIdMap.get(role) ?? fallbackEmployeeId ?? employeeRows[0]?.employeeId;

  if (!roleEmployeeId) {
    throw new Error("Company system has no employees configured.");
  }

  const employee = employeeById.get(roleEmployeeId);
  if (!employee) {
    throw new Error(`Employee ${roleEmployeeId} not found in employee directory.`);
  }

  const managedEmployeeIds = employeeRows
    .filter((candidate) => candidate.managerEmployeeId === roleEmployeeId)
    .map((candidate) => candidate.employeeId);
  const managedEmployees = managedEmployeeIds
    .map((employeeId) => employeeById.get(employeeId))
    .filter((candidate): candidate is NonNullable<typeof candidate> =>
      Boolean(candidate),
    );

  return {
    ...employee,
    sessionId: SESSION_ID_BY_ROLE[role],
    role,
    employeeId: roleEmployeeId,
    managedEmployeeIds,
    roleLabel: getRoleLabel(role),
    managedEmployees,
  };
}

async function loadSessionData() {
  const [employeeDirectory, employeeRows, roleProfiles] = await Promise.all([
    listEmployeeDirectory(),
    listEmployeeRows(),
    listRoleProfiles(),
  ]);
  return { employeeDirectory, employeeRows, roleProfiles };
}

export async function getMockAuthSession(
  role: AppRole = "user",
): Promise<MockAuthSession> {
  const { employeeDirectory, employeeRows, roleProfiles } = await loadSessionData();
  return buildSession(role, employeeDirectory, employeeRows, roleProfiles);
}

export async function getMockAuthSessionsByRole(): Promise<
  Record<AppRole, MockAuthSession>
> {
  const { employeeDirectory, employeeRows, roleProfiles } = await loadSessionData();
  return {
    user: buildSession("user", employeeDirectory, employeeRows, roleProfiles),
    manager: buildSession("manager", employeeDirectory, employeeRows, roleProfiles),
  };
}
