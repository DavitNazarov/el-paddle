import type { EventDto } from '@/types/admin';
import type { DirectoryReader } from '../directory/directoryModel';
import { toDatetimeLocalValue } from '@/lib/utils/dates';

/**
 * Pure reading for the events list and its form. Validation returns error
 * *codes* rather than sentences so it can be tested without a locale and so the
 * client owns every user-facing word.
 */

export type EventFormState = {
  title: string;
  date: string;
  location: string;
  description: string;
  arrivalTime: string;
  participationFee: string;
  bankAccountIban: string;
  bankAccountReceiver: string;
  categoryIds: string[];
};

export const emptyEventForm: EventFormState = {
  title: '',
  date: '',
  location: '',
  description: '',
  arrivalTime: '',
  participationFee: '',
  bankAccountIban: '',
  bankAccountReceiver: '',
  categoryIds: [],
};

export function formFromEvent(event: EventDto): EventFormState {
  return {
    title: event.title,
    date: toDatetimeLocalValue(event.date),
    location: event.location,
    description: event.description ?? '',
    arrivalTime: toDatetimeLocalValue(event.arrivalTime),
    participationFee: String(event.participationFee),
    bankAccountIban: event.bankAccountIban ?? '',
    bankAccountReceiver: event.bankAccountReceiver ?? '',
    categoryIds: event.categories.map((category) => category.id),
  };
}

/* ---- Validation ---- */

/** Georgian IBAN: GE, two check digits, a two-letter bank code, then 16 digits. */
const IBAN_PATTERN = /^GE\d{2}[A-Z]{2}\d{16}$/;

export function normalizeIban(value: string) {
  return value.replace(/\s+/g, '').toUpperCase();
}

export type EventFieldError =
  | 'titleTooShort'
  | 'dateRequired'
  | 'locationRequired'
  | 'categoriesRequired'
  | 'feeRequired'
  | 'feeNegative'
  | 'receiverTooShort'
  | 'ibanInvalid';

export type EventFieldErrors = Partial<Record<keyof EventFormState, EventFieldError>>;

/**
 * Every field checked independently, so the reader gets all of their mistakes
 * at once instead of one per save. The old screen disabled the save button
 * until all of this passed, which told nobody *which* field was wrong.
 */
export function validateEventForm(form: EventFormState): EventFieldErrors {
  const errors: EventFieldErrors = {};

  if (form.title.trim().length < 3) errors.title = 'titleTooShort';
  if (!form.date) errors.date = 'dateRequired';
  if (!form.location.trim()) errors.location = 'locationRequired';
  if (!form.categoryIds.length) errors.categoryIds = 'categoriesRequired';

  if (form.participationFee === '') errors.participationFee = 'feeRequired';
  else if (!(Number(form.participationFee) >= 0)) errors.participationFee = 'feeNegative';

  if (form.bankAccountReceiver.trim().length < 2) errors.bankAccountReceiver = 'receiverTooShort';
  if (!IBAN_PATTERN.test(normalizeIban(form.bankAccountIban))) errors.bankAccountIban = 'ibanInvalid';

  return errors;
}

export function isEventFormValid(errors: EventFieldErrors) {
  return Object.keys(errors).length === 0;
}

/* ---- Steps ---- */

/**
 * The form is asked one question at a time. Each step owns the fields that
 * answer its question, so a step can report its own state without knowing what
 * the rest of the form contains.
 */
export type EventStepId = 'identity' | 'when' | 'money' | 'categories';

export const EVENT_STEPS: readonly { id: EventStepId; fields: readonly (keyof EventFormState)[] }[] = [
  { id: 'identity', fields: ['title', 'description'] },
  { id: 'when', fields: ['date', 'arrivalTime', 'location'] },
  { id: 'money', fields: ['participationFee', 'bankAccountReceiver', 'bankAccountIban'] },
  { id: 'categories', fields: ['categoryIds'] },
];

export function isEventStepValid(errors: EventFieldErrors, index: number) {
  const step = EVENT_STEPS[index];
  if (!step) return true;
  return step.fields.every((field) => !errors[field]);
}

/** The step a failed save should land on. `-1` when nothing is wrong. */
export function firstInvalidEventStep(errors: EventFieldErrors) {
  return EVENT_STEPS.findIndex((_, index) => !isEventStepValid(errors, index));
}

/** Keeps a step index inside the form no matter where it came from. */
export function clampEventStep(index: number) {
  return Math.min(Math.max(index, 0), EVENT_STEPS.length - 1);
}

/** What goes on the wire. The form holds strings; the API wants numbers and nulls. */
export function eventPayload(form: EventFormState) {
  return {
    title: form.title.trim(),
    date: form.date,
    location: form.location.trim(),
    description: form.description,
    arrivalTime: form.arrivalTime || null,
    participationFee: Number(form.participationFee),
    bankAccountIban: normalizeIban(form.bankAccountIban),
    bankAccountReceiver: form.bankAccountReceiver.trim(),
    categoryIds: form.categoryIds,
  };
}

export function toggleCategoryId(ids: string[], categoryId: string) {
  return ids.includes(categoryId) ? ids.filter((id) => id !== categoryId) : [...ids, categoryId];
}

/* ---- The listing ---- */

/**
 * Three buckets, because they are the three different jobs: an event the public
 * can see and enter, one still being written, and one already played.
 */
export type EventBucket = 'UPCOMING' | 'DRAFT' | 'COMPLETED';

export const EVENT_FACET_VALUES = ['UPCOMING', 'DRAFT', 'COMPLETED'] as const;

export function eventBucket(event: EventDto): EventBucket {
  if (event.status === 'COMPLETED') return 'COMPLETED';
  if (!event.isPublished) return 'DRAFT';
  return 'UPCOMING';
}

export const eventReader: DirectoryReader<EventDto> = {
  text: (event) => [event.title, event.location, ...event.categories.map((category) => category.name)],
  facet: eventBucket,
};

const bucketOrder: Record<EventBucket, number> = { UPCOMING: 0, DRAFT: 1, COMPLETED: 2 };

/**
 * Soonest first among the live ones, most recent first among the finished —
 * a completed event from last week matters more than one from last season.
 */
export function compareEvents(left: EventDto, right: EventDto) {
  const leftBucket = eventBucket(left);
  const rightBucket = eventBucket(right);
  const byBucket = bucketOrder[leftBucket] - bucketOrder[rightBucket];
  if (byBucket) return byBucket;

  const byDate = new Date(left.date).getTime() - new Date(right.date).getTime();
  return leftBucket === 'COMPLETED' ? -byDate : byDate;
}

export function sortEvents(events: EventDto[]) {
  return [...events].sort(compareEvents);
}
