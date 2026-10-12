import { describe, expect, it } from 'vitest';
import type { EventDto } from '@/types/dashboard';
import {
  calendarPulse,
  categoryOptions,
  countdownOf,
  eventSectionHref,
  filterEvents,
  groupByYear,
  publishedSections,
  shelveEvents,
} from './eventsDirectoryModel';

const event = (overrides: Partial<EventDto> = {}): EventDto => ({
  id: 'e1',
  title: 'Spring Open',
  date: '2026-09-01T10:00:00.000Z',
  location: 'Tbilisi',
  description: '',
  arrivalTime: null,
  participationFee: 40,
  categories: [{ id: 'men', name: "Men's Open", description: '' }],
  status: 'REGISTRATION_OPEN',
  version: 1,
  timeZone: 'Asia/Tbilisi',
  registrationRosterPublishedAt: null,
  schedulePublishedAt: null,
  publicLiveScoringEnabled: false,
  resultsPublishedAt: null,
  ...overrides,
});

describe('published sections', () => {
  it('claims only the sections whose publication switch is on', () => {
    expect(publishedSections(event())).toEqual([]);
    expect(publishedSections(event({ registrationRosterPublishedAt: '2026-08-01T00:00:00.000Z' }))).toEqual(['teams']);
    expect(publishedSections(event({
      registrationRosterPublishedAt: '2026-08-01T00:00:00.000Z',
      schedulePublishedAt: '2026-08-20T00:00:00.000Z',
      resultsPublishedAt: '2026-09-02T00:00:00.000Z',
    }))).toEqual(['teams', 'schedule', 'results']);
  });

  it('deep-links to the matching tab on the event page', () => {
    expect(eventSectionHref(event({ id: 'abc' }), 'results')).toBe('/events/abc#results');
  });
});

describe('countdown', () => {
  const now = new Date('2026-09-01T08:00:00.000Z');

  it('counts whole days ahead', () => {
    expect(countdownOf(event({ date: '2026-09-10T10:00:00.000Z' }), now)).toEqual({ kind: 'days', days: 9 });
  });

  it('names today and tomorrow instead of counting them', () => {
    expect(countdownOf(event({ date: '2026-09-01T18:00:00.000Z' }), now)).toEqual({ kind: 'today' });
    expect(countdownOf(event({ date: '2026-09-02T09:00:00.000Z' }), now)).toEqual({ kind: 'tomorrow' });
  });

  it('never counts backwards for an event whose day has passed', () => {
    expect(countdownOf(event({ date: '2026-08-30T10:00:00.000Z', status: 'ONGOING' }), now)).toEqual({ kind: 'underWay' });
  });
});

describe('shelves', () => {
  const soon = event({ id: 'soon', date: '2026-09-05T10:00:00.000Z' });
  const later = event({ id: 'later', date: '2026-10-05T10:00:00.000Z' });
  const live = event({ id: 'live', date: '2026-09-20T10:00:00.000Z', status: 'ONGOING' });

  it('leads with the soonest event and keeps the rest in date order', () => {
    const shelves = shelveEvents([later, soon], []);
    expect(shelves.featured?.id).toBe('soon');
    expect(shelves.scheduled.map((item) => item.id)).toEqual(['later']);
  });

  it('promotes a live event over a sooner one', () => {
    const shelves = shelveEvents([soon, live, later], []);
    expect(shelves.featured?.id).toBe('live');
    expect(shelves.scheduled.map((item) => item.id)).toEqual(['soon', 'later']);
  });

  it('leaves the scheduled shelf empty when nothing is upcoming', () => {
    const shelves = shelveEvents([], [event({ id: 'old', date: '2025-05-01T10:00:00.000Z' })]);
    expect(shelves.featured).toBeNull();
    expect(shelves.scheduled).toEqual([]);
    expect(shelves.archive.map((item) => item.id)).toEqual(['old']);
  });

  it('orders the archive newest first', () => {
    const shelves = shelveEvents([], [
      event({ id: 'older', date: '2024-05-01T10:00:00.000Z' }),
      event({ id: 'newer', date: '2026-05-01T10:00:00.000Z' }),
    ]);
    expect(shelves.archive.map((item) => item.id)).toEqual(['newer', 'older']);
  });
});

describe('archive grouping', () => {
  it('groups by year, newest year and newest event first', () => {
    const groups = groupByYear([
      event({ id: 'a', date: '2025-03-01T10:00:00.000Z' }),
      event({ id: 'b', date: '2026-07-01T10:00:00.000Z' }),
      event({ id: 'c', date: '2026-02-01T10:00:00.000Z' }),
    ]);
    expect(groups.map((group) => group.year)).toEqual([2026, 2025]);
    expect(groups[0]!.events.map((item) => item.id)).toEqual(['b', 'c']);
    expect(groups[1]!.events.map((item) => item.id)).toEqual(['a']);
  });
});

describe('filtering', () => {
  const mens = event({ id: 'm', title: 'Autumn Masters', location: 'Batumi', categories: [{ id: 'men', name: "Men's Open", description: '' }] });
  const mixed = event({ id: 'x', title: 'Winter Cup', location: 'Tbilisi', categories: [{ id: 'mixed', name: 'Mixed', description: '' }, { id: 'men', name: "Men's Open", description: '' }] });

  it('counts categories across events, most used first', () => {
    expect(categoryOptions([mens, mixed])).toEqual([
      { id: 'men', name: "Men's Open", count: 2 },
      { id: 'mixed', name: 'Mixed', count: 1 },
    ]);
  });

  it('matches title, location, and category name', () => {
    expect(filterEvents([mens, mixed], { query: 'batumi', categoryId: '' }).map((item) => item.id)).toEqual(['m']);
    expect(filterEvents([mens, mixed], { query: 'winter', categoryId: '' }).map((item) => item.id)).toEqual(['x']);
    expect(filterEvents([mens, mixed], { query: 'mixed', categoryId: '' }).map((item) => item.id)).toEqual(['x']);
  });

  it('combines the category chip with the search text', () => {
    expect(filterEvents([mens, mixed], { query: '', categoryId: 'mixed' }).map((item) => item.id)).toEqual(['x']);
    expect(filterEvents([mens, mixed], { query: 'autumn', categoryId: 'mixed' })).toEqual([]);
  });
});

describe('calendar pulse', () => {
  it('counts scheduled, live, and played events', () => {
    expect(calendarPulse(
      [event({ id: 'a' }), event({ id: 'b', status: 'ONGOING' })],
      [event({ id: 'c', status: 'COMPLETED' })],
    )).toEqual({ scheduled: 2, live: 1, played: 1 });
  });
});
