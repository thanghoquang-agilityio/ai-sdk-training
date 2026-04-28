import type {
  ToolOutputTableAction,
  ToolOutputTableColumn,
  ToolOutputTableRow,
} from "@/components/chat/tool-output-table";
import { formatHumanDateRange } from "@/utils/date";
import { leaveTypeLabel } from "@/utils/leave";
import {
  asString,
  asNumber,
  asRecordArray,
  compactLeaveTypeLabel,
  getRequestRowSummary,
  getBalanceRowSummary,
  getMemberRowSummary,
  type UnknownRecord,
} from "./utils";
import {
  renderLeaveTypeChip,
  renderStatusChip,
  renderEmployeeCell,
  getMemberRowActions,
} from "./cells";

export type ToolOutputTableModel = {
  id: string;
  title: string;
  columns: ToolOutputTableColumn[];
  rows: ToolOutputTableRow[];
  rowActions?: ToolOutputTableAction[][];
  rowActionSummaries?: string[];
  emptyLabel: string;
};

export function buildMembersTableModel(params: {
  id: string;
  title: string;
  memberRows: UnknownRecord[];
  emptyLabel: string;
}): ToolOutputTableModel | null {
  const { memberRows } = params;

  const columns: ToolOutputTableColumn[] = [
    { key: "employee", label: "Employee", className: "sm:pr-4" },
    { key: "pendingCount", label: "Pending", align: "center", className: "font-semibold tabular-nums" },
    { key: "approvedCount", label: "Approved", align: "center", className: "font-semibold tabular-nums" },
    { key: "cancelledCount", label: "Cancelled", align: "center", className: "font-semibold tabular-nums" },
    { key: "totalCount", label: "Total", align: "center", className: "font-semibold tabular-nums" },
  ];

  const rows = memberRows.map((member) => ({
    employee: renderEmployeeCell(member),
    pendingCount: asNumber(member.pendingCount, "0"),
    approvedCount: asNumber(member.approvedCount, "0"),
    cancelledCount: asNumber(member.cancelledCount, "0"),
    totalCount: asNumber(member.totalCount, "0"),
  }));

  const rowActions = memberRows.map((member) => getMemberRowActions(member));
  const rowActionSummaries = memberRows.map((member) => getMemberRowSummary(member));

  return {
    id: params.id,
    title: params.title,
    columns,
    rows,
    rowActions,
    rowActionSummaries,
    emptyLabel: params.emptyLabel,
  };
}

export function getRequestTableModel(params: {
  id: string;
  title: string;
  payload: UnknownRecord;
  showEmployee: boolean;
  emptyLabel: string;
  getRowActions?: (request: UnknownRecord) => ToolOutputTableAction[];
}): ToolOutputTableModel | null {
  if (!Array.isArray(params.payload.requests)) {
    return null;
  }

  const columns: ToolOutputTableColumn[] = params.showEmployee
    ? [
        { key: "employee", label: "Employee", className: "sm:pr-4" },
        { key: "leaveType", label: "Leave type", align: "center" },
        {
          key: "dateRange",
          label: "Date range",
          align: "center",
          className: "whitespace-nowrap",
        },
        {
          key: "days",
          label: "Days",
          align: "center",
          className: "font-semibold tabular-nums",
        },
        { key: "status", label: "Status", align: "center" },
      ]
    : [
        { key: "leaveType", label: "Leave type", align: "center" },
        {
          key: "dateRange",
          label: "Date range",
          align: "center",
          className: "whitespace-nowrap",
        },
        {
          key: "days",
          label: "Days",
          align: "center",
          className: "font-semibold tabular-nums",
        },
        { key: "status", label: "Status", align: "center" },
      ];

  const requestRows = asRecordArray(params.payload.requests);
  const rows = requestRows.map((request) => {
    const row: ToolOutputTableRow = {
      leaveType: renderLeaveTypeChip(
        compactLeaveTypeLabel(
          asString(request.leaveTypeLabel, asString(request.leaveType)),
        ),
      ),
      dateRange: formatHumanDateRange(
        asString(request.startDate, ""),
        asString(request.endDate, ""),
      ),
      days: asNumber(request.days),
      status: renderStatusChip(asString(request.status, "")),
    };

    if (params.showEmployee) {
      row.employee = renderEmployeeCell(request);
    }

    return row;
  });

  const rowActions = params.getRowActions
    ? requestRows.map((request) => params.getRowActions?.(request) ?? [])
    : undefined;
  const rowActionSummaries = rowActions
    ? requestRows.map((request) => getRequestRowSummary(request))
    : undefined;

  return {
    id: params.id,
    title: params.title,
    columns,
    rows,
    rowActions,
    rowActionSummaries,
    emptyLabel: params.emptyLabel,
  };
}

export function getBalanceTableModel(params: {
  id: string;
  title: string;
  payload: UnknownRecord;
  emptyLabel: string;
  getRowActions?: (balance: UnknownRecord) => ToolOutputTableAction[];
}): ToolOutputTableModel | null {
  if (!Array.isArray(params.payload.balances)) {
    return null;
  }

  const columns: ToolOutputTableColumn[] = [
    { key: "leaveType", label: "Leave type", align: "center" },
    {
      key: "allowance",
      label: "Allowance",
      align: "center",
      className: "font-semibold tabular-nums",
    },
    {
      key: "used",
      label: "Used",
      align: "center",
      className: "font-semibold tabular-nums",
    },
    {
      key: "pending",
      label: "Pending",
      align: "center",
      className: "font-semibold tabular-nums",
    },
    {
      key: "remaining",
      label: "Remaining",
      align: "center",
      className: "font-semibold tabular-nums",
    },
  ];

  const balanceRows = asRecordArray(params.payload.balances);
  const rows = balanceRows.map((balance) => ({
    leaveType: renderLeaveTypeChip(
      compactLeaveTypeLabel(leaveTypeLabel(asString(balance.leaveType, "annual"))),
    ),
    allowance: asNumber(balance.allowance),
    used: asNumber(balance.used),
    pending: asNumber(balance.pending),
    remaining: asNumber(balance.remaining),
  }));

  const rowActions = params.getRowActions
    ? balanceRows.map((balance) => params.getRowActions?.(balance) ?? [])
    : undefined;
  const rowActionSummaries = rowActions
    ? balanceRows.map((balance) => getBalanceRowSummary(balance))
    : undefined;

  return {
    id: params.id,
    title: params.title,
    columns,
    rows,
    rowActions,
    rowActionSummaries,
    emptyLabel: params.emptyLabel,
  };
}
