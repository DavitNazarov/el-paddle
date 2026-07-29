import type { MatchDto } from '@/types/tournament';

/**
 * Mirror of the server slot rules, used only to phrase the confirmation modal.
 * The server stays authoritative for what actually completes a match.
 */
export function slotsToWin(match: Pick<MatchDto, 'slotCount' | 'slotsToWin'>) {
  return match.slotsToWin ?? match.slotCount ?? 1;
}

export function maxSlotsFor(match: Pick<MatchDto, 'slotCount' | 'slotsToWin' | 'maxSlots'>) {
  return match.maxSlots ?? slotsToWin(match) * 2 - 1;
}

/** Whether giving this side one more slot would finish the match. */
export function willCompleteMatch(currentTally: number, winsNeeded: number) {
  return currentTally + 1 >= winsNeeded;
}
