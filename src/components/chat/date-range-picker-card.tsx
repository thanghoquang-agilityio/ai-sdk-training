"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { cn } from "@/utils/class-name";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
// Monday-first week headers; Sa/Su (indices 5-6) always dimmed.
const WEEK_HEADERS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

// Mirrors DATE_PICKER_TIME_SLOT from the reference.
type TimeSlot = "all_day" | "morning" | "afternoon";

// Mirrors DATE_PICKER_RANGE_SELECTION.
type RangeSelection = "start" | "end";

// Two pressable slot options (mirrors TIME_SLOT_OPTIONS).
const SLOT_OPTIONS = [
  { label: "Morning", value: "morning" as const },
  { label: "Afternoon", value: "afternoon" as const },
];

// Work-schedule boundaries used in calculateLeaveDays (mirrors WORK_HOURS in date.ts).
const WORK_SHIFTS = [
  { startH: 8, startM: 0, endH: 12, endM: 0 }, // morning block: 4 h
  { startH: 13, startM: 30, endH: 17, endM: 30 }, // afternoon block: 4 h
] as const;
const HOURS_PER_DAY = 8;

function buildIso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function getTodayIso(): string {
  const n = new Date();
  return buildIso(n.getFullYear(), n.getMonth(), n.getDate());
}

function isWeekend(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 0 || dow === 6;
}

function getNextWorkingDay(fromIso: string): string {
  const d = new Date(fromIso + "T00:00:00");
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return buildIso(d.getFullYear(), d.getMonth(), d.getDate());
}

