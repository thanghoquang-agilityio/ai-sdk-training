import "server-only";

import {
  COMPANY_SYSTEM_COPY,
  COMPANY_SYSTEM_DEFAULT_BASE_URL,
} from "@/constants/db";

function getBaseUrl() {
  return (
    process.env.COMPANY_SYSTEM_BASE_URL?.trim().replace(/\/+$/, "") ||
    COMPANY_SYSTEM_DEFAULT_BASE_URL
  );
}

export function cloneRows<T>(rows: T[]): T[] {
  return rows.map((row) => ({ ...row }));
}

export async function request<T>(
  pathname: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${pathname}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `${COMPANY_SYSTEM_COPY.requestFailedPrefix} (${response.status} ${response.statusText}) on ${pathname}: ${errorBody || COMPANY_SYSTEM_COPY.noResponseBody}`,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
