export type LeaveType = "annual" | "sick" | "personal" | "unpaid";

export type RequestStatus =
  | "pending"
  | "approved"
  | "cancelled"
  | "rejected";

export type TeamRow = {
  teamId: string;
  name: string;
};

export type EmployeeRow = {
  employeeId: string;
  name: string;
  email: string;
  avatar?: string;
  teamId: string;
  managerEmployeeId?: string | null;
  timeZone: string;
};

export type LeaveEntitlementRow = {
  employeeId: string;
  annual: number;
  sick: number;
  personal: number;
};

export type RoleProfileRow = {
  role: "user" | "manager";
  employeeId: string;
};

export type EmployeeRecord = {
  employeeId: string;
  name: string;
  email: string;
  avatar: string;
  team: string;
  manager: string;
  timeZone: string;
  entitlements: {
    annual: number;
    sick: number;
    personal: number;
  };
};

export type TimeOffRequest = {
  id: string;
  employeeId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  status: RequestStatus;
  reason: string;
  note?: string;
  reviewComment?: string;
  createdAt: string;
  updatedAt: string;
};
