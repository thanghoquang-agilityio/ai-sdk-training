"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { cn } from "@/utils/class-name";
import { formatHumanDateRange } from "@/utils/date";

type ActionMeta = {
  verb: string;
  icon: string;
  hint: string;
  badgeBg: string;
  badgeText: string;
};

const TOOL_META: Record<string, ActionMeta> = {
  submit_my_time_off_request: {
    verb: "Submit time-off request",
    icon: "↑",
    hint: "Ready to go! Once submitted, your manager will review it.",
    badgeBg: "bg-violet-500/20 border border-violet-400/25",
    badgeText: "text-violet-300",
  },
  cancel_my_time_off_request: {
    verb: "Cancel time-off request",
    icon: "✕",
    hint: "Heads up — this can't be undone. Want to go ahead?",
    badgeBg: "bg-amber-500/18 border border-amber-400/25",
    badgeText: "text-amber-300",
  },
  approve_team_time_off_request: {
    verb: "Approve time-off request",
    icon: "✓",
    hint: "The employee will be notified once you confirm.",
    badgeBg: "bg-emerald-500/18 border border-emerald-400/25",
    badgeText: "text-emerald-300",
  },
  reject_team_time_off_request: {
    verb: "Reject time-off request",
    icon: "✕",
    hint: "The employee will be notified of the decision.",
    badgeBg: "bg-red-500/18 border border-red-400/25",
    badgeText: "text-red-300",
  },
};

const HIDDEN_ARG_KEYS = new Set(["dryRun", "showTeamPending"]);

const ARG_LABEL_MAP: Record<string, string> = {
  requestQuery: "Request",
  leaveType: "Leave type",
  dateRange: "Date range",
  reason: "Reason",
  note: "Note",
  comment: "Comment",
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: "Annual",
  sick: "Sick",
  personal: "Personal",
  unpaid: "Unpaid",
};

const ISO_DATE_RE = /\b(\d{4}-\d{2}-\d{2})\b/g;

function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatArgValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (key === "leaveType" && typeof value === "string") {
    return LEAVE_TYPE_LABELS[value.toLowerCase()] ?? value.charAt(0).toUpperCase() + value.slice(1);
  }
  if (typeof value === "string") {
    return value.replace(ISO_DATE_RE, (_, iso) => formatIsoDate(iso));
  }
  return JSON.stringify(value);
}

function argLabel(key: string): string {
  return (
    ARG_LABEL_MAP[key] ??
    key
      .replace(/([A-Z])/g, " $1")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim()
  );
}

type ArgRow = { key: string; label: string; value: string };

function buildArgRows(args: Record<string, unknown>): ArgRow[] {
  const rows: ArgRow[] = [];
  const skipped = new Set(HIDDEN_ARG_KEYS);

  const hasDateRange = "startDate" in args && "endDate" in args;
  if (hasDateRange) {
    skipped.add("startDate");
    skipped.add("endDate");
  }

  for (const [key, val] of Object.entries(args)) {
    if (skipped.has(key)) continue;
    rows.push({ key, label: argLabel(key), value: formatArgValue(key, val) });
    if (key === "leaveType" && hasDateRange) {
      const range = formatHumanDateRange(
        typeof args.startDate === "string" ? args.startDate : "",
        typeof args.endDate === "string" ? args.endDate : "",
      );
      rows.push({ key: "dateRange", label: argLabel("dateRange"), value: range });
    }
  }

  return rows;
}

type ConfirmActionCardProps = {
  toolName: string;
  label: string;
  args: Record<string, unknown>;
  disabled?: boolean;
  onApproveAction: () => void | Promise<void>;
  onRejectAction: () => void | Promise<void>;
};

export function ConfirmActionCard({
  toolName,
  label,
  args,
  disabled,
  onApproveAction,
  onRejectAction,
}: ConfirmActionCardProps) {
  const meta = TOOL_META[toolName];
  const argRows = buildArgRows(args);

  return (
    <Card className="w-fit max-w-[20rem] px-4 py-4 shadow-[0_10px_26px_rgba(7,12,30,0.25)]">
      <div className="flex items-start gap-3">
        {meta && (
          <div
            className={cn(
              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
              meta.badgeBg,
              meta.badgeText,
            )}
          >
            {meta.icon}
          </div>
        )}
        <div className="min-w-0">
          <Text as="p" variant="sectionTitle" className="leading-tight">
            {meta?.verb ?? label}
          </Text>
          {meta?.hint && (
            <p className="mt-0.5 font-dm-sans text-xs leading-relaxed text-white/45">
              {meta.hint}
            </p>
          )}
        </div>
      </div>

      {argRows.length > 0 && (
        <div className="mt-3 space-y-1.5 rounded-xl border border-white/8 bg-white/4 px-3 py-2.5">
          {argRows.map(({ key, label: rowLabel, value }) => (
            <div
              key={key}
              className="flex justify-between gap-4 font-dm-sans text-xs"
            >
              <span className="shrink-0 text-white/38">{rowLabel}</span>
              <span className="break-all text-right text-white/78">{value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={onRejectAction}
          className="shrink-0 cursor-pointer font-dm-sans text-xs text-white/30 transition hover:text-white/60 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Cancel
        </button>
        <Button
          type="button"
          size="sm"
          variant="primary"
          disabled={disabled}
          onClick={onApproveAction}
        >
          Confirm
        </Button>
      </div>
    </Card>
  );
}
