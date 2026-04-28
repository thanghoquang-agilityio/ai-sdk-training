import type { ReactNode } from "react";
import type { ToolOutputTableRow } from "@/components/chat/tool-output-table";
import { formatHumanDateRange } from "@/utils/date";
import {
  asString,
  asOptionalString,
  isRecord,
  asRecord,
  hasRenderableColumnValue,
  isNumericColumn,
  formatGenericCellValue,
  type UnknownRecord,
} from "./utils";
import {
  renderLeaveTypeChip,
  renderStatusChip,
  renderEmployeeCell,
} from "./cells";
import type { ToolOutputTableModel } from "./named-tables";
import { getFriendlyToolLabelByName } from "./tool";

export type RecordCollection = {
  path: string[];
  rows: UnknownRecord[];
};

export const GENERIC_TABLE_TITLE_BY_KEY: Record<string, string> = {
  balances: "Leave balance",
  upcomingrequests: "Upcoming requests",
  teamrequests: "Team requests",
  requests: "Requests",
  matches: "Matching requests",
  conflictingrequests: "Conflicting requests",
  records: "Records",
  items: "Items",
  rows: "Rows",
  results: "Results",
};

export const GENERIC_COLUMN_LABEL_BY_KEY: Record<string, string> = {
  id: "ID",
  employeeId: "Employee ID",
  requestId: "Request ID",
  leaveType: "Leave type",
  leaveTypeLabel: "Leave type",
  dateRange: "Date range",
};

export const STRUCTURAL_COLLECTION_KEYS = new Set([
  "records",
  "items",
  "rows",
  "results",
  "data",
  "list",
]);

export function toKebabCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function toComparableKey(value: string) {
  return value.replace(/[_\-\s]/g, "").toLowerCase();
}

export function toHumanLabel(value: string) {
  const words = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "Records";
  }

  return words
    .map((word) =>
      word.toLowerCase() === "id"
        ? "ID"
        : `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`,
    )
    .join(" ");
}

export function getCollectionTitle(path: string[], toolName: string | null) {
  if (path.length === 0) {
    return getFriendlyToolLabelByName(toolName);
  }

  const leaf = path[path.length - 1] ?? "records";
  const parent = path[path.length - 2] ?? "";
  const leafComparable = toComparableKey(leaf);

  if (
    STRUCTURAL_COLLECTION_KEYS.has(leafComparable) &&
    parent.length > 0
  ) {
    return toHumanLabel(parent);
  }

  if (
    leafComparable === "requests" &&
    path.some((segment) => toComparableKey(segment).includes("team"))
  ) {
    return "Team requests";
  }

  if (
    leafComparable === "requests" &&
    path.some((segment) => toComparableKey(segment).includes("upcoming"))
  ) {
    return "Upcoming requests";
  }

  return GENERIC_TABLE_TITLE_BY_KEY[leafComparable] ?? toHumanLabel(leaf);
}

export function getCollectionId(path: string[], toolName: string | null) {
  const segments = path.length > 0 ? path : [toolName ?? "records"];
  const id = segments.map((segment) => toKebabCase(segment)).join("-");

  return id.length > 0 ? id : "records";
}

export function collectRecordCollections(
  value: unknown,
  path: string[] = [],
  depth = 0,
): RecordCollection[] {
  if (depth > 5 || value == null) {
    return [];
  }

  if (Array.isArray(value)) {
    const rows = value.filter(isRecord);

    if (rows.length > 0 && rows.length === value.length) {
      return [{ path, rows }];
    }

    return [];
  }

  const record = asRecord(value);
  if (!record) {
    return [];
  }

  return Object.entries(record).flatMap(([key, nestedValue]) =>
    collectRecordCollections(nestedValue, [...path, key], depth + 1),
  );
}

