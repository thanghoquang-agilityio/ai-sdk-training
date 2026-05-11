import { EventType, type BaseEvent } from "@ag-ui/core";
import type { Observer } from "rxjs";

export type AgentPhase = "routing" | "resolving_dates" | "executing" | "awaiting_dates";

export type LeaveAssistantState = {
  phase: AgentPhase;
  specialist?: "employee" | "manager";
  collectDateRangeLeaveType?: string;
};

export function emitState(observer: Observer<BaseEvent>, state: LeaveAssistantState) {
  observer.next({ type: EventType.STATE_SNAPSHOT, snapshot: state });
}
