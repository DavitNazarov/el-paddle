/**
 * Pure reading for My profile. Kept out of the components so the record maths —
 * the one thing on this page a reader would notice being wrong — can be tested
 * without rendering anything.
 */

import type { UserRole, UserStatus } from '@/types/auth';

export type PlayerRecord = { matchesPlayed: number; wins: number; losses: number };

/**
 * Win rate as a whole percent, or `null` when nothing has been played. The null
 * is the point: a competitor with no completed matches has no win rate, and a
 * rendered `0%` would read as "you lose everything".
 */
export function winRate(record: PlayerRecord): number | null {
  if (record.matchesPlayed <= 0) return null;
  return Math.round((record.wins / record.matchesPlayed) * 100);
}

export type RecordArc = {
  tone: 'win' | 'loss';
  /** Length of the arc as a percentage of the ring. */
  share: number;
  /** Where the arc starts; 25 is twelve o'clock at this radius. */
  offset: number;
};

/**
 * The record drawn as a closed ring. The losing share is derived from what is
 * left rather than read from `losses`, so the ring always closes — every
 * completed match is either a win or a loss, and a gap would imply a third
 * outcome that does not exist. Shares stay unrounded so the two arcs meet
 * exactly; only the label the reader sees is rounded.
 */
export function recordArcs(record: PlayerRecord): RecordArc[] {
  if (record.matchesPlayed <= 0) return [];
  const winShare = (record.wins / record.matchesPlayed) * 100;
  const lossShare = 100 - winShare;
  const arcs: RecordArc[] = [];
  if (winShare > 0) arcs.push({ tone: 'win', share: winShare, offset: 25 });
  if (lossShare > 0) arcs.push({ tone: 'loss', share: lossShare, offset: 25 - winShare });
  return arcs;
}

export type AccountStateKey =
  | 'stateActive'
  | 'statePendingVerification'
  | 'stateInvited'
  | 'stateInactive';

/** Account state in the reader's own terms — never the raw enum. */
export function accountStateKey(status: UserStatus): AccountStateKey {
  if (status === 'ACTIVE') return 'stateActive';
  if (status === 'PENDING_VERIFICATION') return 'statePendingVerification';
  if (status === 'INVITED') return 'stateInvited';
  return 'stateInactive';
}

/** Only an active account is a finished one; the rest are waiting on something. */
export function accountStateTone(status: UserStatus): 'positive' | 'warning' {
  return status === 'ACTIVE' ? 'positive' : 'warning';
}

/**
 * Whether `/players/:id` would actually resolve for this reader. The public
 * directory serves active players only, so offering the link to anyone else
 * would be a doorway into a 404.
 */
export function hasPublicPlayerPage(user: { role: UserRole; status: UserStatus }): boolean {
  return user.role === 'USER' && user.status === 'ACTIVE';
}
