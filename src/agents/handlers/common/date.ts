const MS_PER_DAY = 86_400_000;

/**
 * Gets today iso date.
 * @param {string} timeZone
 * @returns {string}
 */
export function getTodayIsoDate(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Checks whether iso date only.
 * @param {string} value
 * @returns {boolean}
 */
export function isIsoDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Parses iso date to utc day.
 * @param {string} value
 * @returns {number}
 */
export function parseIsoDateToUtcDay(value: string): number {
  if (!isIsoDateOnly(value)) return Number.NaN;

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return Number.NaN;
  }

  const utcMs = Date.UTC(year, month - 1, day);
  const utcDate = new Date(utcMs);

  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    return Number.NaN;
  }

  return Math.floor(utcMs / MS_PER_DAY);
}

/**
 * Parses relative date to utc day.
 * @param {string} value
 * @param {string} timeZone
 * @returns {number}
 */
export function parseRelativeDateToUtcDay(value: string, timeZone: string): number {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[.,!?]/g, "")
    .replace(/\s+/g, " ");
  const todayDay = parseIsoDateToUtcDay(getTodayIsoDate(timeZone));

  if (!Number.isFinite(todayDay)) return Number.NaN;
  if (normalized === "today") return todayDay;
  if (normalized === "tomorrow") return todayDay + 1;
  if (normalized === "day after tomorrow") return todayDay + 2;

  const inDaysMatch = normalized.match(/^in\s+(\d+)\s+days?$/);
  if (inDaysMatch) return todayDay + Number(inDaysMatch[1]);

  const weekdayMap: Record<string, number> = {
    sunday: 0, sun: 0,
    monday: 1, mon: 1,
    tuesday: 2, tue: 2, tues: 2,
    wednesday: 3, wed: 3,
    thursday: 4, thu: 4, thurs: 4,
    friday: 5, fri: 5,
    saturday: 6, sat: 6,
  };

  const currentWeekday = new Date(todayDay * MS_PER_DAY).getUTCDay();
  const relativeWeekdayMatch = normalized.match(/^(next|this)\s+([a-z]+)$/);
  if (relativeWeekdayMatch) {
    const mode = relativeWeekdayMatch[1];
    const targetWeekday = weekdayMap[relativeWeekdayMatch[2]];
    if (typeof targetWeekday !== "number") return Number.NaN;

    let delta = (targetWeekday - currentWeekday + 7) % 7;
    if (mode === "next" || (mode === "this" && delta === 0)) {
      if (delta === 0) delta = 7;
    }
    return todayDay + delta;
  }

  const directWeekday = weekdayMap[normalized];
  if (typeof directWeekday === "number") {
    let delta = (directWeekday - currentWeekday + 7) % 7;
    if (delta === 0) delta = 7;
    return todayDay + delta;
  }

  const monthMap: Record<string, number> = {
    january: 1, jan: 1,
    february: 2, feb: 2,
    march: 3, mar: 3,
    april: 4, apr: 4,
    may: 5,
    june: 6, jun: 6,
    july: 7, jul: 7,
    august: 8, aug: 8,
    september: 9, sep: 9, sept: 9,
    october: 10, oct: 10,
    november: 11, nov: 11,
    december: 12, dec: 12,
  };

  // "April 30", "May 1", "April 30 2026", "April 30, 2026"
  const monthDayMatch = normalized.match(/^([a-z]+)\s+(\d{1,2})(?:[,\s]+(\d{4}))?$/);
  if (monthDayMatch) {
    const monthNum = monthMap[monthDayMatch[1]];
    const day = Number(monthDayMatch[2]);
    const explicitYear = monthDayMatch[3] ? Number(monthDayMatch[3]) : null;

    if (monthNum && day >= 1 && day <= 31) {
      const todayYear = new Date(todayDay * MS_PER_DAY).getUTCFullYear();
      let year = explicitYear ?? todayYear;

      if (!explicitYear) {
        const candidate = parseIsoDateToUtcDay(
          `${year}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        );
        if (Number.isFinite(candidate) && candidate < todayDay) year = todayYear + 1;
      }

      const iso = `${year}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const result = parseIsoDateToUtcDay(iso);
      if (Number.isFinite(result)) return result;
    }
  }

  return Number.NaN;
}

/**
 * Strips time-of-day qualifiers (morning, afternoon, evening, midday, AM, PM, end of)
 * so the remaining string can be parsed as a plain date.
 */
export function stripTimeOfDay(value: string): string {
  return value
    .replace(/\b(morning|afternoon|evening|midday|mid-day|end\s+of|am|pm)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parses date input to utc day.
 * @param {string} value
 * @param {string} timeZone
 * @returns {number}
 */
export function parseDateInputToUtcDay(value: string, timeZone: string): number {
  const trimmed = value.trim();
  const absoluteDay = parseIsoDateToUtcDay(trimmed);
  if (Number.isFinite(absoluteDay)) return absoluteDay;
  const relative = parseRelativeDateToUtcDay(trimmed, timeZone);
  if (Number.isFinite(relative)) return relative;
  // Strip time-of-day qualifiers and retry (e.g. "morning of April 30", "afternoon today")
  const stripped = stripTimeOfDay(trimmed).replace(/^of\s+/i, "");
  if (stripped && stripped !== trimmed) {
    const strippedAbsolute = parseIsoDateToUtcDay(stripped);
    if (Number.isFinite(strippedAbsolute)) return strippedAbsolute;
    return parseRelativeDateToUtcDay(stripped, timeZone);
  }
  return Number.NaN;
}

/**
 * utcDayToIsoDate helper.
 * @param {number} day
 * @returns {string}
 */
export function utcDayToIsoDate(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * countBusinessDays helper.
 * @param {number} fromDay
 * @param {number} toDay
 * @returns {number}
 */
export function countBusinessDays(fromDay: number, toDay: number): number {
  let total = 0;
  for (let day = fromDay; day <= toDay; day += 1) {
    const weekday = new Date(day * MS_PER_DAY).getUTCDay();
    if (weekday !== 0 && weekday !== 6) total += 1;
  }
  return total;
}

/**
 * formatDateRange helper.
 * @param {string} startDate
 * @param {string} endDate
 * @returns {string}
 */
export function formatDateRange(startDate: string, endDate: string): string {
  return startDate === endDate ? startDate : `${startDate} to ${endDate}`;
}
