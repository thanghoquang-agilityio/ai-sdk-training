import type { LeaveType } from "@/lib/db/schema";

export type SubmitTimeOffInput = {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  note?: string;
};

export type CancelTimeOffInput = {
  requestQuery: string;
};

export type ApproveTeamRequestInput = {
  requestQuery: string;
  comment?: string;
};

export type RejectTeamRequestInput = {
  requestQuery: string;
  comment: string;
};
