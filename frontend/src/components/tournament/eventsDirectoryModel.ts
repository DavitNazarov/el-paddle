import type { EventDto } from '@/types/dashboard';
import { daysUntil } from '@/lib/utils/dates';

/**
 * Pure reading for the public tournament calendar. The page shows three shelves
 * — the next tournament, the rest of the published schedule, and a searchable
 * archive — and every decision about what goes where, what a card may claim is
 * public, and how far away a date is, is made here so it can be tested without
 * rendering and without a locale.
 */

/** Deep-linkable sections of a public event page, in the order its tabs run. */
export const EVENT_SECTION_IDS = ['teams', 'schedule', 'results'] as const;
export type EventSectionId = (typeof EVENT_SECTION_IDS)[number];

/**
 * The sections an event page will actually show something in. Each has its own
 * publication switch, so the calendar can promise only what is already public.
 * The draw is missing on purpose: bracket publication lives on the bracket, not
 * on the event, so the list payload cannot honestly claim it.
 */
export function publishedSections(event: EventDto): EventSectionId[] {
  return [
    ...(event.registrationRosterPublishedAt ? (['teams'] as const) : []),
    ...(event.schedulePublishedAt ? (['schedule'] as const) : []),
    ...(event.resultsPublishedAt ? (['results'] as const) : []),
  ];
}

export function eventSectionHref(event: EventDto, section: EventSectionId) {
  return `/events/${event.id}#${section}`;
}

/** A tournament being played right now earns the loudest treatment on the page. */
export function isLive(event: EventDto) {
  return event.status === 'ONGOING';
}

/* ---- Countdown ---- */

export type Countdown =
  | { kind: 'days'; days: number }
  | { kind: 'today' }
  | { kind: 'tomorrow' }
  | { kind: 'underWay' };

/**
 * How far away the first ball is. An event whose date has passed but which is
 * still open or being played reads as under way rather than as a negative
 * count — the calendar should never tell a visitor a live event is "-1 days".
 */
export function countdownOf(event: EventDto, now: Date = new Date()): Countdown {
  const days = daysUntil(event.date, now);
  if (days > 1) return { kind: 'days', days };
  if (days === 1) return { kind: 'tomorrow' };
  if (days === 0) return { kind: 'today' };
  return { kind: 'underWay' };
}

/* ---- Shelves ---- */

export type EventShelves = {
  /** The one tournament the page leads with, or null when nothing is scheduled. */
  featured: EventDto | null;
  /** Everything else already on the calendar, soonest first. */
  scheduled: EventDto[];
  /** Finished tournaments, newest first. */
  archive: EventDto[];
};

/**
 * Splits the payload into the three shelves. A live event outranks a merely
 * sooner one for the lead slot, because "being played now" is the thing a
 * visitor opening the calendar mid-tournament is looking for.
 */
export function shelveEvents(upcoming: EventDto[], previous: EventDto[]): EventShelves {
  const sorted = [...upcoming].sort(compareByDateAscending);
  const live = sorted.find(isLive);
  const featured = live ?? sorted[0] ?? null;
  return {
    featured,
    scheduled: featured ? sorted.filter((event) => event.id !== featured.id) : [],
    archive: [...previous].sort(compareByDateDescending),
  };
}

function compareByDateAscending(a: EventDto, b: EventDto) {
  return Date.parse(a.date) - Date.parse(b.date);
}

function compareByDateDescending(a: EventDto, b: EventDto) {
  return Date.parse(b.date) - Date.parse(a.date);
}

/* ---- Archive grouping ---- */

export type EventYearGroup = { year: number; events: EventDto[] };

/** The archive as years, newest year first, each year's events newest first. */
export function groupByYear(events: EventDto[]): EventYearGroup[] {
  const years = new Map<number, EventDto[]>();
  for (const event of [...events].sort(compareByDateDescending)) {
    const year = new Date(event.date).getFullYear();
    const bucket = years.get(year);
    if (bucket) bucket.push(event);
    else years.set(year, [event]);
  }
  return [...years.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, yearEvents]) => ({ year, events: yearEvents }));
}

/* ---- Filtering ---- */

export type CategoryOption = { id: string; name: string; count: number };

/** Every category represented in the archive, most-used first, then by name. */
export function categoryOptions(events: EventDto[]): CategoryOption[] {
  const counts = new Map<string, CategoryOption>();
  for (const event of events) {
    for (const category of event.categories) {
      const existing = counts.get(category.id);
      if (existing) existing.count += 1;
      else counts.set(category.id, { id: category.id, name: category.name, count: 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function filterEvents(events: EventDto[], filters: { query: string; categoryId: string }) {
  const needle = filters.query.trim().toLowerCase();
  return events.filter((event) => {
    if (filters.categoryId && !event.categories.some((category) => category.id === filters.categoryId)) return false;
    if (!needle) return true;
    return [event.title, event.location, ...event.categories.map((category) => category.name)]
      .join(' ')
      .toLowerCase()
      .includes(needle);
  });
}

/* ---- Header counts ---- */

export type CalendarPulse = { scheduled: number; live: number; played: number };

/** The three numbers the header states, so the page says its own size out loud. */
export function calendarPulse(upcoming: EventDto[], previous: EventDto[]): CalendarPulse {
  return {
    scheduled: upcoming.length,
    live: upcoming.filter(isLive).length,
    played: previous.length,
  };
}
