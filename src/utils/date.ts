const ISO_DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const DATE_WITH_YEAR_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const MONTH_DAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function parseIsoDateUtc(value: string): Date | null {
  if (!ISO_DATE_ONLY_REGEX.test(value)) return null;

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
}

export function formatDateWithYear(date: Date): string {
  return DATE_WITH_YEAR_FORMATTER.format(date);
}

const ISO_RANGE_MSG_REGEX = /^(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})$/;
const ISO_SINGLE_MSG_REGEX = /^(\d{4}-\d{2}-\d{2})$/;

/** Format a user message that is purely an ISO date or ISO range into a human-readable string. */
export function formatIsoDateMessage(text: string): string {
  const t = text.trim();
  const range = ISO_RANGE_MSG_REGEX.exec(t);
  if (range) return formatHumanDateRange(range[1], range[2]);
  const single = ISO_SINGLE_MSG_REGEX.exec(t);
  if (single) return formatHumanDateRange(single[1], single[1]);
  return text;
}

export function formatHumanDateRange(startDate: string, endDate: string): string {
  if (!startDate && !endDate) return "—";

  if (!startDate || !endDate) {
    const single = startDate || endDate;
    const parsed = parseIsoDateUtc(single);
    return parsed ? DATE_WITH_YEAR_FORMATTER.format(parsed) : single;
  }

  const parsedStart = parseIsoDateUtc(startDate);
  const parsedEnd = parseIsoDateUtc(endDate);

  if (!parsedStart || !parsedEnd) {
    return startDate === endDate ? startDate : `${startDate} → ${endDate}`;
  }

  if (startDate === endDate) {
    return DATE_WITH_YEAR_FORMATTER.format(parsedStart);
  }

  const sameYear = parsedStart.getUTCFullYear() === parsedEnd.getUTCFullYear();
  const sameMonth = sameYear && parsedStart.getUTCMonth() === parsedEnd.getUTCMonth();

  if (sameMonth) {
    return `${MONTH_DAY_FORMATTER.format(parsedStart)}–${parsedEnd.getUTCDate()}, ${parsedStart.getUTCFullYear()}`;
  }

  if (sameYear) {
    return `${MONTH_DAY_FORMATTER.format(parsedStart)} – ${MONTH_DAY_FORMATTER.format(parsedEnd)}, ${parsedStart.getUTCFullYear()}`;
  }

  return `${DATE_WITH_YEAR_FORMATTER.format(parsedStart)} – ${DATE_WITH_YEAR_FORMATTER.format(parsedEnd)}`;
}
