import type { MatchDto } from '@/types/tournament';

/**
 * How one match reads on the console: where it is, when it was due, and whether
 * that time may still be moved. The brackets endpoint already carries each
 * match's schedule item and court, so no second fetch has to be joined in.
 */

/** The court a match sits on, or null while it is still waiting for one. */
export function courtOf(match: MatchDto) {
  return match.scheduleItem?.court ?? null;
}

export function plannedStartOf(match: MatchDto) {
  return match.scheduleItem?.plannedStartAt ?? null;
}

/**
 * The server freezes a started or finished schedule item, so its time can no
 * longer be moved. Offering the field anyway would only produce a 409.
 */
export function canEditTime(match: MatchDto) {
  const item = match.scheduleItem;
  return Boolean(item) && item!.status !== 'IN_PROGRESS' && item!.status !== 'COMPLETED';
}

/**
 * Minutes a match is past the time it was due to start, or null when it is not
 * late. Only a match still waiting can be late: once it is running the planned
 * time has done its job, and a finished one is history.
 *
 * A tournament day never runs to the minute, so the console stays quiet until a
 * match is far enough behind that the operator would want to know.
 */
export const LATE_AFTER_MINUTES = 5;

export function minutesLate(match: MatchDto, now: number): number | null {
  if (match.status !== 'READY' && match.status !== 'PENDING') return null;
  const planned = plannedStartOf(match);
  if (!planned) return null;
  const due = new Date(planned).getTime();
  if (Number.isNaN(due)) return null;
  const late = Math.floor((now - due) / 60_000);
  return late >= LATE_AFTER_MINUTES ? late : null;
}

/**
 * `datetime-local` speaks wall-clock text, the API speaks ISO. Both conversions
 * go through the browser's own zone, which is the zone the operator is standing in.
 */
export function toLocalInputValue(iso: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Empty input means "clear the time", which the API accepts as an explicit null. */
export function fromLocalInputValue(value: string): string | null {
  if (!value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
