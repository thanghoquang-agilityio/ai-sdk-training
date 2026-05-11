import { isToolUIPart, type UIMessage } from "ai";
import { CHAT_TRANSCRIPT_COPY } from "@/constants/chat";
import type { MessageMetadata } from "@/agents/chat-core";
import { formatHumanDateRange } from "@/utils/date";
import {
  asRecord,
  asString,
  asOptionalString,
  compactLeaveTypeLabel,
} from "./utils";

export const TOOL_STATUS_TONE_CLASS: Record<"success" | "error" | "neutral", string> = {
  error:   "border border-rose-400/28 bg-rose-500/12 text-rose-200 font-dm-sans shadow-[0_8px_20px_rgba(90,12,36,0.24)]",
  success: "border border-emerald-400/28 bg-emerald-500/12 text-emerald-100 font-dm-sans shadow-[0_8px_20px_rgba(8,70,42,0.22)]",
  neutral: "border border-white/10 bg-white/7 text-white/72 font-dm-sans shadow-[0_8px_20px_rgba(7,12,30,0.2)]",
};

export const TOOL_FRIENDLY_LABEL_BY_NAME: Record<string, string> = {
  get_my_time_off_balance: "My leave balance",
  list_my_time_off_requests: "My time-off requests",
  list_employees: "All employees",
  list_team_members: "Team members",
  list_team_time_off_requests: "Team time-off requests",
  submit_my_time_off_request: "Submit time-off request",
  cancel_my_time_off_request: "Cancel time-off request",
  approve_team_time_off_request: "Approve team request",
  reject_team_time_off_request: "Reject team request",
};

export function getToolParts(message: UIMessage) {
  const toolParts = message.parts.filter((part) => isToolUIPart(part));

  return Array.from(
    new Map(
      toolParts.map((part, index) => [part.toolCallId ?? `tool-${index}`, part]),
    ).values(),
  );
}

export function humanizeToolName(toolName: string) {
  return toolName
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getFriendlyToolLabelByName(toolName: string | null) {
  if (!toolName) return CHAT_TRANSCRIPT_COPY.toolFallbackLabel;
  return TOOL_FRIENDLY_LABEL_BY_NAME[toolName] ?? humanizeToolName(toolName);
}

export function getToolName(part: UIMessage["parts"][number]) {
  if (!isToolUIPart(part)) return null;

  return part.type === "dynamic-tool"
    ? part.toolName
    : part.type.replace("tool-", "");
}

export function getToolStepText(part: UIMessage["parts"][number]) {
  if (!isToolUIPart(part)) return null;

  switch (part.state) {
    case "input-streaming":
    case "input-available":
    case "output-available":
    case "output-error":
      return `Call tool: ${getFriendlyToolLabelByName(getToolName(part))}`;
    default:
      return null;
  }
}


export function getToolStatusCopy(part: UIMessage["parts"][number]) {
  if (!isToolUIPart(part)) {
    return null;
  }

  const toolName = getToolName(part);
  const shortLabel = getFriendlyToolLabelByName(toolName);

  switch (part.state) {
    case "output-error":
      return null;
    case "output-available":
      return null;
    default:
      return null;
  }
}

export type MutationSuccessCard = {
  key: string;
  title: string;
  employeeName: string;
  employeeAvatar?: string;
  team?: string;
  leaveTypeLabel: string;
  dateRange: string;
  days: number;
  rawStatus: string;
  reviewComment?: string;
};

export function getMutationSuccessCard(part: UIMessage["parts"][number]) {
  if (!isToolUIPart(part) || part.state !== "output-available") {
    return null;
  }

  const output = asRecord(part.output);
  if (!output || output.ok !== true) {
    return null;
  }

  const request = asRecord(output.request);
  if (!request) {
    return null;
  }

  const toolName = getToolName(part);

  let title: string;
  if (toolName === "approve_team_time_off_request") title = "Request approved";
  else if (toolName === "reject_team_time_off_request") title = "Request rejected";
  else if (toolName === "cancel_my_time_off_request") title = "Request cancelled";
  else if (toolName === "submit_my_time_off_request") title = "Request submitted";
  else return null;

  const employeeName = asString(request.employeeName, "Employee");
  const employeeAvatar = asOptionalString(request.employeeAvatar)?.trim() || undefined;
  const team = asOptionalString(request.team)?.trim() || undefined;
  const label = compactLeaveTypeLabel(
    asString(request.leaveTypeLabel, asString(request.leaveType, "Leave")),
  );
  const dateRange = formatHumanDateRange(
    asString(request.startDate, ""),
    asString(request.endDate, ""),
  );
  const days =
    typeof request.days === "number" && Number.isFinite(request.days)
      ? (request.days as number)
      : 0;
  const rawStatus = asString(request.status, "");
  const reviewComment = asOptionalString(request.reviewComment)?.trim() || undefined;

  return {
    title,
    employeeName,
    employeeAvatar,
    team,
    leaveTypeLabel: label,
    dateRange,
    days,
    rawStatus,
    reviewComment,
  };
}

export function readMessageMeta(message: UIMessage) {
  if (!message.metadata || typeof message.metadata !== "object") {
    return null;
  }

  const metadata = message.metadata as Partial<MessageMetadata>;

  return {
    agent: metadata.agent ?? CHAT_TRANSCRIPT_COPY.defaultAgentName,
    agentLabel: metadata.agentLabel ?? CHAT_TRANSCRIPT_COPY.defaultAgentLabel,
  };
}

export function getAssistantInitials(message: UIMessage) {
  const metadata = readMessageMeta(message);
  const badgeMap = CHAT_TRANSCRIPT_COPY.assistantBadgeByAgent;
  const agent = metadata?.agent;

  if (agent && agent in badgeMap) {
    return badgeMap[agent as keyof typeof badgeMap];
  }

  return badgeMap[CHAT_TRANSCRIPT_COPY.defaultAgentName];
}
