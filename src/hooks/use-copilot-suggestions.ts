"use client";

import { useConfigureSuggestions, useSuggestions } from "@copilotkit/react-core/v2";
import { useMemo } from "react";
import type { AppRole } from "@/lib/auth/session";
import type { QuickAction } from "@/types/chat";
import { getQuickActionsByRole } from "@/constants/chat";

// Static suggestions per role, flowing through CopilotKit's suggestion registry.
// Each entry maps 1-to-1 with the QuickAction in constants/chat.ts but is read
// back at runtime via useSuggestions so downstream consumers stay decoupled from
// the hard-coded constant.
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
 * Registers role-specific suggestions via CopilotKit's suggestion registry
 * (useConfigureSuggestions) and reads them back with useSuggestions.
 * Falls back to the static quick actions list while the registry is loading.
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

  const { suggestions, isLoading } = useSuggestions({ agentId: "leaveAssistant" });

  return useMemo(() => {
    if (!isLoading && suggestions.length > 0) {
      return suggestions.map((s) => ({ label: s.title, prompt: s.message }));
    }
    // Fallback while the registry hasn't hydrated yet
    return getQuickActionsByRole(role);
  }, [suggestions, isLoading, role]);
}
