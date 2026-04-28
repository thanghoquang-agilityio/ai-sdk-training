import type { MockAuthSession } from "@/lib/auth/session";
import type { RequestStatus } from "@/lib/db/schema";
import {
  formatRequest,
  getEmployeeSummary,
  type ListRequestInput,
  type TimeOffContext,
} from "./context";
import {
  compareByStartDate,
  filterRequestsByQuery,
  getRequestsForEmployee,
  getTeamRequestsForManager,
} from "./queries";
import { getTodayIsoDate, parseIsoDateToUtcDay } from "@/agents/handlers/common/date";

export type TeamRequestListInput = {
  status?: RequestStatus | "all" | "upcoming";
  employeeQuery?: string;
};

/**
 * Builds my time off requests payload.
 * @param {MockAuthSession} session
 * @param {TimeOffContext} ctx
 * @param {ListRequestInput | undefined} input
 */
export function buildMyTimeOffRequestsPayload(
  session: MockAuthSession,
  ctx: TimeOffContext,
  input: ListRequestInput | undefined,
) {
  const status = input?.status ?? "all";
  const todayDay = parseIsoDateToUtcDay(getTodayIsoDate(session.timeZone));
  const filteredRequests = filterRequestsByQuery(
    ctx.employees,
    getRequestsForEmployee(ctx.requests, session.employeeId),
    input?.query,
  )
    .filter((request) => {
      if (status === "all") return true;
      if (status === "upcoming") {
        const startDay = parseIsoDateToUtcDay(request.startDate);
        return (
          Number.isFinite(startDay) &&
          startDay >= todayDay &&
          request.status !== "cancelled" &&
          request.status !== "rejected"
        );
      }
      return request.status === status;
    })
    .sort(compareByStartDate)
    .map((request) => formatRequest(ctx.employees, request));

  return {
    ok: true,
    scope: "self",
    status,
    query: input?.query?.trim() || null,
    total: filteredRequests.length,
    requests: filteredRequests,
  };
}

/**
 * Builds team time off requests payload.
 * @param {MockAuthSession} session
 * @param {TimeOffContext} ctx
 * @param {TeamRequestListInput | undefined} input
 */
export function buildTeamTimeOffRequestsPayload(
  session: MockAuthSession,
  ctx: TimeOffContext,
  input: TeamRequestListInput | undefined,
) {
  const status = input?.status ?? "all";
  const todayDay = parseIsoDateToUtcDay(getTodayIsoDate(session.timeZone));
  const filteredRequests = filterRequestsByQuery(
    ctx.employees,
    getTeamRequestsForManager(ctx.requests, session),
    input?.employeeQuery,
  )
    .filter((request) => {
      if (status === "all") return true;
      if (status === "upcoming") {
        const startDay = parseIsoDateToUtcDay(request.startDate);
        return (
          Number.isFinite(startDay) &&
          startDay >= todayDay &&
          request.status !== "cancelled" &&
          request.status !== "rejected"
        );
      }
      return request.status === status;
    })
    .sort(compareByStartDate)
    .map((request) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { employeeId, ...rest } = formatRequest(ctx.employees, request);
      return rest;
    });

  return {
    ok: true,
    scope: "team",
    manager: getEmployeeSummary(session),
    status,
    query: input?.employeeQuery?.trim() || null,
    total: filteredRequests.length,
    requests: filteredRequests,
  };
}
