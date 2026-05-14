import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getAvatarUrl, getInitialsFromName } from "@/utils/avatar";
import { formatHumanDateRange } from "@/utils/date";
import type { ToolOutputTableAction } from "@/components/chat/tool-output-table";
import {
  asString,
  asOptionalString,
  formatStatus,
  compactLeaveTypeLabel,
  normalizeRequestStatus,
  isFutureOrTodayDate,
  type UnknownRecord,
} from "./utils";

export function renderLeaveTypeChip(label: string) {
  return <Badge variant="info" className="px-2.5 py-0.5 text-xs">{label}</Badge>;
}

export function renderStatusChip(status: string) {
  if (!status) return "—";

  const normalizedStatus = status.toLowerCase();
  const statusVariant =
    normalizedStatus === "approved"
      ? "success"
      : normalizedStatus === "pending"
        ? "warning"
        : normalizedStatus === "rejected"
          ? "danger"
          : "neutral";

  return (
    <Badge variant={statusVariant} className="px-2.5 py-0.5 text-xs">
      {formatStatus(status)}
    </Badge>
  );
}

export function renderEmployeeCell(request: UnknownRecord) {
  const employeeName = asString(request.employeeName);
  const employeeEmail = asString(request.employeeEmail);
  const employeeTeam = asString(request.team, "");
  const employeeAvatar =
    asOptionalString(request.employeeAvatar)?.trim() ||
    getAvatarUrl(employeeEmail);

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar
        variant="user"
        src={employeeAvatar}
        alt={`${employeeName} avatar`}
        initials={getInitialsFromName(employeeName)}
        size="sm"
        className="ring-white/15"
      />

      <div className="min-w-0">
        <p className="whitespace-nowrap font-dm-sans text-sm font-semibold leading-[1.25] text-white/92">
          {employeeName}
        </p>
        {employeeTeam ? (
          <p className="mt-0.5 whitespace-nowrap font-dm-sans text-xs leading-[1.25] text-white/60">
            {employeeTeam}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function buildSelfCancelPrompt(request: UnknownRecord): string {
  const leaveType = compactLeaveTypeLabel(
    asString(request.leaveTypeLabel, asString(request.leaveType, "")),
  );
  const startDate = asOptionalString(request.startDate)?.trim() ?? "";
  const endDate = asOptionalString(request.endDate)?.trim() ?? "";
  const dateRange = formatHumanDateRange(startDate, endDate);

  if (leaveType && leaveType !== "—" && dateRange) {
    return `I'd like to cancel my ${leaveType} leave ${dateRange}.`;
  }
  return "";
}

export function buildTeamActionPrompt(
  request: UnknownRecord,
  action: "approve" | "reject",
): string {
  const name = asOptionalString(request.employeeName)?.trim() ?? "";
  const leaveType = compactLeaveTypeLabel(
    asString(request.leaveTypeLabel, asString(request.leaveType, "")),
  );
  const startDate = asOptionalString(request.startDate)?.trim() ?? "";
  const endDate = asOptionalString(request.endDate)?.trim() ?? "";
  const dateStr = startDate === endDate ? startDate : `${startDate} to ${endDate}`;
  if (!name || !leaveType || leaveType === "—" || !dateStr) return "";
  if (action === "approve") {
    return `Approve ${name} ${leaveType} leave ${dateStr}. Comment: Approved.`;
  }
  return `Reject ${name} ${leaveType} leave ${dateStr}. Reason: Not approved.`;
}

export function getSelfRequestRowActions(request: UnknownRecord): ToolOutputTableAction[] {
  const status = normalizeRequestStatus(request.status);

  if (status !== "approved" && status !== "pending") {
    return [];
  }

  if (!isFutureOrTodayDate(request.startDate)) {
    return [];
  }

  const prompt = buildSelfCancelPrompt(request)
    || "I want to cancel one of my requests. Could you list my cancellable requests so I can choose one?";

  return [
    {
      label: "Cancel request",
      prompt,
      tone: "danger",
    },
  ];
}

export function getTeamRequestRowActions(request: UnknownRecord): ToolOutputTableAction[] {
  const status = normalizeRequestStatus(request.status);

  const isFuture = isFutureOrTodayDate(request.startDate);

  if (status === "pending") {
    return [
      {
        label: "Approve",
        prompt: buildTeamActionPrompt(request, "approve") ||
          "Please approve the selected pending team request.",
        tone: "success",
      },
      {
        label: "Reject",
        prompt: buildTeamActionPrompt(request, "reject") ||
          "Please reject the selected pending team request.",
        tone: "danger",
      },
    ];
  }

  if (!isFuture) return [];

  if (status === "approved") {
    return [
      {
        label: "Reject",
        prompt: buildTeamActionPrompt(request, "reject") ||
          "Please reject the selected approved team request.",
        tone: "danger",
      },
    ];
  }

  if (status === "rejected") {
    return [
      {
        label: "Approve",
        prompt: buildTeamActionPrompt(request, "approve") ||
          "Please approve the selected rejected team request.",
        tone: "success",
      },
    ];
  }

  return [];
}

export function getBalanceRowActions(balance: UnknownRecord): ToolOutputTableAction[] {
  const leaveType = asOptionalString(balance.leaveType)?.trim().toLowerCase();
  if (!leaveType) {
    return [];
  }

  return [
    {
      label: "Request this type",
      prompt: `I want to submit a ${leaveType} time-off request.`,
      tone: "success",
    },
  ];
}

export function getMemberRowActions(member: UnknownRecord): ToolOutputTableAction[] {
  const employeeName = asOptionalString(member.employeeName)?.trim();
  if (!employeeName) return [];

  const pendingCount = typeof member.pendingCount === "number" ? member.pendingCount : 0;
  const actions: ToolOutputTableAction[] = [];

  if (pendingCount > 0) {
    actions.push({
      label: "View pending",
      prompt: `Show ${employeeName}'s pending time-off requests.`,
      tone: "neutral",
    });
  }

  actions.push({
    label: "View all",
    prompt: `Show all time-off requests for ${employeeName}.`,
    tone: "neutral",
  });

  return actions;
}

export function getRequestRowActionBuilder(toolName: string | null) {
  switch (toolName) {
    case "list_team_time_off_requests":
    case "approve_team_time_off_request":
    case "reject_team_time_off_request":
      return getTeamRequestRowActions;
    case "list_my_time_off_requests":
    case "get_my_time_off_balance":
    case "submit_my_time_off_request":
    case "cancel_my_time_off_request":
      return getSelfRequestRowActions;
    default:
      return (request: UnknownRecord) => {
        const hasEmployee = Boolean(asOptionalString(request.employeeName)?.trim());
        return hasEmployee
          ? getTeamRequestRowActions(request)
          : getSelfRequestRowActions(request);
      };
  }
}
