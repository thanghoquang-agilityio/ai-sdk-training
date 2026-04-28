import type { MockAuthSession } from "@/lib/auth/session";
import type { TimeOffRequest } from "@/lib/db/schema";
import { replaceTimeOffRequests } from "@/services/company-system/requests";
import { notifyTimeOffApproved } from "@/services/slack";
import {
  formatRequest,
  toRequestMatch,
  type TimeOffContext,
} from "./context";
import {
  applyReview,
  findTeamRequestsMatchingQuery,
} from "./queries";
import { buildTeamTimeOffRequestsPayload } from "./payload";

export type ReviewTeamRequestInput = {
  requestQuery: string;
  comment?: string;
  nextStatus: "approved" | "rejected";
  showTeamPending?: boolean;
};

function normalizeInlineWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function parseMutationRequestInput(requestQuery: string, comment?: string) {
  const extractedCommentMatch = requestQuery.match(
    /\b(?:use\s+)?(?:comment|reason)\s*:\s*[""]?([^""\n]+?)[""]?(?=$|[.?!])/i,
  );
  const extractedComment = extractedCommentMatch?.[1]?.trim();

  let normalizedQuery = requestQuery;

  const trailingInstructionPatterns = [
    /\bask for confirmation\b.*$/i,
    /\bplease confirm\b.*$/i,
    /\bbefore running\b.*$/i,
  ];

  for (const pattern of trailingInstructionPatterns) {
    normalizedQuery = normalizedQuery.replace(pattern, "");
  }

  normalizedQuery = normalizedQuery
    .replace(
      /\b(?:use\s+)?(?:comment|reason)\s*:\s*["""]?([^"""\n]+?)["""]?(?=$|[.?!])/gi,
      "",
    )
    .replace(
      /^\s*(?:please\s+)?(?:approve|reject)\s+(?:this\s+)?(?:(?:pending|approved|rejected)\s+)?(?:team\s+)?request\s*:?\s*/i,
      "",
    )
    .replace(/^\s*request\s*:?\s*/i, "");

  const sanitizedQuery = normalizeInlineWhitespace(normalizedQuery);
  const resolvedComment =
    comment?.trim() ||
    (extractedComment
      ? normalizeInlineWhitespace(extractedComment)
      : undefined);

  return {
    requestQuery: sanitizedQuery || normalizeInlineWhitespace(requestQuery),
    comment: resolvedComment,
  };
}

/**
 * withRequests helper.
 * @param {TimeOffContext} ctx
 * @param {TimeOffRequest[]} requests
 * @returns {TimeOffContext}
 */
export function withRequests(
  ctx: TimeOffContext,
  requests: TimeOffRequest[],
): TimeOffContext {
  return { ...ctx, requests };
}

/**
 * reviewTeamTimeOffRequest helper.
 * @param {MockAuthSession} session
 * @param {TimeOffContext} ctx
 * @param {ReviewTeamRequestInput} input
 */
export async function reviewTeamTimeOffRequest(
  session: MockAuthSession,
  ctx: TimeOffContext,
  input: ReviewTeamRequestInput,
) {
  const parsedInput = parseMutationRequestInput(
    input.requestQuery,
    input.comment,
  );
  const query = parsedInput.requestQuery;
  const comment = parsedInput.comment;

  if (!query) {
    return {
      ok: false,
      code: "MISSING_QUERY",
      message: `Please tell me which team request you want to ${input.nextStatus}.`,
    };
  }

  if (input.nextStatus === "rejected" && !comment) {
    return {
      ok: false,
      code: "MISSING_COMMENT",
      message: "Please provide a short reason before rejecting a request.",
    };
  }

  const allowedStatuses: ("pending" | "approved" | "rejected")[] =
    input.nextStatus === "rejected"
      ? ["pending", "approved"]
      : ["pending", "rejected"];
  const matches = findTeamRequestsMatchingQuery(
    ctx,
    session,
    query,
    allowedStatuses,
  );
  if (matches.length === 0) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message:
        "I couldn't find a pending team request that matches that description.",
    };
  }

  if (matches.length > 1) {
    return {
      ok: false,
      code: "AMBIGUOUS_REQUEST",
      message:
        "I found more than one matching pending team request. Please be more specific.",
      matches: matches.map((request) => toRequestMatch(ctx.employees, request)),
    };
  }

  const { nextRequests, updatedRequest } = applyReview(
    ctx.requests,
    matches[0].id,
    input.nextStatus,
    comment,
  );

  const persistedRequests = await replaceTimeOffRequests(nextRequests);
  const nextCtx = withRequests(ctx, persistedRequests);

  if (input.nextStatus === "approved" && updatedRequest) {
    const formatted = formatRequest(ctx.employees, updatedRequest);
    void notifyTimeOffApproved(
      formatted.employeeName,
      formatted.startDate,
      formatted.endDate,
    );
  }

  const reviewedEmployee = ctx.employees.find(
    (e) => e.employeeId === matches[0].employeeId,
  );

  if (input.showTeamPending) {
    return {
      ok: true,
      request: updatedRequest
        ? formatRequest(ctx.employees, updatedRequest)
        : null,
      reviewedEmployeeRequests: buildTeamTimeOffRequestsPayload(session, nextCtx, {
        status: input.nextStatus,
        employeeQuery: reviewedEmployee?.name,
      }),
      pendingTeamRequests: buildTeamTimeOffRequestsPayload(session, nextCtx, {
        status: "pending",
      }),
    };
  }

  return {
    ok: true,
    request: updatedRequest
      ? formatRequest(ctx.employees, updatedRequest)
      : null,
    teamRequests: buildTeamTimeOffRequestsPayload(session, nextCtx, {
      status: "all",
      employeeQuery: reviewedEmployee?.name,
    }),
  };
}
