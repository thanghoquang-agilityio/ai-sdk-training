import assert from "node:assert/strict";
import test from "node:test";
import {
  countBusinessDays,
  formatDateRange,
  isIsoDateOnly,
  parseIsoDateToUtcDay,
  utcDayToIsoDate,
} from "@/agents/handlers/common/date";

test("accepts strict ISO date-only format", () => {
  assert.equal(isIsoDateOnly("2026-04-23"), true);
  assert.equal(isIsoDateOnly("2026-4-23"), false);
  assert.equal(isIsoDateOnly("23-04-2026"), false);
});

test("round-trips UTC day conversion", () => {
  const utcDay = parseIsoDateToUtcDay("2026-04-23");
  assert.ok(Number.isFinite(utcDay));
  assert.equal(utcDayToIsoDate(utcDay), "2026-04-23");
});

test("counts only weekdays", () => {
  // 2026-04-20 (Mon) -> 2026-04-26 (Sun) => 5 weekdays
  const monday = parseIsoDateToUtcDay("2026-04-20");
  const sunday = parseIsoDateToUtcDay("2026-04-26");
  assert.equal(countBusinessDays(monday, sunday), 5);
});

test("formats same-day and range labels", () => {
  assert.equal(formatDateRange("2026-04-23", "2026-04-23"), "2026-04-23");
  assert.equal(
    formatDateRange("2026-04-23", "2026-04-24"),
    "2026-04-23 to 2026-04-24",
  );
});
