"use client";

import { useCopilotAdditionalInstructions } from "@copilotkit/react-core";
import { useAgentContext } from "@copilotkit/react-core/v2";
import { useMemo } from "react";
import type { AppRole } from "@/lib/auth/session";

const ROLE_INSTRUCTIONS: Record<AppRole, string> = {
  user: "The current user is an employee. They can only manage their own leave requests. They cannot view, approve, or reject leave requests belonging to other employees.",
  manager:
    "The current user is a manager. In addition to their own leave, they can view their direct reports' leave requests and approve or reject them.",
};

/**
 * Injects role-specific behavioral instructions into both:
 * 1. CopilotKit's built-in chat system prompt (via useCopilotAdditionalInstructions)
 * 2. The AG-UI agent's input.context (via useAgentContext) so the custom agent can read them
 */
export function useCopilotRoleInstructions(role: AppRole): void {
  const instructions = ROLE_INSTRUCTIONS[role];

  useCopilotAdditionalInstructions({ instructions }, [role]);

  const agentContextValue = useMemo(
    () => ({ additionalInstructions: instructions }),
    [instructions],
  );

  useAgentContext({
    description: "Additional behavioral instructions for the leave assistant",
    value: agentContextValue,
  });
}
