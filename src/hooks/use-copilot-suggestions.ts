"use client";

import { useConfigureSuggestions } from "@copilotkit/react-core/v2";
import { useMemo } from "react";
import type { AppRole } from "@/lib/auth/session";
import type { QuickAction } from "@/types/chat";

// Single source of truth for suggestions — used both for CopilotKit's registry
// and for the UI quick action buttons. Keeping them in one place prevents the
// registry and the fallback list from drifting out of sync.
const ROLE_SUGGESTIONS: Record<AppRole, { title: string; message: string }[]> = {
  user: [
    { title: "Check balance", message: "How many annual, sick, and personal leave days do I have left?" },
    { title: "Review pending", message: "List my pending time-off requests first." },
    { title: "All requests", message: "Show all my time-off requests." },
    { title: "Leave policy", message: "What is the leave policy for annual leave carryover?" },
  ],
  manager: [
    { title: "Team pending", message: "Show my team's pending time-off requests." },
    { title: "Check balance", message: "How many annual, sick, and personal leave days do I have left?" },
    { title: "Review employees", message: "List all members in my project." },
    { title: "All requests", message: "Show all my time-off requests." },
  ],
};

/**
 * Registers role-specific suggestions via CopilotKit's registry and returns
 * them as QuickAction[] for the UI. Always derives from ROLE_SUGGESTIONS so
 * the registry and the displayed buttons are guaranteed to stay in sync — avoids
 * the flicker caused by useSuggestions resetting to isLoading=true during agent runs.
 */
export function useCopilotSuggestions(role: AppRole): QuickAction[] {
  useConfigureSuggestions(
    {
      suggestions: ROLE_SUGGESTIONS[role],
      available: "always",
      consumerAgentId: "leaveAssistant",
    },
    [role],
  );

  return useMemo(
    () => ROLE_SUGGESTIONS[role].map((s) => ({ label: s.title, prompt: s.message })),
    [role],
  );
}
