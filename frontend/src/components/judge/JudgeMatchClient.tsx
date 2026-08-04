'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { PublicUser } from '@/types/auth';
import type { MatchDto, ScheduleItemDto } from '@/types/tournament';
import { apiFetch, createCommandId } from '@/lib/api';
import { JudgeShell } from './JudgeShell';
import { findNextCourtMatchId } from './judgeQueue';
import { BackLink, CommandButton, InlineNotice } from '@/components/tournament/TournamentUI';
import { DashboardModal } from '@/components/shared/dashboard/DashboardUI';
import { SkeletonCards } from '@/components/shared/dashboard/Feedback';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import { useTournamentRealtime } from '@/hooks/useTournamentRealtime';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy, tournamentRound } from '@/lib/i18n/tournament';
import {
  MatchComplete,
  PointSides,
  SlotBand,
  SlotHistory,
  SlotSides,
  confirmBodyClassName,
  confirmScoreClassName,
  consoleClassName,
  startPanelClassName,
} from './match/MatchConsole';
import {
  lastSlotNumber,
  pairName,
  participantOf,
  previewSlot,
  usesSlots,
  type Side,
} from './match/matchModel';

/**
 * A pending slot confirmation. The commandId is minted when the modal opens and kept until the
 * judge cancels or succeeds, so retrying after a dropped response replays the same command.
 */
type SlotConfirmation = { side: Side; slotNumber: number; commandId: string };

/**
 * The judge match console — the most safety-critical screen in the product.
 * Both pair names carry the largest type on the page because they are what a
 * judge checks against the two people on court; the score is subordinate to
 * them. Nothing is ever one tap from being recorded.
 */