function buildCalendarGrid(year: number, month: number): (string | null)[] {
  const firstDow = new Date(year, month, 1).getDay(); // 0 = Sun
  const offset = (firstDow + 6) % 7; // Mon-first offset
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (string | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(buildIso(year, month, d));
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

// "Apr 29" — mirrors formatDateWithWeekday (short form, current-year only).
function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// Calendar days between two ISO dates (inclusive) — mirrors getInclusiveDaysInRange.
// Counts ALL calendar days, not just workdays; used to detect single vs multi-day.
function getInclusiveDays(start: string | null, end: string | null): number {
  if (!start) return 0;
  if (!end) return 1; // single-day selection
  const s = new Date(start + "T00:00:00").getTime();
  const e = new Date(end + "T00:00:00").getTime();
  return Math.floor((e - s) / (24 * 60 * 60 * 1000)) + 1;
}

// Apply slot-based time boundaries to an ISO date string — mirrors applyTimeSlotsToRange.
// start boundary: all_day|morning → 08:00, afternoon → 13:30
// end boundary: all_day|afternoon → 17:30, morning → 12:00
function applySlotTime(
  isoDate: string,
  slot: TimeSlot,
  boundary: "start" | "end",
): Date {
  const d = new Date(isoDate + "T00:00:00");
  if (boundary === "start") {
    slot === "afternoon" ? d.setHours(13, 30, 0, 0) : d.setHours(8, 0, 0, 0);
  } else {
    slot === "morning" ? d.setHours(12, 0, 0, 0) : d.setHours(17, 30, 0, 0);
  }
  return d;
}

// Exact port of calculateLeaveDays from date.ts:
// sums work-shift overlap hours for every weekday in [start, end], divides by 8.
function calculateLeaveDays(start: Date, end: Date): number {
  if (end <= start) return 0;

  let totalHours = 0;
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);

  while (cur <= end) {
    if (cur.getDay() !== 0 && cur.getDay() !== 6) {
      for (const shift of WORK_SHIFTS) {
        const shiftStart = new Date(cur);
        shiftStart.setHours(shift.startH, shift.startM, 0, 0);
        const shiftEnd = new Date(cur);
        shiftEnd.setHours(shift.endH, shift.endM, 0, 0);
        const overlapMs = Math.max(
          0,
          Math.min(end.getTime(), shiftEnd.getTime()) -
            Math.max(start.getTime(), shiftStart.getTime()),
        );
        totalHours += overlapMs / (1000 * 60 * 60);
      }
    }
    cur.setDate(cur.getDate() + 1);
  }

  return Number((totalHours / HOURS_PER_DAY).toFixed(2));
}

// Mirrors calculateRangeDaysOff from utils.ts.
// For single-day (no end): end slot mirrors start slot (matches effectiveRangeEndTimeSlot logic).
function computeDaysOff(
  start: string | null,
  end: string | null,
  startSlot: TimeSlot,
  endSlot: TimeSlot,
): number {
  if (!start) return 0;
  const effectiveEnd = end ?? start;
  // Single-day: end-slot mirrors start-slot (reference: effectiveRangeEndTimeSlot = rangeStartTimeSlot).
  const effectiveEndSlot: TimeSlot = end ? endSlot : startSlot;
  const startDate = applySlotTime(start, startSlot, "start");
  const endDate = applySlotTime(effectiveEnd, effectiveEndSlot, "end");
  return calculateLeaveDays(startDate, endDate);
}

// Mirrors formatDaysOff from date.ts (without the startTime half-day special case,
// which is only used in calendar event contexts, not the picker summary).
function formatDaysOff(days: number): string {
  const n =
    days % 1 === 0 ? days.toString() : Number(days.toFixed(1)).toString();
  return `${n} day${days === 1 ? "" : "s"} off`;
}

// For multi-day ranges: MORNING is invalid for the start boundary (you can only
// set AFTERNOON or leave it ALL_DAY); AFTERNOON is invalid for the end boundary.
// Mirrors getBlockedMultiDaySlot.
function getBlockedSlot(selection: RangeSelection): "morning" | "afternoon" {
  return selection === "start" ? "morning" : "afternoon";
}

// Mirrors getNextSlot: pressing the currently-active half-slot reverts to all_day.
function getNextSlot(
  pressed: "morning" | "afternoon",
  current: TimeSlot,
): TimeSlot {
  return current === pressed ? "all_day" : pressed;
}

type DateRangePickerCardProps = {
  onSubmit: (message: string) => void;
  disabled?: boolean;
};

export function DateRangePickerCard({
  onSubmit,
  disabled,
}: DateRangePickerCardProps) {
  const [today] = useState(getTodayIso);
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth();

  // Calendar navigation.
  const [viewYear, setViewYear] = useState(curYear);
  const [viewMonth, setViewMonth] = useState(curMonth);

  // Date selection state — mirrors tempRange in useDatePickerDraftState.
  // endDate = null means single-day (mirrors getDraftRangeValue nullifying equal-day end).
  const [startDate, setStartDate] = useState<string | null>(() =>
    getNextWorkingDay(today),
  );
  const [endDate, setEndDate] = useState<string | null>(null);

  // Time slot state — mirrors rangeStartTimeSlot / rangeEndTimeSlot.
  const [rangeStartSlot, setRangeStartSlot] = useState<TimeSlot>("all_day");
  const [rangeEndSlot, setRangeEndSlot] = useState<TimeSlot>("all_day");

  // Which boundary the slot buttons are currently editing — mirrors activeRangeSelection.
  const [activeSelection, setActiveSelection] =
    useState<RangeSelection>("start");

  const grid = useMemo(
    () => buildCalendarGrid(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  // Derived selection geometry.
  const selectedDays = getInclusiveDays(startDate, endDate); // calendar days, not workdays
  const isMultiDay = selectedDays > 1; // true only when endDate is set & different
  const canGoPrev =
    viewYear > curYear || (viewYear === curYear && viewMonth > curMonth);
  const canConfirm = selectedDays > 0; // single-day or range both valid

  // The slot that the slot buttons are currently reflecting — mirrors tempTimeSlot.
  const activeBoundarySlot: TimeSlot = isMultiDay
    ? activeSelection === "start"
      ? rangeStartSlot
      : rangeEndSlot
    : rangeStartSlot;

  // Days-off value for the summary.
  const daysOff = computeDaysOff(
    startDate,
    endDate,
    rangeStartSlot,
    rangeEndSlot,
  );

  // Summary texts — mirrors summaryDateText / summaryValueText.
  // summaryDate always shows the start date (reference code returns startDate||endDate for both branches).
  const summaryDateText: string | null = startDate ? fmtDate(startDate) : null;
  const summaryValueText: string | null = (() => {
    if (!startDate) return null;
    if (!isMultiDay) {
      if (rangeStartSlot === "morning") return "Morning";
      if (rangeStartSlot === "afternoon") return "Afternoon";
      return formatDaysOff(1); // "1 day off"
    }
    return formatDaysOff(daysOff);
  })();

  function resetSlots() {
    setRangeStartSlot("all_day");
    setRangeEndSlot("all_day");
  }

  function goMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) {
      m = 11;
      y--;
    }
    if (m > 11) {
      m = 0;
      y++;
    }
    if (y < curYear || (y === curYear && m < curMonth)) return;
    setViewYear(y);
    setViewMonth(m);
  }

  // Mirrors useDatePickerDisabledDates.isDateDisabledByProp + rangeDisabledDates.
  function isDateDisabled(iso: string): boolean {
    if (iso < today) return true;
    if (isWeekend(iso)) return true;
    // Range-end constraint: when picking end from a MORNING single-day start,
    // dates after start are disabled (MORNING implies same-day half-day only).
    // Mirrors rangeEndConstraint === "disable_after_start".
    if (
      startDate &&
      !endDate &&
      rangeStartSlot === "morning" &&
      iso > startDate
    ) {
      return true;
    }
    return false;
  }

  // Mirrors useDatePickerRangeSelection.handleRangeChange, adapted for direct clicks.
  function handleDay(iso: string) {
    if (disabled || isDateDisabled(iso)) return;

    const hadStart = startDate !== null;
    const hadEnd = endDate !== null;

    //   Mirrors: isStartingNewCycle when hadEnd && hasStart && !hasEnd.
    if (hadStart && hadEnd) {
      setStartDate(iso);
      setEndDate(null);
      resetSlots();
      setActiveSelection("start");
      return;
    }

    if (!hadStart) {
      setStartDate(iso);
      setEndDate(null);
      resetSlots();
      setActiveSelection("start");
      return;
    }

    const prevStart = startDate!;

    // Same date → single-day already confirmed, no-op.
    if (iso === prevStart) return;

    // Clicked before start → replace with new single-day start (reset all slots).
    // Mirrors: isReplacingExistingSingleDaySelection → all slots → ALL_DAY.
    if (iso < prevStart) {
      setStartDate(iso);
      setEndDate(null);
      resetSlots();
      setActiveSelection("start");
      return;
    }

    // Clicked after start → extend to multi-day range.
    // Mirrors: isExtendingSingleDaySelectionToRange → keep start slot, reset end slot,
    // activeRangeSelection → "end".
    setEndDate(iso);
    setRangeEndSlot("all_day"); // end slot always starts fresh
    setActiveSelection("end");
  }

  function handleClear() {
    setStartDate(null);
    setEndDate(null);
    resetSlots();
    setActiveSelection("start");
  }

  // Mirrors useDatePickerTimeSlot.handleSelectTimeSlot.
  function handleSelectTimeSlot(slot: "morning" | "afternoon") {
    if (selectedDays <= 0) return;

    // Blocked slot guard (mirrors getBlockedMultiDaySlot).
    if (isMultiDay && getBlockedSlot(activeSelection) === slot) return;

    // Toggle logic: same slot → all_day (mirrors getNextSlot).
    const nextSlot = getNextSlot(slot, activeBoundarySlot);

    if (!isMultiDay) {
      setRangeStartSlot(nextSlot);
    } else if (activeSelection === "start") {
      setRangeStartSlot(nextSlot);
    } else {
      setRangeEndSlot(nextSlot);
    }
  }

  // Mirrors isTimeSlotDisabled.
  function isSlotDisabled(slot: "morning" | "afternoon"): boolean {
    if (selectedDays <= 0) return true;
    if (!isMultiDay) return false;
    return getBlockedSlot(activeSelection) === slot;
  }

  // Mirrors resolveHalfSelectionSlot from useDatePickerCalendarConfig.
  function getCellHalfSlot(iso: string): TimeSlot | null {
    const isStart = iso === startDate;
    const isEnd = iso === endDate;
    if (!isStart && !isEnd) return null;
    if (!isMultiDay) {
      // Single-day: start cell reflects rangeStartSlot.
      return isStart ? rangeStartSlot : null;
    }
    if (isStart) return rangeStartSlot;
    if (isEnd) return rangeEndSlot;
    return null;
  }

  function handleConfirm() {
    if (!startDate) return;

    if (!endDate) {
      // Single-day submission.
      if (rangeStartSlot !== "all_day") {
        onSubmit(`${rangeStartSlot} of ${startDate}`);
      } else {
        onSubmit(`${startDate} to ${startDate}`);
      }
      return;
    }

    // Multi-day: encode half-day boundaries as text for the agent.
    const startPart =
      rangeStartSlot === "afternoon" ? `afternoon of ${startDate}` : startDate;
    const endPart =
      rangeEndSlot === "morning" ? `morning of ${endDate}` : endDate;
    onSubmit(`${startPart} to ${endPart}`);
  }

  return (
    <Card className="w-fit max-w-full px-4 py-3 shadow-[0_10px_26px_rgba(7,12,30,0.25)]">
      <Text as="p" variant="sectionTitle">
        Select dates
      </Text>

      {/* Month navigation — bordered square buttons matching calendarNavButton style */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => goMonth(-1)}
          disabled={!canGoPrev || disabled}
          className="flex h-7 w-7 items-center justify-center rounded border border-white/16 text-white/60 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>
        <span className="font-dm-sans text-sm font-bold text-white">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => goMonth(1)}
          disabled={disabled}
          className="flex h-7 w-7 items-center justify-center rounded border border-white/16 text-white/60 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>
      </div>

      {/* Calendar grid */}
      <div className="mt-2 grid grid-cols-7">
        {WEEK_HEADERS.map((h, i) => (
          <div
            key={`hdr-${i}`}
            className={cn(
              "py-1 text-center font-dm-sans text-xs font-bold uppercase tracking-wide",
              i >= 5 ? "text-white/18" : "text-white/40",
            )}
          >
            {h}
          </div>
        ))}

        {grid.map((iso, idx) => {
          if (!iso) return <div key={`e-${idx}`} />;

          const isDisabledCell = isDateDisabled(iso);
          const isWknd = isWeekend(iso);
          const isStart = iso === startDate;
          const isEnd = iso === endDate;
          const isSelected = isStart || isEnd;
          const isToday = iso === today;
          const inRange =
            isMultiDay && iso > startDate! && iso < endDate! && !isWknd;

          // Half-day slot for this cell (null → no half-day visual).
          const halfSlot = getCellHalfSlot(iso);
          const showHalf = isSelected && !!halfSlot && halfSlot !== "all_day";

          return (
            <div
              key={iso}
              className="relative flex h-8 w-full items-center justify-center"
            >
              {inRange && (
                <div className="absolute top-0.5 bottom-0.5 left-0 right-0 bg-white/20 rounded-none" />
              )}
              {/* Right-half band extending from start pill into the range */}
              {isStart && isMultiDay && (
                <div className="absolute top-0.5 bottom-0.5 left-1/2 right-0 bg-white/20" />
              )}
              {/* Left-half band extending from range into end pill */}
              {isEnd && isMultiDay && (
                <div className="absolute top-0.5 bottom-0.5 left-0 right-1/2 bg-white/20" />
              )}

              {/* Day button */}
              <button
                type="button"
                onClick={() => handleDay(iso)}
                disabled={disabled || isDisabledCell}
                className={cn(
                  "relative z-10 flex h-7 w-7 items-center justify-center overflow-hidden rounded-full font-dm-sans text-xs transition",
                  // Full white pill when selected without half-day slot.
                  isSelected &&
                    !showHalf &&
                    "bg-white font-semibold text-slate-900",
                  // No bg on pill when half-day — gradient overlay below provides it.
                  isSelected && showHalf && "font-semibold",
                  // Disabled (weekend / past / constraint).
                  !isSelected &&
                    isWknd &&
                    "cursor-not-allowed select-none text-white/18",
                  !isSelected &&
                    !isWknd &&
                    isDisabledCell &&
                    "cursor-not-allowed text-white/22",
                  // In-range dates — brighter text on the tinted band.
                  !isSelected &&
                    inRange &&
                    "text-white font-medium hover:bg-white/10",
                  // Normal interactive states.
                  !isSelected &&
                    !inRange &&
                    !isDisabledCell &&
                    isToday &&
                    "ring-1 ring-white/35 text-white hover:bg-white/10",
                  !isSelected &&
                    !inRange &&
                    !isDisabledCell &&
                    !isToday &&
                    "text-white/72 hover:bg-white/10",
                )}
              >
                {showHalf && (
                  <span
                    className={cn(
                      "pointer-events-none absolute inset-0 rounded-full",
                      halfSlot === "morning"
                        ? "bg-[linear-gradient(to_right,white_50%,transparent_50%)]"
                        : "bg-[linear-gradient(to_right,transparent_50%,white_50%)]",
                    )}
                  />
                )}
                {/* Day number sits on top of the gradient overlay. */}
                <span
                  className={cn(
                    "relative z-10",
                    isSelected && "text-slate-900",
                  )}
                >
                  {Number(iso.slice(8))}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Visible as soon as a start date is selected — mirrors DatePickerTimeOffSection. */}
      {startDate && (
        <>
          <div className="mt-3 h-px bg-white/10" />
          <div className="mt-3 flex gap-2">
            {SLOT_OPTIONS.map(({ label, value }) => {
              const isActive = activeBoundarySlot === value;
              const isDisabledSlot = disabled || isSlotDisabled(value);
              return (
                <button
                  key={value}
                  type="button"
                  disabled={isDisabledSlot}
                  onClick={() => handleSelectTimeSlot(value)}
                  className={cn(
                    "flex-1 rounded border py-2 font-dm-sans text-sm font-medium transition",
                    isActive && !isDisabledSlot
                      ? "border-white/30 bg-white/16 text-white"
                      : "border-white/14 text-white/40 hover:bg-white/8 hover:text-white/70",
                    isDisabledSlot && "cursor-not-allowed opacity-40",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Mirrors summaryContainer / summaryDate / summaryDaysOff — always shows startDate. */}
      {summaryDateText && (
        <>
          <div className="mt-3 h-px bg-white/10" />
          <div className="mt-2 flex flex-col items-end gap-0.5">
            <span className="font-dm-sans text-sm text-white/50">
              {summaryDateText}
            </span>
            <span className="font-dm-sans text-sm font-bold text-white">
              {summaryValueText}
            </span>
          </div>
        </>
      )}

      {/* ── Actions ── */}
      <div className="mt-3 flex items-center justify-end gap-2">
        {startDate && (
          <button
            type="button"
            disabled={disabled}
            onClick={handleClear}
            className="shrink-0 font-dm-sans text-xs text-white/30 transition hover:text-white/60"
          >
            Clear
          </button>
        )}
        <Button
          type="button"
          size="sm"
          variant="primary"
          disabled={!canConfirm || disabled}
          onClick={handleConfirm}
        >
          Confirm
        </Button>
      </div>
    </Card>
  );
}
