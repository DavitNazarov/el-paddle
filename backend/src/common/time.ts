/**
 * The platform's civil time zone. Every reader and every court is in Georgia,
 * and `Event.timeZone` already defaults here, so a bare date typed by an admin
 * means a Georgian calendar day — not a UTC one, and above all not one that
 * depends on which machine the API happens to be running on.
 */
export const PLATFORM_TIME_ZONE = 'Asia/Tbilisi';

/**
 * How far `timeZone` is ahead of UTC at a given instant, in milliseconds.
 * Derived from `Intl` rather than hard-coded, so a zone with daylight saving
 * still resolves correctly for the instant being asked about.
 */
function zoneOffsetMs(at: Date, timeZone: string) {
  // `Intl` has no millisecond field, so the comparison has to be made against a
  // whole second — otherwise the dropped milliseconds land in the offset.
  const whole = new Date(Math.floor(at.getTime() / 1000) * 1000);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(whole);
  const field = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? '0');
  // `hour` renders as 24 at midnight under hour12: false in some ICU versions.
  const asIfUtc = Date.UTC(field('year'), field('month') - 1, field('day'), field('hour') % 24, field('minute'), field('second'));
  return asIfUtc - whole.getTime();
}

/**
 * The last instant of a calendar day in `timeZone`, as a UTC `Date`.
 *
 * `new Date(\`${day}T23:59:59\`)` resolves in the *server's* zone, so the same
 * input meant a different moment on a laptop and in the production container,
 * and both drifted from what the admin who typed the date intended.
 *
 * Returns `null` for anything that is not a `YYYY-MM-DD` calendar date, so the
 * caller can reject it rather than silently storing an `Invalid Date`.
 */
export function endOfDayInZone(day: string, timeZone = PLATFORM_TIME_ZONE) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const naive = new Date(`${day}T23:59:59.999Z`);
  if (Number.isNaN(naive.getTime())) return null;
  const resolved = new Date(naive.getTime() - zoneOffsetMs(naive, timeZone));
  return Number.isNaN(resolved.getTime()) ? null : resolved;
}
