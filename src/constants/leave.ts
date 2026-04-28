import type { LeaveType } from "@/lib/db/schema";

export const LEAVE_TYPE_LABEL_BY_TYPE: Record<LeaveType, string> = {
  annual: "Annual leave",
  sick: "Sick leave",
  personal: "Personal leave",
  unpaid: "Unpaid leave",
};

export const LEAVE_TYPE_FALLBACK_LABEL = "Time off";
