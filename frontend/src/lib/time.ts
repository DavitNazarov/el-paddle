/**
 * The platform's civil time zone, mirroring `PLATFORM_TIME_ZONE` in the backend
 * for the same reason it exists there: every reader and every court is in
 * Georgia, and a time must never depend on which machine rendered it.
 *
 * On the frontend that machine is two machines. A date formatted in the
 * runtime's own zone resolves in the container's zone during server rendering
 * and in the visitor's zone during hydration, so an 18:00 match reads 14:00 for
 * the first paint from a UTC container and then jumps — and React tears the
 * subtree down over the mismatch. Pinning the zone makes both sides agree, and
 * makes them agree on the time that is actually printed on the schedule.
 */
export const PLATFORM_TIME_ZONE = 'Asia/Tbilisi';
