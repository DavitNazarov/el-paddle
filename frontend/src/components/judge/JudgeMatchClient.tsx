'use client';

import Link from 'next/link';
import { ArrowRight, Minus, Plus, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { PublicUser } from '@/types/auth';
import type { MatchDto, ScheduleItemDto } from '@/types/tournament';
import { apiFetch, createCommandId } from '@/lib/api';
import { JudgeShell } from './JudgeShell';
import { findNextCourtMatchId } from './judgeQueue';
import { maxSlotsFor, slotsToWin, willCompleteMatch } from './slotEngine';
import { BackLink, CommandButton, InlineNotice, StatusLabel, TournamentPanel, TournamentSectionHeader } from '@/components/tournament/TournamentUI';
import { DashboardModal } from '@/components/shared/dashboard/DashboardUI';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import { useTournamentRealtime } from '@/hooks/useTournamentRealtime';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy, tournamentRound, tournamentStatus } from '@/lib/i18n/tournament';

function pairName(entry: MatchDto['participantA'], fallback: string) {
  return entry ? `${entry.owner.fullName} / ${entry.teammate.fullName}` : fallback;
}

/**
 * A pending slot confirmation. The commandId is minted when the modal opens and kept until the
 * judge cancels or succeeds, so retrying after a dropped response replays the same command.
 */
type SlotConfirmation = { side: 'A' | 'B'; slotNumber: number; commandId: string };

