import type { MockAuthSession } from "@/lib/auth/session";
import type { LeaveType, TimeOffRequest } from "@/lib/db/schema";
import { replaceTimeOffRequests } from "@/services/company-system/requests";
import {
  buildBalanceRows,
  buildMyTimeOffBalancePayload,
} from "./balance";
import {
  formatRequest,
  getEmployeeOrThrow,
  toRequestMatch,
  type ListRequestInput,
} from "./context";
import {
  compareByStartDate,
  findOwnRequestsMatchingQuery,
  getOpenRequestsForEmployee,
  nextRequestId,
  overlaps,
} from "./queries";
import { buildMyTimeOffRequestsPayload } from "./payload";
import { withRequests } from "./mutations";
import {
  countBusinessDays,
  getTodayIsoDate,
  parseDateInputToUtcDay,
  parseIsoDateToUtcDay,
  utcDayToIsoDate,
} from "@/agents/handlers/common/date";
import { loadContext } from "./context";

export type SubmitMyTimeOffRequestInput = {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  note?: string;
};

export type RequestQueryInput = {
  requestQuery: string;
};

/**
 * Lists my time off requests.
 * @param {MockAuthSession} session
 * @param {ListRequestInput} input
 */
export async function listMyTimeOffRequests(
  session: MockAuthSession,
  input?: ListRequestInput,
) {
  const ctx = await loadContext();
  return buildMyTimeOffRequestsPayload(session, ctx, input);
}

/**
 * submitMyTimeOffRequest helper.
 * @param {MockAuthSession} session
 * @param {SubmitMyTimeOffRequestInput} input
 */
export async function submitMyTimeOffRequest(
  session: MockAuthSession,
  input: SubmitMyTimeOffRequestInput,
) {
  const ctx = await loadContext();
  const employee = getEmployeeOrThrow(ctx.employees, session.employeeId);
  const startDay = parseDateInputToUtcDay(input.startDate, employee.timeZone);
  const endDay = parseDateInputToUtcDay(input.endDate, employee.timeZone);
  const todayDay = parseIsoDateToUtcDay(getTodayIsoDate(employee.timeZone));

  if (!Number.isFinite(startDay) || !Number.isFinite(endDay)) {
    return {
      ok: false,
      code: "INVALID_DATE",
      message:
        "I couldn't resolve the requested dates. Please use exact dates like 2026-05-02 if needed.",
    };
  }

  if (endDay < startDay) {
    return {
      ok: false,
      code: "INVALID_RANGE",
      message: "The end date must be on or after the start date.",
    };
  }

  if (startDay < todayDay) {
    return {
      ok: false,
      code: "PAST_DATE",
      message: `New time-off requests must start on or after ${getTodayIsoDate(employee.timeZone)}.`,
    };
  }

  const businessDays = countBusinessDays(startDay, endDay);
  if (businessDays <= 0) {
    return {
      ok: false,
      code: "NON_WORKING_DAYS",
      message:
        "That range only covers non-working days. Please choose at least one weekday.",
    };
  }

  const resolvedStartDate = utcDayToIsoDate(startDay);
  const resolvedEndDate = utcDayToIsoDate(endDay);

  const overlappingRequests = getOpenRequestsForEmployee(
    ctx.requests,
    employee.employeeId,
  )
    .filter((request) => overlaps(request, startDay, endDay))
    .map((request) => toRequestMatch(ctx.employees, request));

  if (overlappingRequests.length > 0) {
    return {
      ok: false,
      code: "OVERLAP",
      message:
        "This request overlaps with an existing non-cancelled time-off request.",
      conflictingRequests: overlappingRequests,
    };
  }

  if (input.leaveType !== "unpaid") {
    const balance = buildBalanceRows(employee, ctx.requests).find(
      (row) => row.leaveType === input.leaveType,
    );

    if (!balance || balance.remaining < businessDays) {
      return {
        ok: false,
        code: "INSUFFICIENT_BALANCE",
        message: `You only have ${balance?.remaining ?? 0} ${input.leaveType} day${balance?.remaining === 1 ? "" : "s"} remaining.`,
      };
    }
  }

  const now = new Date().toISOString();
  const request: TimeOffRequest = {
    id: nextRequestId(ctx.requests),
    employeeId: employee.employeeId,
    leaveType: input.leaveType,
    startDate: resolvedStartDate,
    endDate: resolvedEndDate,
    days: businessDays,
    status: "pending",
    reason: input.reason.trim(),
    note: input.note?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };

  const nextRequests = [...ctx.requests, request].sort(compareByStartDate);
  const persistedRequests = await replaceTimeOffRequests(nextRequests);
  const nextCtx = withRequests(ctx, persistedRequests);
  const persistedRequest = persistedRequests.find(
    (savedRequest) => savedRequest.id === request.id,
  );

  return {
    ok: true,
    request: formatRequest(ctx.employees, persistedRequest ?? request),
    balance: buildMyTimeOffBalancePayload(session, nextCtx),
  };
}

/**
 * cancelMyTimeOffRequest helper.
 * @param {MockAuthSession} session
 * @param {RequestQueryInput} input
 */
export async function cancelMyTimeOffRequest(
  session: MockAuthSession,
  input: RequestQueryInput,
) {
  const ctx = await loadContext();
  const query = input.requestQuery.trim();
  if (!query) {
    return {
      ok: false,
      code: "MISSING_QUERY",
      message: "Please tell me which request you want to cancel.",
    };
  }

  const matches = findOwnRequestsMatchingQuery(ctx, session, query);
  if (matches.length === 0) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message:
        "I couldn't find a cancellable request that matches that description.",
    };
  }

  if (matches.length > 1) {
    return {
      ok: false,
      code: "AMBIGUOUS_REQUEST",
      message:
        "I found more than one matching request. Please choose one request more specifically.",
      matches: matches.map((request) => toRequestMatch(ctx.employees, request)),
    };
  }

  const request = matches[0];
  const requestStartDay = parseIsoDateToUtcDay(request.startDate);
  const todayDay = parseIsoDateToUtcDay(getTodayIsoDate(session.timeZone));

  if (request.status === "approved" && requestStartDay < todayDay) {
    return {
      ok: false,
      code: "ALREADY_STARTED",
      message:
        "That approved request has already started, so it can't be cancelled here.",
    };
  }

  const nextRequests = ctx.requests.map((item) =>
    item.id === request.id
      ? {
          ...item,
          status: "cancelled" as const,
          updatedAt: new Date().toISOString(),
        }
      : item,
  );
  const persistedRequests = await replaceTimeOffRequests(nextRequests);
  const nextCtx = withRequests(ctx, persistedRequests);
  const cancelledRequest = persistedRequests.find(
    (item) => item.id === request.id,
  );

  return {
    ok: true,
    request: cancelledRequest
      ? formatRequest(ctx.employees, cancelledRequest)
      : null,
    cancelledRequests: buildMyTimeOffRequestsPayload(session, nextCtx, {
      status: "cancelled",
    }),
  };
}
