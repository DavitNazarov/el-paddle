import { describe, expect, it } from 'vitest';
import type { MatchDto } from '@/types/tournament';
import {
  NO_COURT,
  activeFilterCount,
  emptyFilters,
  laneIsVisible,
  matchesFilters,
  optionsWithCounts,
} from './controlFilters';
import type { ControlMatch, CourtLane } from './runBoard';

function entry(fields: Partial<ControlMatch> & { match?: Partial<MatchDto> } = {}): ControlMatch {
  const { match: matchFields, ...rest } = fields;
  return {
    match: {
      id: 'm1',
      matchNumber: 7,
      round: 'QUARTERFINAL',
      status: 'READY',
      participantA: { owner: { fullName: 'Ana Beridze' }, teammate: { fullName: 'Nino Kapanadze' } },
      participantB: { owner: { fullName: 'Beka Giorgadze' }, teammate: { fullName: 'Luka Tsereteli' } },
      snapshots: [{ side: 'A', clubName: 'Padel Tbilisi' }],
      sets: [],
      ...matchFields,
    },
    categoryId: 'cat1',
    categoryName: 'Men’s Open',
    court: { id: 'c1', name: 'Court 1' },
    item: null,
    plannedStartAt: null,
    queuePosition: null,
    lateBy: null,
    ...rest,
  } as unknown as ControlMatch;
}

describe('narrowing the console', () => {
  it('combines every axis, and passes everything when nothing is asked', () => {
    expect(matchesFilters(entry(), emptyFilters)).toBe(true);
    expect(matchesFilters(entry(), { ...emptyFilters, categoryId: 'cat2' })).toBe(false);
    expect(matchesFilters(entry(), { ...emptyFilters, round: 'SEMIFINAL' })).toBe(false);
    expect(matchesFilters(entry(), { ...emptyFilters, band: 'ready' })).toBe(true);
    expect(matchesFilters(entry(), { ...emptyFilters, band: 'live' })).toBe(false);
    expect(matchesFilters(entry(), { ...emptyFilters, courtId: 'c1', band: 'ready' })).toBe(true);
    expect(matchesFilters(entry(), { ...emptyFilters, courtId: 'c1', band: 'live' })).toBe(false);
  });

  it('treats “no court yet” as a court an operator can ask for', () => {
    const placed = entry();
    const unplaced = entry({ court: null });
    expect(matchesFilters(unplaced, { ...emptyFilters, courtId: NO_COURT })).toBe(true);
    expect(matchesFilters(placed, { ...emptyFilters, courtId: NO_COURT })).toBe(false);
  });

  it('keeps only what is running late when asked', () => {
    expect(matchesFilters(entry({ lateBy: 12 }), { ...emptyFilters, late: true })).toBe(true);
    expect(matchesFilters(entry(), { ...emptyFilters, late: true })).toBe(false);
  });

  it('searches every name on the row, and the match number, case-insensitively', () => {
    const search = (text: string) => matchesFilters(entry(), { ...emptyFilters, search: text });
    expect(search('nino')).toBe(true);
    expect(search('TSERETELI')).toBe(true);
    expect(search('padel tbilisi')).toBe(true);
    expect(search('Court 1')).toBe(true);
    expect(search('7')).toBe(true);
    expect(search('Sopo')).toBe(false);
  });

  it('counts what is being asked, so the bar can say how narrow it has become', () => {
    expect(activeFilterCount(emptyFilters)).toBe(0);
    expect(activeFilterCount({ ...emptyFilters, search: '  ' })).toBe(0);
    expect(activeFilterCount({ ...emptyFilters, search: 'ana', courtId: 'c1', late: true })).toBe(3);
  });
});

describe('which lanes are worth drawing', () => {
  const lane = (courtId: string, entries: ControlMatch[]) => ({
    court: { id: courtId, name: courtId, scheduleItems: [] },
    live: null,
    next: null,
    later: entries,
    played: [],
  }) as unknown as CourtLane;

  it('keeps every lane — including the empty ones — when nothing is asked', () => {
    expect(laneIsVisible(emptyFilters, lane('c1', [entry()]))).toBe(true);
    expect(laneIsVisible(emptyFilters, lane('c9', []))).toBe(true);
  });

  it('names one court outright when a court is chosen', () => {
    expect(laneIsVisible({ ...emptyFilters, courtId: 'c1' }, lane('c1', [entry()]))).toBe(true);
    expect(laneIsVisible({ ...emptyFilters, courtId: 'c2' }, lane('c1', [entry()]))).toBe(false);
  });

  it('drops a lane with nothing left on it, so a narrow question gives a short board', () => {
    const late = lane('c1', [entry({ lateBy: 12 })]);
    const punctual = lane('c2', [entry()]);
    expect(laneIsVisible({ ...emptyFilters, late: true }, late)).toBe(true);
    expect(laneIsVisible({ ...emptyFilters, late: true }, punctual)).toBe(false);
  });
});

describe('the options a filter offers', () => {
  const entries = [entry(), entry({ categoryId: 'cat2', categoryName: 'Women’s Open' }), entry()];
  const labels = new Map([['cat1', 'Men’s Open'], ['cat2', 'Women’s Open'], ['cat3', 'Mixed']]);

  it('offers only what would leave something, with the count it would leave', () => {
    expect(optionsWithCounts(entries, (item) => item.categoryId, labels, null)).toEqual([
      { value: 'cat1', label: 'Men’s Open', count: 2 },
      { value: 'cat2', label: 'Women’s Open', count: 1 },
    ]);
  });

  it('keeps the current choice on the list even once it would leave nothing', () => {
    const options = optionsWithCounts(entries, (item) => item.categoryId, labels, 'cat3');
    expect(options.map((option) => option.value)).toEqual(['cat1', 'cat2', 'cat3']);
    expect(options.at(-1)).toMatchObject({ value: 'cat3', count: 0 });
  });
});