export function getGenericTableModel(params: {
  id: string;
  title: string;
  rows: UnknownRecord[];
  emptyLabel: string;
}): ToolOutputTableModel | null {
  const discoveredKeys: string[] = [];

  for (const row of params.rows) {
    for (const key of Object.keys(row)) {
      if (!discoveredKeys.includes(key)) {
        discoveredKeys.push(key);
      }
    }
  }

  if (discoveredKeys.length === 0) {
    return null;
  }

  const selectedKeys: string[] = [];
  const includeEmployeeColumn = discoveredKeys.includes("employeeName");
  const includeLeaveTypeColumn =
    discoveredKeys.includes("leaveType") || discoveredKeys.includes("leaveTypeLabel");
  const includeDateRangeColumn =
    discoveredKeys.includes("dateRange") ||
    discoveredKeys.includes("startDate") ||
    discoveredKeys.includes("endDate");

  if (includeEmployeeColumn) selectedKeys.push("employee");
  if (includeLeaveTypeColumn) {
    selectedKeys.push(discoveredKeys.includes("leaveType") ? "leaveType" : "leaveTypeLabel");
  }
  if (includeDateRangeColumn) selectedKeys.push("dateRange");
  if (discoveredKeys.includes("status")) selectedKeys.push("status");

  const excludedKeys = new Set<string>();
  if (includeEmployeeColumn) {
    excludedKeys.add("employeeId");
    excludedKeys.add("employeeName");
    excludedKeys.add("employeeAvatar");
    excludedKeys.add("team");
  }
  if (includeLeaveTypeColumn && discoveredKeys.includes("leaveType")) {
    excludedKeys.add("leaveTypeLabel");
  }
  if (includeDateRangeColumn) {
    excludedKeys.add("startDate");
    excludedKeys.add("endDate");
    excludedKeys.add("dateRange");
  }

  for (const key of discoveredKeys) {
    if (selectedKeys.includes(key) || excludedKeys.has(key)) continue;
    if (!hasRenderableColumnValue(params.rows, key)) continue;
    selectedKeys.push(key);
  }

  if (selectedKeys.length === 0) {
    return null;
  }

  const columns = selectedKeys.map((key) => {
    if (key === "employee") {
      return { key, label: "Employee" };
    }

    if (key === "dateRange") {
      return { key, label: "Date range", className: "whitespace-nowrap" };
    }

    if (key === "status") {
      return { key, label: "Status", className: "sm:pl-2" };
    }

    const align = isNumericColumn(params.rows, key)
      ? ("center" as const)
      : ("left" as const);
    const className = isNumericColumn(params.rows, key)
      ? "font-semibold tabular-nums"
      : undefined;

    return {
      key,
      label: GENERIC_COLUMN_LABEL_BY_KEY[key] ?? toHumanLabel(key),
      align,
      className,
    };
  });

  const rows: ToolOutputTableRow[] = params.rows.map((row) => {
    const tableRow: Record<string, ReactNode> = {};

    for (const key of selectedKeys) {
      if (key === "employee") {
        tableRow[key] = renderEmployeeCell(row);
        continue;
      }

      if (key === "leaveType" || key === "leaveTypeLabel") {
        const leaveType = asString(
          row.leaveTypeLabel,
          asString(row.leaveType, asString(row.leaveTypeLabel)),
        );
        tableRow[key] = renderLeaveTypeChip(
          leaveType.trim().replace(/\s+leave$/i, "") || "—",
        );
        continue;
      }

      if (key === "dateRange") {
        const explicitDateRange = asOptionalString(row.dateRange)?.trim();
        tableRow[key] = explicitDateRange
          ? explicitDateRange
          : formatHumanDateRange(asString(row.startDate, ""), asString(row.endDate, ""));
        continue;
      }

      if (key === "status") {
        tableRow[key] = renderStatusChip(asString(row.status, ""));
        continue;
      }

      tableRow[key] = formatGenericCellValue(row[key], key);
    }

    return tableRow;
  });

  return {
    id: params.id,
    title: params.title,
    columns,
    rows,
    emptyLabel: params.emptyLabel,
  };
}

