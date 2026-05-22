import type { MockAuthSession } from "@/lib/auth/session";
import type { EmployeeRecord, TimeOffRequest } from "@/lib/db/schema";
import {
  formatRequest,
  getEmployeeOrThrow,
  getEmployeeSummary,
  loadContext,
  type BalanceRow,
  type TimeOffContext,
} from "./context";
import {
  compareByStartDate,
  getOpenRequestsForEmployee,
  getRequestsForEmployee,
} from "./queries";
import { getTodayIsoDate } from "@/agents/memory/date";

/**
 * Builds balance rows.
 * @param {EmployeeRecord} employee
 * @param {TimeOffRequest[]} requests
 * @returns {BalanceRow[]}
 */
export function buildBalanceRows(
  employee: EmployeeRecord,
  requests: TimeOffRequest[],
): BalanceRow[] {
  const rows: BalanceRow[] = [
    { leaveType: "annual", allowance: employee.entitlements.annual, used: 0, pending: 0, remaining: employee.entitlements.annual },
    { leaveType: "sick", allowance: employee.entitlements.sick, used: 0, pending: 0, remaining: employee.entitlements.sick },
    { leaveType: "personal", allowance: employee.entitlements.personal, used: 0, pending: 0, remaining: employee.entitlements.personal },
  ];

  const rowByType = new Map(rows.map((r) => [r.leaveType, r]));

  for (const request of getRequestsForEmployee(requests, employee.employeeId)) {
    if (request.leaveType === "unpaid") continue;
    const row = rowByType.get(request.leaveType);
    if (!row) continue;

    if (request.status === "approved") {
      row.used += request.days;
      row.remaining = Math.max(row.allowance - row.used, 0);
    } else if (request.status === "pending") {
      row.pending += request.days;
    }
  }

  return rows;
}

/**
 * Builds my time off balance payload.
 * @param {MockAuthSession} session
 * @param {TimeOffContext} ctx
 */
export function buildMyTimeOffBalancePayload(
  session: MockAuthSession,
  ctx: TimeOffContext,
) {
  const employee = getEmployeeOrThrow(ctx.employees, session.employeeId);
  const balances = buildBalanceRows(employee, ctx.requests);
  const upcomingRequests = getOpenRequestsForEmployee(ctx.requests, employee.employeeId)
    .filter((r) => r.startDate >= getTodayIsoDate(employee.timeZone))
    .sort(compareByStartDate)
    .map((r) => formatRequest(ctx.employees, r));

  return {
    ok: true,
    employee: getEmployeeSummary(session),
    today: getTodayIsoDate(employee.timeZone),
    balances,
    upcomingRequests,
    policy: {
      annual: "Vacation or PTO should use annual leave.",
      sick: "Sick leave can be used for illness or doctor visits.",
      personal: "Personal leave is best for short personal appointments.",
      unpaid: "Unpaid leave stays available when paid balances are not enough.",
    },
  };
}

/**
 * Gets my time off balance.
 * @param {MockAuthSession} session
 */
export async function getMyTimeOffBalance(session: MockAuthSession) {
  const ctx = await loadContext();
  return buildMyTimeOffBalancePayload(session, ctx);
}
