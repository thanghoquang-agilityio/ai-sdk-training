import "server-only";

import { COMPANY_SYSTEM_ENDPOINT_PATH } from "@/constants/db";
import type { TimeOffRequest } from "@/lib/db/schema";
import { cloneRows, request } from "@/services/company-system/client";

function isTimeOffRequest(value: unknown): value is TimeOffRequest {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TimeOffRequest>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.employeeId === "string" &&
    typeof candidate.leaveType === "string" &&
    typeof candidate.startDate === "string" &&
    typeof candidate.endDate === "string" &&
    typeof candidate.days === "number" &&
    typeof candidate.status === "string" &&
    typeof candidate.reason === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string"
  );
}

async function createRequest(nextRequest: TimeOffRequest) {
  return request<TimeOffRequest>(
    COMPANY_SYSTEM_ENDPOINT_PATH.timeOffRequests,
    {
      method: "POST",
      body: JSON.stringify(nextRequest),
    },
  );
}

async function updateRequest(nextRequest: TimeOffRequest) {
  return request<TimeOffRequest>(
    `${COMPANY_SYSTEM_ENDPOINT_PATH.timeOffRequests}/${encodeURIComponent(nextRequest.id)}`,
    {
      method: "PUT",
      body: JSON.stringify(nextRequest),
    },
  );
}

async function deleteRequest(requestId: string) {
  return request<void>(
    `${COMPANY_SYSTEM_ENDPOINT_PATH.timeOffRequests}/${encodeURIComponent(requestId)}`,
    {
      method: "DELETE",
    },
  );
}

export async function listTimeOffRequests(): Promise<TimeOffRequest[]> {
  const rows = await request<unknown[]>(
    COMPANY_SYSTEM_ENDPOINT_PATH.timeOffRequests,
  );
  return cloneRows(rows.filter(isTimeOffRequest));
}

export async function replaceTimeOffRequests(
  requests: TimeOffRequest[],
): Promise<TimeOffRequest[]> {
  const nextRequests = cloneRows(requests.filter(isTimeOffRequest));
  const existingRequests = await listTimeOffRequests();
  const existingRequestById = new Map(
    existingRequests.map((r) => [r.id, r]),
  );
  const nextRequestIdSet = new Set(nextRequests.map((r) => r.id));

  const writeOps = nextRequests.map((r) =>
    existingRequestById.has(r.id) ? updateRequest(r) : createRequest(r),
  );
  const deleteOps = existingRequests
    .filter((r) => !nextRequestIdSet.has(r.id))
    .map((r) => deleteRequest(r.id));

  await Promise.all([...writeOps, ...deleteOps]);

  return nextRequests;
}
