import type { LeaveType } from "@/lib/db/schema";
import {
  LEAVE_TYPE_FALLBACK_LABEL,
  LEAVE_TYPE_LABEL_BY_TYPE,
} from "@/constants/leave";

export function leaveTypeLabel(value: LeaveType | string): string {
  return LEAVE_TYPE_LABEL_BY_TYPE[value as keyof typeof LEAVE_TYPE_LABEL_BY_TYPE] ?? LEAVE_TYPE_FALLBACK_LABEL;
}