export function JudgeMatchClient({ user, matchId }: { user: PublicUser; matchId: string }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
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
    if (!response.ok) setError(data.error ?? copy.judge.match.loadError); else {
      const loadedMatch = data.match ?? null;
      setMatch(loadedMatch);
      setError('');
      if (loadedMatch) void loadNextFight(loadedMatch);
    }
  }, [copy.judge.match.loadError, loadNextFight, matchId]);

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
    setBusy(''); if (!response.ok) setError(data.error ?? copy.judge.match.startError); else setMatch(data.match ?? match);
  }

  async function score(side: 'A' | 'B', action: 'INCREMENT' | 'DECREMENT') {
    if (!match) return;
    setBusy(`${side}-${action}`); setError('');
    const response = await apiFetch(`/api/judge/matches/${match.id}/score`, { method: 'POST', body: JSON.stringify({ side, action, expectedVersion: match.version, commandId: createCommandId('score') }) });
    const data = await response.json() as { match?: MatchDto; error?: string };
    setBusy('');
    if (!response.ok) { setError(data.error ?? copy.judge.match.scoreError); void load(); } else applyResult(data.match ?? match);
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
    if (!response.ok) { setError(data.error ?? copy.judge.match.slotError); void load(); return; }
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
    if (!response.ok) { setError(data.error ?? copy.judge.match.undoError); void load(); return; }
    setUndoOpen(false);
    applyResult(data.match ?? match);
  }

  const usesSlots = match?.scoringMode === 'SLOTS';
  const winsNeeded = match ? slotsToWin(match) : 1;
  const confirmedSide = confirmation && match ? (confirmation.side === 'A' ? match.participantA : match.participantB) : null;
  const confirmedTally = confirmation && match ? (confirmation.side === 'A' ? match.scoreA : match.scoreB) : 0;
  const confirmCompletes = Boolean(confirmation) && willCompleteMatch(confirmedTally, winsNeeded);
  const lastSlotNumber = match?.slots.at(-1)?.slotNumber ?? 0;

  return (
    <JudgeShell
      user={user}
      title={match ? `${tournamentRound(locale, match.round)} · ${copy.common.match} ${match.matchNumber}` : copy.judge.match.title}
      description={copy.judge.match.description}
    >
      {match?.scheduleItem ? (
        <div className="mb-4">
          <BackLink href={`/judge/events/${match.bracket?.eventId}/courts/${match.scheduleItem.courtId}`}>{copy.judge.match.courtQueue}</BackLink>
        </div>
      ) : null}
      {error ? <div className="mb-4"><InlineNotice kind="error">{error}</InlineNotice></div> : null}

      {match ? (
        <TournamentPanel>
          <TournamentSectionHeader
            title={usesSlots ? copy.judge.match.slotScore : copy.judge.match.liveScore}
            description={usesSlots ? copy.judge.match.slotDescription : copy.judge.match.liveDescription}
            actions={<StatusLabel icon={match.status === 'COMPLETED' ? 'check' : 'dot'}>{tournamentStatus(locale, match.status)}</StatusLabel>}
          />

          {usesSlots ? (
            <SlotScoreboard
              busy={busy}
              match={match}
              onPick={(side, slotNumber) => setConfirmation({ side, slotNumber, commandId: createCommandId('slot-decide') })}
              onUndo={() => setUndoOpen(true)}
            />
          ) : (
            <div className="grid gap-4 bg-[#f8f5f2] p-4 md:grid-cols-2">
              <ScoreSide label={copy.common.sideA} entry={match.participantA} score={match.scoreA} disabled={match.status !== 'IN_PROGRESS'} busy={busy} onIncrement={() => score('A', 'INCREMENT')} onDecrement={() => score('A', 'DECREMENT')} />
              <ScoreSide label={copy.common.sideB} entry={match.participantB} score={match.scoreB} disabled={match.status !== 'IN_PROGRESS'} busy={busy} onIncrement={() => score('B', 'INCREMENT')} onDecrement={() => score('B', 'DECREMENT')} />
            </div>
          )}

          {match.status === 'READY' ? (
            <div className="border-t border-[var(--dash-border)] bg-white p-4">
              <CommandButton tone="primary" className="w-full" busy={busy === 'start'} onClick={start}>{copy.judge.match.start}</CommandButton>
            </div>
          ) : null}

          {match.status === 'COMPLETED' ? (
            <div className="flex flex-col gap-3 border-t border-[var(--dash-border)] bg-[var(--dash-teal-soft)] px-5 py-4 text-sm font-medium text-[var(--dash-teal)] sm:flex-row sm:items-center sm:justify-between">
              <p role="status">{copy.judge.match.complete}</p>
              {nextMatchId ? (
                <CommandButton asChild tone="primary" className="min-h-11 w-full sm:w-auto">
                  <Link href={`/judge/matches/${nextMatchId}`}>{copy.judge.match.nextFight}<ArrowRight aria-hidden="true" /></Link>
                </CommandButton>
              ) : null}
            </div>
          ) : null}
        </TournamentPanel>
      ) : (
        <p className="text-sm text-[var(--dash-muted)]">{copy.judge.match.loading}</p>
      )}

      <DashboardModal
        open={Boolean(confirmation)}
        onOpenChange={(open) => { if (!open && busy !== 'slot') setConfirmation(null); }}
        title={copy.judge.match.confirmTitle}
        size="md"
        footer={(
          <ModalFormFooter
            onCancel={() => setConfirmation(null)}
            cancelLabel={copy.common.cancel}
            submitType="button"
            onSubmitClick={() => { void submitSlot(); }}
            busy={busy === 'slot'}
            submitLabel={busy === 'slot' ? copy.judge.match.recording : copy.judge.match.confirmSubmit}
          />
        )}
      >
        <p className="text-sm leading-6 text-[rgba(88,16,16,0.72)]">
          {confirmation && match ? (
            confirmCompletes
              ? fillTemplate(copy.judge.match.confirmBodyFinal, {
                  number: confirmation.slotNumber,
                  pair: pairName(confirmedSide, copy.judge.match.participantPending),
                  a: confirmation.side === 'A' ? match.scoreA + 1 : match.scoreA,
                  b: confirmation.side === 'B' ? match.scoreB + 1 : match.scoreB,
                })
              : fillTemplate(copy.judge.match.confirmBody, {
                  number: confirmation.slotNumber,
                  pair: pairName(confirmedSide, copy.judge.match.participantPending),
                  side: confirmation.side,
                  next: confirmation.slotNumber + 1,
                })
          ) : null}
        </p>
      </DashboardModal>

      <DashboardModal
        open={undoOpen}
        onOpenChange={(open) => { if (!open && busy !== 'undo') setUndoOpen(false); }}
        title={fillTemplate(copy.judge.match.undoTitle, { number: lastSlotNumber })}
        size="md"
        footer={(
          <ModalFormFooter
            onCancel={() => setUndoOpen(false)}
            cancelLabel={copy.common.cancel}
            submitType="button"
            onSubmitClick={() => { void undoSlot(); }}
            busy={busy === 'undo'}
            submitLabel={copy.judge.match.undoSubmit}
          />
        )}
      >
        <p className="text-sm leading-6 text-[rgba(88,16,16,0.72)]">{fillTemplate(copy.judge.match.undoBody, { number: lastSlotNumber })}</p>
      </DashboardModal>
    </JudgeShell>
  );
}

