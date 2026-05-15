"use client";

import { useCopilotReadable as useCKReadable } from "@copilotkit/react-core";
import type { AppRole, MockAuthSession } from "@/lib/auth/session";

/**
 * Makes the current user session readable to the leave assistant agent.
 * The data is forwarded via CopilotKit's context array (input.context) so the
 * agent can reference it when building prompts or routing decisions.
 */
export function useCopilotReadable(session: MockAuthSession, role: AppRole): void {
  useCKReadable({
    description: "Current authenticated user profile and access role",
    value: {
      name: session.name,
      email: session.email,
      employeeId: session.employeeId,
      role,
      roleLabel: session.roleLabel,
      team: session.team,
      manager: session.manager,
      timezone: session.timeZone,
    },
  });
}
