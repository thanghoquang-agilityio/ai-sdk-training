import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAppRole } from "@/lib/auth/session";
import { AUTH_HEADER } from "@/constants/auth";

export function proxy(req: NextRequest) {
  const rawRole = req.headers.get(AUTH_HEADER.role)?.trim().toLowerCase();
  const resolvedRole = rawRole && isAppRole(rawRole) ? rawRole : "user";

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(AUTH_HEADER.resolvedRole, resolvedRole);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: "/api/chat",
};
