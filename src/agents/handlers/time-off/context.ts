import type { MockAuthSession } from "@/lib/auth/session";
import type {
  EmployeeRecord,
  LeaveType,
  RequestStatus,
  TimeOffRequest,
} from "@/lib/db/schema";
import { listEmployeeDirectory } from "@/services/company-system/employees";
import { listTimeOffRequests } from "@/services/company-system/requests";
import { leaveTypeLabel } from "@/utils/leave";
import { formatDateRange } from "@/agents/handlers/common/date";

export type BalanceRow = {
  leaveType: Exclude<LeaveType, "unpaid">;
  allowance: number;
  used: number;
  pending: number;
  remaining: number;
};

export type FormattedRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employeeAvatar: string;
  team: string;
  leaveType: LeaveType;
  leaveTypeLabel: string;
  startDate: string;
  endDate: string;
  days: number;
  status: RequestStatus;
  reason: string;
  note?: string;
  reviewComment?: string;
  label: string;
};

export type RequestMatch = {
  id: string;
  employeeId: string;
  employeeName: string;
  label: string;
  status: RequestStatus;
  startDate: string;
  endDate: string;
};

export type ListRequestInput = {
  status?: RequestStatus | "all" | "upcoming";
  query?: string;
};

export type TimeOffContext = {
  employees: EmployeeRecord[];
  requests: TimeOffRequest[];
};

/**
 * loadContext helper.
 * @returns {Promise<TimeOffContext>}
 */
export async function loadContext(): Promise<TimeOffContext> {
  const [employees, requests] = await Promise.all([
    listEmployeeDirectory(),
    listTimeOffRequests(),
  ]);
  return { employees, requests };
}

/**
 * normalizeValue helper.
 * @param {string} value
 * @returns {string}
 */
export function normalizeValue(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Gets employee by id.
 * @param {EmployeeRecord[]} employees
 * @param {string} employeeId
 * @returns {EmployeeRecord | undefined}
 */
export function getEmployeeById(
  employees: EmployeeRecord[],
  employeeId: string,
): EmployeeRecord | undefined {
  return employees.find((e) => e.employeeId === employeeId);
}

/**
 * Gets employee or throw.
 * @param {EmployeeRecord[]} employees
 * @param {string} employeeId
 * @returns {EmployeeRecord}
 */
export function getEmployeeOrThrow(
  employees: EmployeeRecord[],
  employeeId: string,
): EmployeeRecord {
  const employee = getEmployeeById(employees, employeeId);
  if (!employee) {
    throw new Error(`Employee ${employeeId} is not configured in company system.`);
  }
  return employee;
}

/**
 * Gets employee summary.
 * @param {MockAuthSession} session
 */
export function getEmployeeSummary(session: MockAuthSession) {
  return {
    employeeId: session.employeeId,
    name: session.name,
    email: session.email,
    avatar: session.avatar,
    team: session.team,
    manager: session.manager,
    timeZone: session.timeZone,
    role: session.role,
    managedEmployeeIds: session.managedEmployeeIds,
    managedEmployees: session.managedEmployees.map((e) => ({
      employeeId: e.employeeId,
      name: e.name,
      email: e.email,
      avatar: e.avatar,
      team: e.team,
    })),
  };
}

/**
 * formatRequest helper.
 * @param {EmployeeRecord[]} employees
 * @param {TimeOffRequest} request
 * @returns {FormattedRequest}
 */
export function formatRequest(
  employees: EmployeeRecord[],
  request: TimeOffRequest,
): FormattedRequest {
  const employee = getEmployeeOrThrow(employees, request.employeeId);
  const label = leaveTypeLabel(request.leaveType);

  return {
    id: request.id,
    employeeId: employee.employeeId,
    employeeName: employee.name,
    employeeEmail: employee.email,
    employeeAvatar: employee.avatar,
    team: employee.team,
    leaveType: request.leaveType,
    leaveTypeLabel: label,
    startDate: request.startDate,
    endDate: request.endDate,
    days: request.days,
    status: request.status,
    reason: request.reason,
    note: request.note,
    reviewComment: request.reviewComment,
    label: `${employee.name} · ${label} · ${formatDateRange(request.startDate, request.endDate)} · ${request.days} day${request.days > 1 ? "s" : ""} · ${request.status}`,
  };
}

/**
 * Converts value to request match.
 * @param {EmployeeRecord[]} employees
 * @param {TimeOffRequest} request
 * @returns {RequestMatch}
 */
export function toRequestMatch(
  employees: EmployeeRecord[],
  request: TimeOffRequest,
): RequestMatch {
  const formatted = formatRequest(employees, request);
  return {
    id: formatted.id,
    employeeId: formatted.employeeId,
    employeeName: formatted.employeeName,
    label: formatted.label,
    status: formatted.status,
    startDate: formatted.startDate,
    endDate: formatted.endDate,
  };
}
