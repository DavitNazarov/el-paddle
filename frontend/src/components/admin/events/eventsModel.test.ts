import { describe, expect, it } from 'vitest';
import type { EventDto } from '@/types/admin';
import {
  compareEvents,
  emptyEventForm,
  eventBucket,
  eventPayload,
  isEventFormValid,
  normalizeIban,
  sortEvents,
  toggleCategoryId,
  validateEventForm,
  type EventFormState,
} from './eventsModel';

const validForm: EventFormState = {
  title: 'Spring Open',
  date: '2026-09-01T10:00',
  location: 'Tbilisi',
  description: '',
  arrivalTime: '',
  participationFee: '40',
  bankAccountIban: 'GE29TB7654321098765432',
  bankAccountReceiver: 'El Padel LLC',
  categoryIds: ['men'],
};

const event = (overrides: Partial<EventDto> = {}): EventDto => ({
  id: 'e1',
  title: 'Spring Open',
  date: '2026-09-01T10:00:00.000Z',
  location: 'Tbilisi',
  description: '',
  arrivalTime: null,
  participationFee: 40,
  bankAccountIban: 'GE29TB7654321098765432',
  bankAccountReceiver: 'El Padel LLC',
  isPublished: true,
  status: 'REGISTRATION_OPEN',
  version: 1,
  timeZone: 'Asia/Tbilisi',
  registrationRosterPublishedAt: null,
  schedulePublishedAt: null,
  publicLiveScoringEnabled: false,
  resultsPublishedAt: null,
  categories: [],
  ...overrides,
});

describe('event form validation', () => {
  it('accepts a complete form', () => {
    expect(validateEventForm(validForm)).toEqual({});
    expect(isEventFormValid(validateEventForm(validForm))).toBe(true);
  });

  it('reports every empty field at once rather than one per save', () => {
    const errors = validateEventForm(emptyEventForm);
    expect(errors).toEqual({
      title: 'titleTooShort',
      date: 'dateRequired',
      location: 'locationRequired',
      categoryIds: 'categoriesRequired',
      participationFee: 'feeRequired',
      bankAccountReceiver: 'receiverTooShort',
      bankAccountIban: 'ibanInvalid',
    });
  });

  it('separates a missing fee from a negative one', () => {
    expect(validateEventForm({ ...validForm, participationFee: '' }).participationFee).toBe('feeRequired');
    expect(validateEventForm({ ...validForm, participationFee: '-1' }).participationFee).toBe('feeNegative');
    expect(validateEventForm({ ...validForm, participationFee: '0' }).participationFee).toBeUndefined();
  });

  it('treats a non-numeric fee as negative rather than letting NaN through', () => {
    expect(validateEventForm({ ...validForm, participationFee: 'free' }).participationFee).toBe('feeNegative');
  });

  it('accepts an IBAN written with spaces or in lower case', () => {
    expect(normalizeIban(' ge29 tb76 5432 1098 7654 32 ')).toBe('GE29TB7654321098765432');
    expect(validateEventForm({ ...validForm, bankAccountIban: 'ge29 tb76 5432 1098 7654 32' }).bankAccountIban).toBeUndefined();
  });

  it('refuses an IBAN of the wrong shape', () => {
    expect(validateEventForm({ ...validForm, bankAccountIban: 'GE29TB76543210987654' }).bankAccountIban).toBe('ibanInvalid');
    expect(validateEventForm({ ...validForm, bankAccountIban: 'DE29TB7654321098765432' }).bankAccountIban).toBe('ibanInvalid');
  });

  it('requires a title of at least three characters, ignoring padding', () => {
    expect(validateEventForm({ ...validForm, title: '  a  ' }).title).toBe('titleTooShort');
  });

  it('requires at least one category', () => {
    expect(validateEventForm({ ...validForm, categoryIds: [] }).categoryIds).toBe('categoriesRequired');
  });
});

describe('event payload', () => {
  it('trims text, converts the fee, and normalises the IBAN', () => {
    const payload = eventPayload({ ...validForm, title: '  Spring Open ', bankAccountIban: 'ge29 tb76 5432 1098 7654 32' });
    expect(payload.title).toBe('Spring Open');
    expect(payload.participationFee).toBe(40);
    expect(payload.bankAccountIban).toBe('GE29TB7654321098765432');
  });

  it('sends an absent arrival time as null, not an empty string', () => {
    expect(eventPayload(validForm).arrivalTime).toBeNull();
    expect(eventPayload({ ...validForm, arrivalTime: '2026-09-01T08:00' }).arrivalTime).toBe('2026-09-01T08:00');
  });
});

describe('category toggle', () => {
  it('adds then removes, leaving the rest untouched', () => {
    expect(toggleCategoryId(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleCategoryId(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('event buckets and order', () => {
  it('reads completed before unpublished, and published as upcoming', () => {
    expect(eventBucket(event({ status: 'COMPLETED', isPublished: false }))).toBe('COMPLETED');
    expect(eventBucket(event({ isPublished: false }))).toBe('DRAFT');
    expect(eventBucket(event())).toBe('UPCOMING');
  });

  it('puts upcoming first, drafts next, finished last', () => {
    const rows = [
      event({ id: 'done', status: 'COMPLETED' }),
      event({ id: 'draft', isPublished: false }),
      event({ id: 'live' }),
    ];
    expect(sortEvents(rows).map((row) => row.id)).toEqual(['live', 'draft', 'done']);
  });

  it('orders upcoming soonest first but finished most recent first', () => {
    const early = event({ id: 'early', date: '2026-01-01T00:00:00.000Z' });
    const late = event({ id: 'late', date: '2026-12-01T00:00:00.000Z' });
    expect(sortEvents([late, early]).map((row) => row.id)).toEqual(['early', 'late']);

    const oldDone = event({ id: 'old', status: 'COMPLETED', date: '2025-01-01T00:00:00.000Z' });
    const newDone = event({ id: 'new', status: 'COMPLETED', date: '2026-01-01T00:00:00.000Z' });
    expect(sortEvents([oldDone, newDone]).map((row) => row.id)).toEqual(['new', 'old']);
  });

  it('is a stable comparator for identical events', () => {
    expect(compareEvents(event(), event())).toBe(0);
  });
});
