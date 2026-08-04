import { describe, expect, it } from 'vitest';
import type { AdminUserDto, CategoryDto } from '@/types/admin';
import type { ClubApplication } from '@/types/auth';
import {
  ALL_FACET,
  APPLICATION_FACET_VALUES,
  USER_FACET_VALUES,
  applicationQueue,
  applicationReader,
  awaitsDecision,
  categoryFacet,
  facetOptions,
  filterRows,
  matchesTerms,
  searchTerms,
  userFacet,
  userReader,
} from './directoryModel';

function user(overrides: Partial<AdminUserDto> = {}): AdminUserDto {
  return {
    id: 'u1',
    email: 'ana@example.com',
    name: 'Ana',
    surname: 'Beridze',
    fullName: 'Ana Beridze',
    phone: '555000111',
    role: 'USER',
    status: 'ACTIVE',
    isVerified: true,
    disqualifiedUntil: null,
    disqualificationReason: '',
    isDisqualified: false,
    club: { id: 'c1', name: 'Kutaisi Padel', slug: 'kutaisi-padel' },
    stats: { matchesPlayed: 0, wins: 0, losses: 0 },
    organiserEventIds: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function application(overrides: Partial<ClubApplication> = {}): ClubApplication {
  return {
    id: 'a1',
    email: 'lead@example.com',
    name: 'Nino',
    surname: 'Kapanadze',
    phone: '555222333',
    status: 'SUBMITTED',
    emailVerified: true,
    clubName: 'Vake Padel',
    clubDescription: '',
    mateEmail: 'mate@example.com',
    mateName: 'Giorgi',
    mateSurname: 'Tsereteli',
    matePhone: '',
    submittedAt: '2026-02-01T00:00:00.000Z',
    ...overrides,
  };
}

const category = (name: string, eventCount?: number): CategoryDto => ({
  id: name,
  name,
  description: '',
  ...(eventCount === undefined ? {} : { eventCount }),
});

describe('search terms', () => {
  it('splits on any run of whitespace and drops empties', () => {
    expect(searchTerms('  Ana   Beridze ')).toEqual(['ana', 'beridze']);
    expect(searchTerms('   ')).toEqual([]);
  });

  it('requires every term, but lets them match different fields', () => {
    const fields = ['Ana Beridze', 'ana@example.com', 'Kutaisi Padel'];
    expect(matchesTerms(fields, ['ana', 'kutaisi'])).toBe(true);
    expect(matchesTerms(fields, ['ana', 'batumi'])).toBe(false);
  });

  it('treats an empty query as matching everything, and ignores absent fields', () => {
    expect(matchesTerms([null, undefined], [])).toBe(true);
    expect(matchesTerms([null, 'Ana'], ['ana'])).toBe(true);
  });
});

describe('row filtering', () => {
  const rows = [
    user({ id: 'a', fullName: 'Ana Beridze' }),
    user({ id: 'b', fullName: 'Beka Lomidze', email: 'beka@example.com', status: 'INVITED' }),
    user({ id: 'c', fullName: 'Dato Kiknadze', isDisqualified: true }),
  ];

  it('returns every row when the query is empty', () => {
    expect(filterRows(rows, { search: '', facet: ALL_FACET }, userReader)).toHaveLength(3);
  });

  it('narrows by search across the reader fields', () => {
    const found = filterRows(rows, { search: 'beka', facet: ALL_FACET }, userReader);
    expect(found.map((row) => row.id)).toEqual(['b']);
  });

  it('narrows by facet bucket', () => {
    const found = filterRows(rows, { search: '', facet: 'INVITED' }, userReader);
    expect(found.map((row) => row.id)).toEqual(['b']);
  });

  it('applies search and facet together', () => {
    expect(filterRows(rows, { search: 'ana', facet: 'INVITED' }, userReader)).toEqual([]);
  });

  it('reads a disqualified account as disqualified rather than active', () => {
    expect(userFacet(rows[2]!)).toBe('DISQUALIFIED');
    expect(userFacet(rows[0]!)).toBe('ACTIVE');
  });
});

describe('facet options', () => {
  const rows = [
    user({ id: 'a' }),
    user({ id: 'b', status: 'INVITED' }),
    user({ id: 'c', isDisqualified: true }),
    user({ id: 'd', fullName: 'Zurab Zurabishvili', status: 'INVITED' }),
  ];

  it('counts each bucket and puts the total on the all chip', () => {
    const options = facetOptions(rows, { search: '', facet: ALL_FACET }, userReader, USER_FACET_VALUES, (value) => value);
    expect(options.map((option) => [option.value, option.count])).toEqual([
      [ALL_FACET, 4],
      ['ACTIVE', 1],
      ['INVITED', 2],
      ['DISQUALIFIED', 1],
    ]);
  });

  it('counts within the search, so a chip never promises more than it shows', () => {
    const options = facetOptions(rows, { search: 'zurab', facet: ALL_FACET }, userReader, USER_FACET_VALUES, (value) => value);
    expect(options.map((option) => [option.value, option.count])).toEqual([
      [ALL_FACET, 1],
      ['ACTIVE', 0],
      ['INVITED', 1],
      ['DISQUALIFIED', 0],
    ]);
  });

  it('yields no chips for a directory with no facet reader', () => {
    expect(facetOptions(rows, { search: '', facet: ALL_FACET }, { text: userReader.text }, USER_FACET_VALUES, (v) => v)).toEqual([]);
  });
});

describe('categories in use', () => {
  it('treats a missing count as not yet used rather than as zero events', () => {
    expect(categoryFacet(category('Open'))).toBe('UNUSED');
    expect(categoryFacet(category('Mixed', 0))).toBe('UNUSED');
    expect(categoryFacet(category('Women', 3))).toBe('IN_USE');
  });
});

describe('application queue', () => {
  it('asks for a decision only once the applicant has confirmed their email', () => {
    expect(awaitsDecision(application())).toBe(true);
    expect(awaitsDecision(application({ status: 'PENDING_VERIFICATION' }))).toBe(false);
  });

  it('counts what can be decided now against everything waiting', () => {
    const queue = applicationQueue([
      application({ id: '1' }),
      application({ id: '2', status: 'PENDING_VERIFICATION' }),
      application({ id: '3' }),
    ]);
    expect(queue).toEqual({ ready: 2, total: 3 });
  });

  it('reports an empty queue without inventing progress', () => {
    expect(applicationQueue([])).toEqual({ ready: 0, total: 0 });
  });

  it('filters requests by the state they are waiting in', () => {
    const rows = [application({ id: '1' }), application({ id: '2', status: 'PENDING_VERIFICATION' })];
    const options = facetOptions(rows, { search: '', facet: ALL_FACET }, applicationReader, APPLICATION_FACET_VALUES, (v) => v);
    expect(options.map((option) => option.count)).toEqual([2, 1, 1]);
  });

  it('searches a request by club, applicant and teammate alike', () => {
    const rows = [application({ id: '1' }), application({ id: '2', clubName: 'Rustavi Padel', mateEmail: 'other@example.com' })];
    expect(filterRows(rows, { search: 'vake', facet: ALL_FACET }, applicationReader).map((r) => r.id)).toEqual(['1']);
    expect(filterRows(rows, { search: 'other@', facet: ALL_FACET }, applicationReader).map((r) => r.id)).toEqual(['2']);
  });
});
