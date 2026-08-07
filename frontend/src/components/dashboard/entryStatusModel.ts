import type { RegistrationDto } from '@/types/dashboard';

/**
 * The one place that reads a registration's status for a player. Every entry
 * rendering — home hero, entry cards, list rows — goes through this model, so
 * the rail, the badge, and the "what happens next" sentence can never disagree.
 *
 * It returns copy *keys* (resolved against `tournamentCopy[locale].playerHome`),
 * not sentences, so it is testable without a locale and the client owns every
 * word.
 */

/** Entry states still on the path to playing, in the order they happen. */
export const entryPath = ['stepSubmitted', 'stepApproved', 'stepPlaying'] as const;

export type EntryStatusInput = Pick<RegistrationDto, 'status' | 'inDraw'>;

export type EntryStage =
  | {
      kind: 'path';
      /** 0 = submitted, 1 = approved, 2 = in a published draw. */
      step: 0 | 1 | 2;
      /**
       * Set when the current stop needs a flag: the player must act
       * (NEEDS_CHANGES) or is honestly told they are in line (WAITLISTED).
       * A plain PENDING or APPROVED entry carries no flag.
       */
      attention: 'NEEDS_CHANGES' | 'WAITLISTED' | null;
    }
  | { kind: 'blocked' };

export function entryStage(registration: EntryStatusInput): EntryStage {
  switch (registration.status) {
    case 'APPROVED':
      return { kind: 'path', step: registration.inDraw ? 2 : 1, attention: null };
    case 'PENDING':
      return { kind: 'path', step: 0, attention: null };
    case 'NEEDS_CHANGES':
      return { kind: 'path', step: 0, attention: 'NEEDS_CHANGES' };
    case 'WAITLISTED':
      return { kind: 'path', step: 0, attention: 'WAITLISTED' };
    default:
      return { kind: 'blocked' };
  }
}

/** Back-compat step number: -1 for blocked states, else the rail position. */
export function entryStep(registration: EntryStatusInput): number {
  const stage = entryStage(registration);
  return stage.kind === 'path' ? stage.step : -1;
}

export type EntryNoteKey =
  | 'underReview'
  | 'needsChangesNote'
  | 'waitlistedNote'
  | 'approvedNote'
  | 'inDrawNote'
  | 'declinedNote'
  | 'withdrawnNote'
  | 'cancelledNote';

/**
 * The one-line "what happens next" sentence under an entry. Every status has
 * one — silence reads as broken, an explicit "nothing needed from you" reads
 * as a working system.
 */
export function entryNoteKey(registration: EntryStatusInput): EntryNoteKey {
  switch (registration.status) {
    case 'PENDING':
      return 'underReview';
    case 'NEEDS_CHANGES':
      return 'needsChangesNote';
    case 'WAITLISTED':
      return 'waitlistedNote';
    case 'APPROVED':
      return registration.inDraw ? 'inDrawNote' : 'approvedNote';
    case 'DECLINED':
      return 'declinedNote';
    case 'WITHDRAWN':
      return 'withdrawnNote';
    default:
      return 'cancelledNote';
  }
}

/** True when the entry is waiting on the *player*, not on an organiser. */
export function entryNeedsPlayer(registration: EntryStatusInput): boolean {
  return registration.status === 'NEEDS_CHANGES';
}
