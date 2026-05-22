import {
  CopilotRuntime,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { LeaveAssistantAgent } from "@/agents/core/agent";
import { AUTH_HEADER } from "@/constants/auth";
import { isAppRole } from "@/lib/auth/session";

export const runtime = "nodejs";

const copilotRuntime = new CopilotRuntime({
  agents: {
    leaveAssistant: new LeaveAssistantAgent(),
  },
});

const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
  runtime: copilotRuntime,
  endpoint: "/api/copilotkit",
});

// Proxy middleware resolves x-auth-role → x-resolved-role before this handler runs.
// Reject requests where the resolved role is missing or unrecognised.
function guardRole(req: NextRequest): NextResponse | null {
  const resolvedRole = req.headers.get(AUTH_HEADER.resolvedRole);
  if (!resolvedRole || !isAppRole(resolvedRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export function GET(req: NextRequest) {
  return guardRole(req) ?? handleRequest(req);
}

export function POST(req: NextRequest) {
  return guardRole(req) ?? handleRequest(req);
}
