import { EventType, type BaseEvent, type CustomEvent } from "@ag-ui/core";
import type { Observer } from "rxjs";
import type { LanguageModel } from "ai";
import type { MockAuthSession } from "@/lib/auth/session";

export type AgentRunContext = {
  session: MockAuthSession;
  model: LanguageModel;
  additionalInstructions?: string;
};

export type AgentPhase = "routing" | "resolving_dates" | "executing" | "awaiting_dates" | "awaiting_confirmation";

export type PendingToolCall = {
  name: string;
  args: Record<string, unknown>;
  specialist: "employee" | "manager";
  label: string;
};

export type LeaveAssistantState = {
  phase: AgentPhase;
  specialist?: "employee" | "manager";
  collectDateRangeLeaveType?: string;
  pendingTool?: PendingToolCall;
};

export function emitState(observer: Observer<BaseEvent>, state: LeaveAssistantState) {
  observer.next({ type: EventType.STATE_SNAPSHOT, snapshot: state });
}

export function emitInterrupt(
  observer: Observer<BaseEvent>,
  specialist: "employee" | "manager",
  pending: Omit<PendingToolCall, "specialist">,
) {
  emitState(observer, {
    phase: "awaiting_confirmation",
    specialist,
    pendingTool: { ...pending, specialist },
  });
  observer.next({
    type: EventType.CUSTOM,
    name: "on_interrupt",
    value: { toolName: pending.name, args: pending.args, label: pending.label },
  } as CustomEvent);
}