export function JudgeMatchClient({ user, matchId }: { user: PublicUser; matchId: string }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const judge = copy.judge.match;
  const [match, setMatch] = useState<MatchDto | null>(null);
  const [nextMatchId, setNextMatchId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [confirmation, setConfirmation] = useState<SlotConfirmation | null>(null);
  const [undoOpen, setUndoOpen] = useState(false);

  const loadNextFight = useCallback(async (completedMatch: MatchDto) => {
    const scheduleItem = completedMatch.scheduleItem;
    const eventId = completedMatch.bracket?.eventId;
    if (completedMatch.status !== 'COMPLETED' || !scheduleItem || !eventId) {
      setNextMatchId(null);
      return;
    }

    try {
      const response = await apiFetch(`/api/judge/events/${eventId}/courts/${scheduleItem.courtId}/queue`, { cache: 'no-store' });
      const data = await response.json() as { items?: ScheduleItemDto[] };
      setNextMatchId(response.ok ? findNextCourtMatchId(data.items ?? [], scheduleItem) : null);
    } catch {
      setNextMatchId(null);
    }
  }, []);

  const load = useCallback(async () => {
    setNextMatchId(null);
    const response = await apiFetch(`/api/judge/matches/${matchId}`, { cache: 'no-store' });
    const data = await response.json() as { match?: MatchDto; error?: string };
    if (!response.ok) setError(data.error ?? judge.loadError); else {
      const loadedMatch = data.match ?? null;
      setMatch(loadedMatch);
      setError('');
      if (loadedMatch) void loadNextFight(loadedMatch);
    }
  }, [judge.loadError, loadNextFight, matchId]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  useTournamentRealtime({ eventId: match?.bracket?.eventId, matchId, onChange: load });

  function applyResult(updatedMatch: MatchDto) {
    setMatch(updatedMatch);
    setNextMatchId(null);
    if (updatedMatch.status === 'COMPLETED') void loadNextFight(updatedMatch);
  }

  async function start() {
    if (!match) return;
    setBusy('start'); setError('');
    const response = await apiFetch(`/api/judge/matches/${match.id}/start`, { method: 'POST', body: JSON.stringify({ expectedVersion: match.version, commandId: createCommandId('match-start') }) });
    const data = await response.json() as { match?: MatchDto; error?: string };
    setBusy(''); if (!response.ok) setError(data.error ?? judge.startError); else setMatch(data.match ?? match);
  }

  async function score(side: Side, action: 'INCREMENT' | 'DECREMENT') {
    if (!match) return;
    setBusy(`${side}-${action}`); setError('');
    const response = await apiFetch(`/api/judge/matches/${match.id}/score`, { method: 'POST', body: JSON.stringify({ side, action, expectedVersion: match.version, commandId: createCommandId('score') }) });
    const data = await response.json() as { match?: MatchDto; error?: string };
    setBusy('');
    if (!response.ok) { setError(data.error ?? judge.scoreError); void load(); } else applyResult(data.match ?? match);
  }

  async function submitSlot() {
    if (!match || !confirmation) return;
    setBusy('slot'); setError('');
    const response = await apiFetch(`/api/judge/matches/${match.id}/slots`, {
      method: 'POST',
      body: JSON.stringify({ slotNumber: confirmation.slotNumber, winnerSide: confirmation.side, expectedVersion: match.version, commandId: confirmation.commandId }),
    });
    const data = await response.json() as { match?: MatchDto; error?: string };
    setBusy('');
    if (!response.ok) { setError(data.error ?? judge.slotError); void load(); return; }
    setConfirmation(null);
    applyResult(data.match ?? match);
  }

  async function undoSlot() {
    if (!match) return;
    setBusy('undo'); setError('');
    const response = await apiFetch(`/api/judge/matches/${match.id}/slots/undo`, {
      method: 'POST',
      body: JSON.stringify({ expectedVersion: match.version, commandId: createCommandId('slot-undo') }),
    });
    const data = await response.json() as { match?: MatchDto; error?: string };
    setBusy('');
    if (!response.ok) { setError(data.error ?? judge.undoError); void load(); return; }
    setUndoOpen(false);
    applyResult(data.match ?? match);
  }

  const outcome = match && confirmation ? previewSlot(match, confirmation.side, confirmation.slotNumber) : null;
  const confirmedPair = match && confirmation
    ? pairName(participantOf(match, confirmation.side), judge.participantPending)
    : '';

  return (
    <JudgeShell
      user={user}
      title={match ? `${tournamentRound(locale, match.round)} · ${copy.common.match} ${match.matchNumber}` : judge.title}
      description={judge.description}
    >
      {match?.scheduleItem ? (
        <div className="mb-4">
          <BackLink href={`/judge/events/${match.bracket?.eventId}/courts/${match.scheduleItem.courtId}`}>{judge.courtQueue}</BackLink>
        </div>
      ) : null}
      {error ? <div className="mb-4"><InlineNotice kind="error">{error}</InlineNotice></div> : null}

      {match ? (
        <div className={consoleClassName}>
          {usesSlots(match) ? (
            <>
              <SlotBand match={match} />
              <SlotSides
                match={match}
                busy={busy}
                onPick={(side, slotNumber) => setConfirmation({ side, slotNumber, commandId: createCommandId('slot-decide') })}
              />
              <SlotHistory match={match} busy={busy} onUndo={() => setUndoOpen(true)} />
            </>
          ) : (
            <PointSides match={match} busy={busy} onScore={score} />
          )}

          {match.status === 'READY' ? (
            <div className={startPanelClassName}>
              <CommandButton tone="primary" className="min-h-14 w-full" busy={busy === 'start'} onClick={start}>
                {judge.start}
              </CommandButton>
            </div>
          ) : null}

          {match.status === 'COMPLETED' ? (
            <MatchComplete>
              {nextMatchId ? (
                <CommandButton asChild tone="primary" className="min-h-11 w-full sm:w-auto">
                  <Link href={`/judge/matches/${nextMatchId}`}>{judge.nextFight}<ArrowRight aria-hidden="true" /></Link>
                </CommandButton>
              ) : null}
            </MatchComplete>
          ) : null}
        </div>
      ) : (
        <SkeletonCards count={2} columns={2} label={judge.loading} />
      )}

      <DashboardModal
        open={Boolean(confirmation)}
        onOpenChange={(open) => { if (!open && busy !== 'slot') setConfirmation(null); }}
        title={judge.confirmTitle}
        size="md"
        footer={(
          <ModalFormFooter
            onCancel={() => setConfirmation(null)}
            cancelLabel={copy.common.cancel}
            submitType="button"
            onSubmitClick={() => { void submitSlot(); }}
            busy={busy === 'slot'}
            submitLabel={busy === 'slot' ? judge.recording : judge.confirmSubmit}
          />
        )}
      >
        {outcome && confirmation ? (
          <>
            <p className={confirmBodyClassName}>
              {outcome.completes
                ? fillTemplate(judge.confirmBodyFinal, {
                    number: outcome.slotNumber,
                    pair: confirmedPair,
                    a: outcome.a,
                    b: outcome.b,
                  })
                : fillTemplate(judge.confirmBody, {
                    number: outcome.slotNumber,
                    pair: confirmedPair,
                    side: outcome.side,
                    next: outcome.slotNumber + 1,
                  })}
            </p>
            <p className={confirmScoreClassName}>
              {copy.common.sideA} {outcome.a} · {copy.common.sideB} {outcome.b}
            </p>
          </>
        ) : null}
      </DashboardModal>

      <DashboardModal
        open={undoOpen}
        onOpenChange={(open) => { if (!open && busy !== 'undo') setUndoOpen(false); }}
        title={fillTemplate(judge.undoTitle, { number: match ? lastSlotNumber(match) : 0 })}
        size="md"
        footer={(
          <ModalFormFooter
            onCancel={() => setUndoOpen(false)}
            cancelLabel={copy.common.cancel}
            submitType="button"
            onSubmitClick={() => { void undoSlot(); }}
            busy={busy === 'undo'}
            submitLabel={judge.undoSubmit}
          />
        )}
      >
        <p className={confirmBodyClassName}>
          {fillTemplate(judge.undoBody, { number: match ? lastSlotNumber(match) : 0 })}
        </p>
      </DashboardModal>
    </JudgeShell>
  );
}
