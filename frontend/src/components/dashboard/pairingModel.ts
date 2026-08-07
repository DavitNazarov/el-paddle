import type {
  LiveRequestStatus,
  ReceivedRequestDto,
  RegistrationDto,
  RequestWindowDto,
  SentRequestDto,
} from '@/types/dashboard';

/**
 * The second question a competitor asks their home screen, after "am I in":
 * *who do I play*. `entryStatusModel` answers the first; this answers the
 * second, and the two are deliberately separate — an approved entry can be
 * waiting on an opponent's reply, and an entry the organiser has not touched
 * cannot ask anyone at all.
 *
 * It returns a state, not sentences or buttons, so the same reading drives the
 * note and the action row and they can never disagree.
 */

export type PairingState =
  /** Someone asked to play this team: answering outranks asking. */
  | { kind: 'respond'; count: number }
  /** This team already asked someone. `status` says who is holding it up. */
  | { kind: 'sent'; status: LiveRequestStatus; opponent: string }
  /** Approved, nobody asked, and the window is open — the team may choose. */
  | { kind: 'ask' }
  /** Approved, but choosing an opponent is not open (or no longer open). */
  | { kind: 'closed' }
  /** Nothing to say: no approved entry of the reader's own, or the draw settled it. */
  | { kind: 'none' };

export type PairingInput = {
  eventId: string;
  /** The reader's *own* entries in this event — club mates' teams cannot be spoken for. */
  entries: RegistrationDto[];
  received: ReceivedRequestDto[];
  sent: SentRequestDto[];
  windows: RequestWindowDto[];
};

function pairLabel(pair: { ownerName: string; teammateName: string }) {
  return `${pair.ownerName} / ${pair.teammateName}`;
}

export function pairingState({ eventId, entries, received, sent, windows }: PairingInput): PairingState {
  const approved = entries.filter((entry) => entry.status === 'APPROVED');
  if (!approved.length) return { kind: 'none' };

  // Once the draw is published the pairing conversation is over — the bracket
  // decided it, and the match itself is what the player wants next.
  if (approved.some((entry) => entry.inDraw)) return { kind: 'none' };

  const waiting = received.filter((request) => request.eventId === eventId);
  if (waiting.length) return { kind: 'respond', count: waiting.length };

  const outgoing = sent.find((request) => request.eventId === eventId);
  if (outgoing) return { kind: 'sent', status: outgoing.status, opponent: pairLabel(outgoing.to) };

  const open = approved.some((entry) =>
    windows.some(
      (window) => window.eventId === eventId && window.categoryId === entry.category.id && window.open,
    ),
  );
  return open ? { kind: 'ask' } : { kind: 'closed' };
}

export type PairingNoteKey =
  | 'pairingWaiting'
  | 'pairingAccepted'
  | 'pairingConflicted'
  | 'pairingConfirmed'
  | 'pairingClosed';

/**
 * The one-line explanation under a pairing state. Only the states the player
 * cannot act on get one: 'ask' and 'respond' are already said by their button,
 * and repeating a button in prose is noise.
 */
export function pairingNoteKey(state: PairingState): PairingNoteKey | null {
  if (state.kind === 'closed') return 'pairingClosed';
  if (state.kind !== 'sent') return null;
  switch (state.status) {
    case 'PENDING_RESPONSE':
      return 'pairingWaiting';
    case 'ACCEPTED_BY_OPPONENT':
      return 'pairingAccepted';
    case 'CONFLICTED':
      return 'pairingConflicted';
    default:
      return 'pairingConfirmed';
  }
}
