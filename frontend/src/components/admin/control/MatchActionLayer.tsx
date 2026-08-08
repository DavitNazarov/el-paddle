'use client';

import { useState } from 'react';
import { createCommandId } from '@/lib/api';
import { MatchSheet } from './MatchSheet';
import { ConfirmResultDialog, FinishMatchDialog, type FinishForm } from './ControlDialogs';
import { participantOf } from './matchModel';
import type { ControlConsole } from './useControlConsole';

/**
 * Everything that can be done to a match, in one mounted layer: the sheet the
 * operator acts through and the two confirmations that guard the irreversible
 * commands. The console and the single-court screen both hand it the match they
 * have open and nothing else, so neither has to carry the wiring twice.
 *
 * Only ids are held. A realtime reload replaces every match object underneath
 * an open dialog, and commanding a stale copy would send a stale version.
 */
export function MatchActionLayer({
  desk,
  eventId,
  onClose,
  openMatchId,
}: {
  desk: ControlConsole;
  eventId: string;
  onClose: () => void;
  openMatchId: string | null;
}) {
  const { board, busy, commands, locked } = desk;
  const [confirmation, setConfirmation] = useState<{ matchId: string; setsA: number; setsB: number; commandId: string } | null>(null);
  const [finishingId, setFinishingId] = useState<string | null>(null);

  const open = openMatchId ? board.byMatchId.get(openMatchId) ?? null : null;
  const confirming = confirmation ? board.byMatchId.get(confirmation.matchId)?.match ?? null : null;
  const finishing = finishingId ? board.byMatchId.get(finishingId)?.match ?? null : null;

  async function submitResult() {
    if (!confirmation || !confirming) return;
    const ok = await commands.recordResult(confirming, confirmation.setsA, confirmation.setsB, confirmation.commandId);
    if (ok) { setConfirmation(null); onClose(); }
  }

  async function finishEarly(form: FinishForm) {
    if (!finishing) return;
    const winnerEntryId = participantOf(finishing, form.side)?.id;
    if (!winnerEntryId) return;
    const ok = await commands.finishEarly(finishing, form, winnerEntryId);
    if (ok) { setFinishingId(null); onClose(); }
  }

  return (
    <>
      <MatchSheet
        busy={busy}
        entry={open}
        eventId={eventId}
        locked={locked}
        nextMatch={open?.match.nextMatchId ? board.byMatchId.get(open.match.nextMatchId) ?? null : null}
        onClose={onClose}
        onStart={(match) => { void commands.start(match); }}
        onSaveTime={(match, iso) => { void commands.saveTime(match, iso); }}
        onFinish={(match) => setFinishingId(match.id)}
        onRecordResult={(match, setsA, setsB) =>
          setConfirmation({ matchId: match.id, setsA, setsB, commandId: createCommandId('match-result') })}
      />

      <ConfirmResultDialog
        busy={busy.startsWith('result-')}
        match={confirming}
        setsA={confirmation?.setsA ?? 0}
        setsB={confirmation?.setsB ?? 0}
        onCancel={() => setConfirmation(null)}
        onConfirm={() => { void submitResult(); }}
      />

      <FinishMatchDialog
        busy={busy.startsWith('finish-')}
        match={finishing}
        onOpenChange={(next) => { if (!next) setFinishingId(null); }}
        onSubmit={finishEarly}
      />
    </>
  );
}