function SlotScoreboard({
  busy,
  match,
  onPick,
  onUndo,
}: {
  busy: string;
  match: MatchDto;
  onPick: (side: 'A' | 'B', slotNumber: number) => void;
  onUndo: () => void;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const judgeCopy = copy.judge.match;
  const live = match.status === 'IN_PROGRESS';
  const currentSlot = match.slots.length + 1;
  const winsNeeded = slotsToWin(match);
  const upperBound = maxSlotsFor(match);

  return (
    <div className="bg-[#f8f5f2] p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--dash-border)] bg-white px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--dash-primary)]">
          {live ? fillTemplate(judgeCopy.slotOf, { number: currentSlot, max: upperBound }) : judgeCopy.awaitingStart}
        </p>
        <span className="text-xs font-semibold text-[var(--dash-muted)]">{fillTemplate(judgeCopy.firstTo, { count: winsNeeded })}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {(['A', 'B'] as const).map((side) => {
          const entry = side === 'A' ? match.participantA : match.participantB;
          const tally = side === 'A' ? match.scoreA : match.scoreB;
          return (
            <section key={side} className="overflow-hidden rounded-xl border border-[var(--dash-border)] bg-white p-5 shadow-sm sm:p-6" aria-label={side === 'A' ? copy.common.sideA : copy.common.sideB}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--dash-primary)]">{side === 'A' ? copy.common.sideA : copy.common.sideB}</p>
                  <h2 className="mt-2 min-h-12 text-base font-semibold leading-6 text-[var(--dash-text)]">{pairName(entry, judgeCopy.participantPending)}</h2>
                </div>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--dash-primary-soft)] text-xs font-bold text-[var(--dash-primary)]">{side}</span>
              </div>
              <p className="my-7 text-center font-mono text-7xl font-semibold tabular-nums text-[var(--dash-text)]" aria-live="polite">{tally}</p>
              <CommandButton
                tone="primary"
                className="min-h-14 w-full"
                busy={busy === 'slot'}
                disabled={!live}
                onClick={() => onPick(side, currentSlot)}
              >
                {fillTemplate(judgeCopy.sideWonSlot, { side, number: currentSlot })}
              </CommandButton>
            </section>
          );
        })}
      </div>

      {match.slots.length ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--dash-border)] bg-white px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--dash-faint)]">{judgeCopy.slotHistory}</span>
            <ul className="flex flex-wrap gap-2">
              {match.slots.map((slot) => (
                <li key={slot.slotNumber} className="inline-flex items-center gap-1 rounded-md border border-[var(--dash-border)] px-2 py-1 text-xs font-semibold tabular-nums text-[var(--dash-muted)]">
                  {fillTemplate(judgeCopy.slotChip, { number: slot.slotNumber })}
                  <span aria-hidden="true">·</span>
                  {slot.winnerSide === 'A' ? copy.common.sideA : copy.common.sideB}
                </li>
              ))}
            </ul>
          </div>
          {live ? (
            <CommandButton className="min-h-11" busy={busy === 'undo'} onClick={onUndo}>
              <Undo2 aria-hidden="true" />
              {judgeCopy.undo}
            </CommandButton>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ScoreSide({ label, entry, score, disabled, busy, onIncrement, onDecrement }: { label: string; entry: MatchDto['participantA']; score: number; disabled: boolean; busy: string; onIncrement: () => void; onDecrement: () => void }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].judge.match;
  return <section className="overflow-hidden rounded-xl border border-[var(--dash-border)] bg-white p-5 shadow-sm sm:p-6" aria-label={label}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--dash-primary)]">{label}</p><h2 className="mt-2 min-h-12 text-base font-semibold leading-6 text-[var(--dash-text)]">{entry ? `${entry.owner.fullName} / ${entry.teammate.fullName}` : copy.participantPending}</h2></div><span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--dash-primary-soft)] text-xs font-bold text-[var(--dash-primary)]">{label.slice(-1)}</span></div><p className="my-7 text-center font-mono text-7xl font-semibold tabular-nums text-[var(--dash-text)]" aria-live="polite">{score}</p><div className="grid grid-cols-2 gap-3"><CommandButton aria-label={fillTemplate(copy.subtractLabel, { side: label })} className="min-h-14" busy={busy.includes('DECREMENT')} disabled={disabled || score === 0} onClick={onDecrement}><Minus />{copy.subtract}</CommandButton><CommandButton tone="primary" aria-label={fillTemplate(copy.addLabel, { side: label })} className="min-h-14" busy={busy.includes('INCREMENT')} disabled={disabled || score === 6} onClick={onIncrement}><Plus />{copy.add}</CommandButton></div></section>;
}
