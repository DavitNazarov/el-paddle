import { PLATFORM_TIME_ZONE } from '@/lib/time';

/**
 * Asking what calendar day an instant falls on in a zone that is not the
 * runtime's is only possible through `Intl`. Built once, because constructing a
 * formatter is by far the expensive part of the work here.
 */
const courtDayFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: PLATFORM_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * The calendar day an instant falls on in court time, as a UTC midnight so two
 * of them subtract cleanly. `NaN` for an unparseable date, which is what the
 * countdown callers already read as "no count to show".
 */
function startOfCourtDay(instant: Date) {
  if (Number.isNaN(instant.getTime())) return Number.NaN;
  const parts = courtDayFormat.formatToParts(instant);
  const field = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return Date.UTC(field('year'), field('month') - 1, field('day'));
}

/**
 * Whole days from now until the event, floored to calendar days. Rendered as a
 * count rather than a formatted date because "in 6 days" is the fact a
 * competitor is checking; the exact date sits underneath it. Negative once the
 * day has passed.
 *
 * Both days are read in `PLATFORM_TIME_ZONE`, never in the runtime's own zone.
 * The date printed beside this count goes through `formatDate`, which is pinned
 * there, so counting in the runtime's zone made the two disagree by a day
 * whenever the event fell near midnight court time — and disagree *differently*
 * on the server and in the browser, which is a hydration mismatch on top of a
 * wrong number. A tournament day is a Georgian calendar day for everyone
 * reading, wherever they are.
 */
export function daysUntil(date: string, now: Date = new Date()) {
  const day = 24 * 60 * 60 * 1000;
  return Math.round((startOfCourtDay(new Date(date)) - startOfCourtDay(now)) / day);
}

export function toDatetimeLocalValue(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}
