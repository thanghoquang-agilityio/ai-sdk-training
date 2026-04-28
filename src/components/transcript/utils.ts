import { parseIsoDateUtc, formatDateWithYear, formatHumanDateRange } from "@/utils/date";
import { leaveTypeLabel } from "@/utils/leave";

export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function asRecord(value: unknown): UnknownRecord | null {
  return isRecord(value) ? value : null;
}

export function asRecordArray(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

export function asOptionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

export function asString(value: unknown, fallback = "—") {
  return typeof value === "string" ? value : fallback;
}

export function asNumber(value: unknown, fallback = "—") {
  return typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : fallback;
}

export function formatStatus(status: string) {
  if (!status) return "—";
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function compactLeaveTypeLabel(label: string) {
  const normalized = label.trim();
  if (!normalized) return "—";

  return normalized.replace(/\s+leave$/i, "");
}

export function normalizeRequestStatus(status: unknown) {
  return asString(status, "").trim().toLowerCase();
}

export function buildRequestQueryText(request: UnknownRecord) {
  const leaveType = compactLeaveTypeLabel(
    asString(request.leaveTypeLabel, asString(request.leaveType, "")),
  );

  const startDate = asOptionalString(request.startDate)?.trim();
  const endDate = asOptionalString(request.endDate)?.trim();
  const datePart = startDate && endDate && startDate !== endDate
    ? `${startDate} ${endDate}`
    : startDate || endDate || null;

  const parts = [
    asOptionalString(request.employeeName)?.trim(),
    leaveType && leaveType !== "—" ? leaveType : null,
    datePart,
  ].filter((part): part is string => Boolean(part));

  return parts.join(" ").trim();
}

export function getRequestRowSummary(request: UnknownRecord) {
  const employeeName = asOptionalString(request.employeeName)?.trim();
  const leaveType = compactLeaveTypeLabel(
    asString(request.leaveTypeLabel, asString(request.leaveType, "")),
  );
  const dateRange = formatHumanDateRange(
    asString(request.startDate, ""),
    asString(request.endDate, ""),
  );

  return [employeeName, leaveType && leaveType !== "—" ? leaveType : null, dateRange]
    .filter((part): part is string => Boolean(part))
    .join(" • ");
}

export function getBalanceRowSummary(balance: UnknownRecord) {
  const leaveType = compactLeaveTypeLabel(
    leaveTypeLabel(asString(balance.leaveType, "annual")),
  );
  const remaining = asNumber(balance.remaining, "");

  return remaining
    ? `${leaveType} • Remaining ${remaining}`
    : leaveType;
}

export function getMemberRowSummary(member: UnknownRecord) {
  return asOptionalString(member.employeeName)?.trim() ?? "";
}

export function isFutureOrTodayDate(dateStr: unknown): boolean {
  if (typeof dateStr !== "string" || !dateStr.trim()) return false;
  const start = parseIsoDateUtc(dateStr.trim());
  if (!start) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return start >= today;
}

export function isPrimitiveValue(value: unknown): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

export function canRenderCellValue(value: unknown) {
  if (isPrimitiveValue(value)) return true;
  return Array.isArray(value) && value.every((item) => isPrimitiveValue(item));
}

export function hasRenderableColumnValue(rows: UnknownRecord[], key: string) {
  return rows.some((row) => {
    const value = row[key];
    if (value === undefined || value === null || value === "") {
      return false;
    }

    return canRenderCellValue(value);
  });
}

export function isNumericColumn(rows: UnknownRecord[], key: string) {
  if (GENERIC_NUMERIC_COLUMN_KEY_REGEX.test(key)) {
    return true;
  }

  const values = rows
    .map((row) => row[key])
    .filter((value) => value !== null && value !== undefined && value !== "");

  if (values.length === 0) {
    return false;
  }

  return values.every((value) => typeof value === "number" && Number.isFinite(value));
}

export const GENERIC_NUMERIC_COLUMN_KEY_REGEX =
  /(^|_)(count|total|days?|allowance|used|pending|remaining|hours?)$/i;

export function formatGenericCellValue(value: unknown, key: string) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "—";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim();
    if (!normalizedValue) return "—";

    if (key.toLowerCase().endsWith("date")) {
      const parsedDate = parseIsoDateUtc(normalizedValue);
      if (parsedDate) {
        return formatDateWithYear(parsedDate);
      }
    }

    return normalizedValue;
  }

  if (Array.isArray(value)) {
    const primitiveItems = value.filter((item) => isPrimitiveValue(item));
    if (primitiveItems.length === value.length) {
      const joinedValue = primitiveItems
        .map((item) => (item === null ? "—" : String(item)))
        .join(", ");

      return joinedValue.length > 0 ? joinedValue : "—";
    }
  }

  return "—";
}

export function isBalanceLikeRecord(row: UnknownRecord) {
  return (
    "leaveType" in row &&
    "allowance" in row &&
    "used" in row &&
    "pending" in row &&
    "remaining" in row
  );
}

export function isRequestLikeRecord(row: UnknownRecord) {
  const hasLeaveType = "leaveType" in row || "leaveTypeLabel" in row;
  const hasDateRange = "dateRange" in row || "startDate" in row || "endDate" in row;
  const hasStatus = "status" in row;

  return hasLeaveType && hasDateRange && hasStatus;
}
