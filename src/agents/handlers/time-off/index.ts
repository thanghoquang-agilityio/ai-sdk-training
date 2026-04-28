import type { MockAuthSession } from "@/lib/auth/session";
import { getMyTimeOffBalance } from "./balance";
import {
  getEmployeeSummary,
  loadContext,
} from "./context";
import {
  getTeamRequestsForManager,
} from "./queries";
import {
  buildTeamTimeOffRequestsPayload,
  type TeamRequestListInput,
} from "./payload";
import {
  reviewTeamTimeOffRequest,
} from "./mutations";

type OptionalCommentRequestInput = {
  requestQuery: string;
  comment?: string;
  showTeamPending?: boolean;
};

type RequiredCommentRequestInput = {
  requestQuery: string;
  comment: string;
  showTeamPending?: boolean;
};

/**
 * Validates manager role.
 * @param {MockAuthSession} session
 */
function requireManagerRole(session: MockAuthSession) {
  if (session.role !== "manager") {
    return {
      ok: false as const,
      code: "MANAGER_ONLY",
      message: "This action is only available in Manager view.",
    };
  }
  return null;
}

export { getMyTimeOffBalance };
export {
  listMyTimeOffRequests,
  submitMyTimeOffRequest,
  cancelMyTimeOffRequest,
} from "./user-actions";

/**
 * Lists team members with their time-off request summaries.
 * @param {MockAuthSession} session
 */
export async function listTeamMembers(session: MockAuthSession) {
  const denied = requireManagerRole(session);
  if (denied) return denied;

  const ctx = await loadContext();
  const teamRequests = getTeamRequestsForManager(ctx.requests, session);

  const members = session.managedEmployees.map((e) => {
    const employeeRequests = teamRequests.filter(
      (r) => r.employeeId === e.employeeId,
    );
    const pendingCount = employeeRequests.filter(
      (r) => r.status === "pending",
    ).length;
    const approvedCount = employeeRequests.filter(
      (r) => r.status === "approved",
    ).length;
    const cancelledCount = employeeRequests.filter(
      (r) => r.status === "cancelled" || r.status === "rejected",
    ).length;

    return {
      employeeName: e.name,
      employeeAvatar: e.avatar,
      team: e.team,
      pendingCount,
      approvedCount,
      cancelledCount,
      totalCount: employeeRequests.length,
    };
  });

  return {
    ok: true,
    scope: "team",
    manager: getEmployeeSummary(session),
    totalMembers: members.length,
    members,
  };
}

/**
 * Lists all employees in the company with their time-off request summaries.
 * @param {MockAuthSession} session
 */
export async function listAllEmployees(session: MockAuthSession) {
  const ctx = await loadContext();

  const projectEmployees = ctx.employees.filter((e) => e.team === session.team);

  const employees = projectEmployees.map((e) => {
    const employeeRequests = ctx.requests.filter(
      (r) => r.employeeId === e.employeeId,
    );
    const pendingCount = employeeRequests.filter(
      (r) => r.status === "pending",
    ).length;
    const approvedCount = employeeRequests.filter(
      (r) => r.status === "approved",
    ).length;
    const cancelledCount = employeeRequests.filter(
      (r) => r.status === "cancelled" || r.status === "rejected",
    ).length;

    return {
      employeeName: e.name,
      employeeAvatar: e.avatar,
      team: e.team,
      pendingCount,
      approvedCount,
      cancelledCount,
      totalCount: employeeRequests.length,
    };
  });

  return {
    ok: true,
    totalEmployees: employees.length,
    employees,
  };
}

/**
 * Lists team time off requests.
 * @param {MockAuthSession} session
 * @param {TeamRequestListInput | undefined} input
 */
export async function listTeamTimeOffRequests(
  session: MockAuthSession,
  input?: TeamRequestListInput,
) {
  const ctx = await loadContext();
  return buildTeamTimeOffRequestsPayload(session, ctx, input);
}

/**
 * approveTeamTimeOffRequest helper.
 * @param {MockAuthSession} session
 * @param {OptionalCommentRequestInput} input
 */
export async function approveTeamTimeOffRequest(
  session: MockAuthSession,
  input: OptionalCommentRequestInput,
) {
  const denied = requireManagerRole(session);
  if (denied) return denied;

  const ctx = await loadContext();
  return reviewTeamTimeOffRequest(session, ctx, {
    ...input,
    nextStatus: "approved",
  });
}

/**
 * rejectTeamTimeOffRequest helper.
 * @param {MockAuthSession} session
 * @param {RequiredCommentRequestInput} input
 */
export async function rejectTeamTimeOffRequest(
  session: MockAuthSession,
  input: RequiredCommentRequestInput,
) {
  const denied = requireManagerRole(session);
  if (denied) return denied;

  const ctx = await loadContext();
  return reviewTeamTimeOffRequest(session, ctx, {
    ...input,
    nextStatus: "rejected",
  });
}
