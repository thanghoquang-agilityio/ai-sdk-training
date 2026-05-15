"use client";

import { useInterrupt } from "@copilotkit/react-core/v2";
import type { ReactNode } from "react";
import { ConfirmActionCard } from "@/components/chat/confirm-action-card";
import type { MockAuthSession } from "@/lib/auth/session";
import { getInitialsFromName } from "@/utils/avatar";

type InterruptValue = {
  toolName: string;
  label: string;
  args: Record<string, unknown> & {
    employeeEmail?: string;
    employeeAvatar?: string;
  };
};

type UseHumanInTheLoopOptions = {
  agentId: string;
  session: MockAuthSession;
  isLoading: boolean;
  /** When false the card is suppressed (e.g. after a thread switch). */
  hasMessages: boolean;
};

/**
 * Handles the Human-In-The-Loop interrupt lifecycle.
 * Renders a ConfirmActionCard when the agent pauses for user approval,
 * and resumes the agent with the user's decision.
 * Returns null when there is no pending interrupt or there are no messages.
 */
export function useHumanInTheLoop({
  agentId,
  session,
  isLoading,
  hasMessages,
}: UseHumanInTheLoopOptions): ReactNode | null {
  const card = useInterrupt({
    agentId,
    renderInChat: false,
    render: ({ event, resolve }) => {
      const value = event.value as InterruptValue;
      return (
        <ConfirmActionCard
          toolName={value.toolName}
          label={value.label}
          args={value.args}
          employeeEmail={value.args.employeeEmail}
          employeeAvatar={value.args.employeeAvatar}
          disabled={isLoading}
          userAvatarUrl={session.avatar}
          userInitials={getInitialsFromName(session.name)}
          onApproveAction={() => resolve({ approved: true })}
          onRejectAction={() => resolve({ approved: false })}
        />
      );
    },
  });

  return hasMessages ? card : null;
}
