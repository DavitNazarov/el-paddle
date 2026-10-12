import type { Locale } from '@/lib/i18n/types';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import type { EventWorkspaceSignals } from '@/hooks/useEventWorkspaceSignals';
import type { EventDto } from '@/types/admin';

/**
 * What is waiting on the operator, in the order it is costing them.
 *
 * The workspace used to state where an event had reached and leave the reader to
 * work out what that implied. Running an event is a queue of decisions, and the
 * expensive ones are invisible: a free court with matches waiting is dead time
 * that no status word reports. This reads the live counts and names the thing
 * itself, so the screen opens with an instruction rather than a report.
 *
 * Pure, and deliberately so — the ordering is the product decision here, and it
 * is the part worth pinning with tests.
 */

export type AgendaTone =
  /** Costing time right now. */
  | 'urgent'
  /** Blocking a later stage, but nothing is standing idle because of it. */
  | 'todo';

export type AgendaItem = {
  key: string;
  /** What is waiting, phrased as the fact the operator acts on. */
  headline: string;
  /** The screen where it is resolved. */
  href: string;
  action: string;
  tone: AgendaTone;
};

type EventCopy = (typeof tournamentCopy)[Locale]['admin']['event'];

/**
 * English needs a different sentence for one than for many, and a headline is
 * the most-read line on the screen — too prominent to say "1 courts are free".
 * Georgian keeps one form, so both keys there hold the same wording.
 */
function count(copy: EventCopy, one: keyof EventCopy, many: keyof EventCopy, value: number) {
  return value === 1 ? copy[one] as string : fillTemplate(copy[many] as string, { count: value });
}

/**
 * Everything waiting, most costly first.
 *
 * A completed event is history: its queues may well be non-empty, but nothing
 * there is being asked of anyone, so the agenda is empty by definition.
 */
export function eventAgenda(event: EventDto, signals: EventWorkspaceSignals, copy: EventCopy): AgendaItem[] {
  if (event.status === 'COMPLETED') return [];

  const base = `/admin/events/${event.id}`;
  const items: AgendaItem[] = [];
  const running = event.status === 'ONGOING';
  const idleCourts = signals.schedule?.courtsIdle ?? 0;

  // A court standing free while matches wait on it is the only thing here that
  // is costing time as it is being read, so it outranks every decision queue.
  if (running && idleCourts > 0) {
    items.push({
      key: 'courts-idle',
      headline: count(copy, 'courtsIdleOne', 'courtsIdleMany', idleCourts),
      href: `${base}/control`,
      action: copy.courtsIdleAction,
      tone: 'urgent',
    });
  }

  // Only worth saying separately when no court is idle; otherwise it is the
  // same instruction twice, and the idle court is the sharper way to put it.
  if (running && idleCourts === 0 && (signals.control?.ready ?? 0) > 0) {
    items.push({
      key: 'matches-ready',
      headline: count(copy, 'matchesReadyOne', 'matchesReadyMany', signals.control!.ready),
      href: `${base}/control`,
      action: copy.matchesReadyAction,
      tone: 'urgent',
    });
  }

  // Entries and pairings both gate the draw, so they are asked for before it.
  // Once play has begun they are no longer holding anything up.
  if ((signals.registrations?.pending ?? 0) > 0) {
    items.push({
      key: 'entries-pending',
      headline: count(copy, 'entriesPendingOne', 'entriesPendingMany', signals.registrations!.pending),
      href: `${base}/registrations`,
      action: copy.entriesPendingAction,
      tone: running ? 'todo' : 'urgent',
    });
  }

  if ((signals.requests?.awaiting ?? 0) > 0) {
    items.push({
      key: 'requests-awaiting',
      headline: count(copy, 'requestsAwaitingOne', 'requestsAwaitingMany', signals.requests!.awaiting),
      href: `${base}/opponent-requests`,
      action: copy.requestsAwaitingAction,
      tone: running ? 'todo' : 'urgent',
    });
  }

  // A draw is only overdue once registration has closed. Before that its absence
  // is the normal state of an event, not an omission to report.
  const preparing = event.status === 'REGISTRATION_CLOSED' || running;
  if (preparing && signals.brackets) {
    const { locked, total } = signals.brackets;
    if (total === 0) {
      items.push({
        key: 'draw-missing',
        headline: copy.drawMissing,
        href: `${base}/bracket`,
        action: copy.drawMissingAction,
        tone: 'todo',
      });
    } else if (locked < total) {
      items.push({
        key: 'draw-unlocked',
        headline: count(copy, 'drawUnlockedOne', 'drawUnlockedMany', total - locked),
        href: `${base}/bracket`,
        action: copy.drawUnlockedAction,
        tone: 'todo',
      });
    }
  }

  // Courts are only worth asking for once there is a locked draw to put on them.
  if (preparing && (signals.brackets?.locked ?? 0) > 0 && signals.schedule) {
    if (signals.schedule.courts === 0) {
      items.push({
        key: 'courts-missing',
        headline: copy.courtsMissing,
        href: `${base}/schedule`,
        action: copy.courtsMissingAction,
        tone: 'todo',
      });
    } else if (signals.schedule.unscheduled > 0) {
      items.push({
        key: 'matches-unscheduled',
        headline: count(copy, 'matchesUnscheduledOne', 'matchesUnscheduledMany', signals.schedule.unscheduled),
        href: `${base}/schedule`,
        action: copy.matchesUnscheduledAction,
        tone: 'todo',
      });
    }
  }

  return items;
}

/**
 * What the screen says when the agenda is empty. Silence would read as a screen
 * that had not finished loading, and "nothing to do" is only ever true of the
 * stage the event is in — so each stage says what it is now waiting for instead.
 */
export function agendaAllClear(event: EventDto, copy: EventCopy) {
  if (event.status === 'REGISTRATION_OPEN') return copy.clearRegistration;
  if (event.status === 'REGISTRATION_CLOSED') return copy.clearPreparing;
  if (event.status === 'ONGOING') return copy.clearRunning;
  return copy.clearCompleted;
}
