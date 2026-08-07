'use client';

import { useCallback, useEffect, useState } from 'react';
import type { BracketDto, MatchDto } from '@/types/tournament';
import type { EventDto } from '@/types/admin';
import { apiFetch, createCommandId } from '@/lib/api';
import { AdminShell } from './AdminShell';
import { MatchControlCard } from './control/MatchControlCard';
import { FinishMatchDialog, type FinishForm } from './control/ControlDialogs';
import {
  EmptyTournamentState,
  InlineNotice,
  TournamentPanel,
  TournamentSectionHeader,
} from '@/components/tournament/TournamentUI';
import { DashboardModal } from '@/components/shared/dashboard/DashboardUI';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import { SkeletonCards } from '@/components/shared/dashboard/Feedback';
import { useI18n } from '@/components/shared/I18nProvider';
import { useTournamentRealtime } from '@/hooks/useTournamentRealtime';
import { fillTemplate, tournamentCopy, tournamentRound } from '@/lib/i18n/tournament';
import { actionableMatches, buildControlSummary } from './control/controlModel';
import { activeRounds } from './bracket/bracketModel';
import { pairName, participantOf, type Side } from './control/matchModel';
import styles from './control/MatchControl.module.css';

/**
 * The match-day console. Bracket, courts and scoring answered one question each
 * on three different screens; this answers the only question an operator asks
 * while an event is running — what is happening on which court, between whom,
 * and where does the winner go — and lets them act on it without leaving.
 *
 * Every command goes to the existing scoring endpoints. Admins and the event's
 * organisers are unbound scorers on the server, so several courts can run at once.
 */
export function AdminMatchControlClient({ eventId }: { eventId: string }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const control = copy.admin.control;
  const [event, setEvent] = useState<EventDto | null>(null);
  const [brackets, setBrackets] = useState<BracketDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [confirmation, setConfirmation] = useState<{ match: MatchDto; setsA: number; setsB: number; commandId: string } | null>(null);
  const [finishing, setFinishing] = useState<MatchDto | null>(null);

  const isCompleted = event?.status === 'COMPLETED';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [eventResponse, bracketResponse] = await Promise.all([
        apiFetch(`/api/events/${eventId}`, { cache: 'no-store' }),
        apiFetch(`/api/admin/events/${eventId}/brackets`, { cache: 'no-store' }),
      ]);
      const eventData = await eventResponse.json() as { event?: EventDto; error?: string };
      const bracketData = await bracketResponse.json() as { brackets?: BracketDto[]; error?: string };
      if (!eventResponse.ok || !bracketResponse.ok) {
        setError(eventData.error ?? bracketData.error ?? control.loadError);
      } else {
        setEvent(eventData.event ?? null);
        setBrackets(bracketData.brackets ?? []);
        setError('');
      }
    } catch {
      setError(control.loadError);
    } finally {
      setLoading(false);
    }
  }, [control.loadError, eventId]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  useTournamentRealtime({ eventId, onChange: load });

  /** Every command reloads: the server decides what a set did to the draw, not the client. */
  async function send(key: string, path: string, body: unknown, failure: string) {
    setBusy(key);
    setError('');
    setNotice('');
    try {
      const response = await apiFetch(path, { method: 'POST', body: JSON.stringify(body) });
      const data = await response.json() as { error?: string };
      if (!response.ok) { setError(data.error ?? failure); return false; }
      return true;
    } catch {
      setError(failure);
      return false;
    } finally {
      setBusy('');
      await load();
    }
  }

  async function start(match: MatchDto) {
    await send(
      `start-${match.id}`,
      `/api/judge/matches/${match.id}/start`,
      { expectedVersion: match.version, commandId: createCommandId('match-start') },
      control.startError,
    );
  }

  async function submitResult() {
    if (!confirmation) return;
    const { match, setsA, setsB, commandId } = confirmation;
    const ok = await send(
      `result-${match.id}`,
      `/api/judge/matches/${match.id}/result`,
      { setsA, setsB, expectedVersion: match.version, commandId },
      control.resultError,
    );
    if (ok) setConfirmation(null);
  }

  async function finishEarly(form: FinishForm) {
    if (!finishing) return;
    const winnerEntryId = participantOf(finishing, form.side)?.id;
    if (!winnerEntryId) return;
    const ok = await send(
      `finish-${finishing.id}`,
      `/api/judge/matches/${finishing.id}/complete`,
      {
        winnerEntryId,
        resultType: form.resultType,
        reason: form.reason,
        expectedVersion: finishing.version,
        commandId: createCommandId('match-complete'),
      },
      control.finishError,
    );
    if (ok) setFinishing(null);
  }

  async function saveTime(match: MatchDto, isoOrNull: string | null) {
    const item = match.scheduleItem;
    if (!item) return;
    setBusy(`time-${match.id}`);
    setError('');
    setNotice('');
    try {
      const response = await apiFetch(`/api/admin/events/${eventId}/schedule/items/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          plannedStartAt: isoOrNull,
          expectedVersion: item.version,
          commandId: createCommandId('schedule-time'),
        }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) setError(data.error ?? control.timeError);
      else setNotice(control.timeSaved);
    } catch {
      setError(control.timeError);
    } finally {
      setBusy('');
      await load();
    }
  }

  const summary = buildControlSummary(brackets);
  const actionable = actionableMatches(brackets);
  const hasDraw = brackets.some((bracket) => bracket.matches.length > 0);
  const cardHandlers = {
    onStart: start,
    onFinish: (match: MatchDto) => setFinishing(match),
    onSaveTime: saveTime,
    onRecordResult: (match: MatchDto, setsA: number, setsB: number) =>
      setConfirmation({ match, setsA, setsB, commandId: createCommandId('match-result') }),
  };

  const winningSide: Side | null = confirmation ? (confirmation.setsA > confirmation.setsB ? 'A' : 'B') : null;
  const winningPair = confirmation && winningSide ? pairName(participantOf(confirmation.match, winningSide), copy.common.tbd) : '';

  return (
    <AdminShell title={control.title} description={control.description} eyebrow={event?.title}>
      {error ? <div className="mb-4"><InlineNotice kind="error">{error}</InlineNotice></div> : null}
      {notice ? <div className="mb-4"><InlineNotice kind="success">{notice}</InlineNotice></div> : null}
      {isCompleted ? <div className="mb-4"><InlineNotice kind="info">{control.readOnly}</InlineNotice></div> : null}

      <div className={styles.page}>
        <section className={styles.summary} aria-label={control.title}>
          <Metric label={control.live} value={summary.live} tone="live" />
          <Metric label={control.readyCount} value={summary.ready} />
          <Metric label={control.courtsInPlay} value={summary.courtsInPlay} />
          <Metric label={control.played} value={`${summary.completed}/${summary.total}`} />
        </section>

        {summary.awaitingCourt ? (
          <InlineNotice kind="warning">{fillTemplate(control.awaitingCourt, { count: summary.awaitingCourt })}</InlineNotice>
        ) : null}

        {loading && !brackets.length ? (
          <SkeletonCards count={2} columns={2} label={control.loading} />
        ) : !hasDraw ? (
          <TournamentPanel>
            <EmptyTournamentState title={control.empty} detail={control.emptyDetail} />
          </TournamentPanel>
        ) : (
          <>
            <TournamentPanel>
              <TournamentSectionHeader title={control.nowTitle} description={control.nowDetail} />
              {actionable.length ? (
                <div className={styles.nowGrid}>
                  {actionable.map(({ match }) => (
                    <MatchControlCard
                      key={match.id}
                      busy={busy}
                      locked={isCompleted}
                      match={match}
                      {...cardHandlers}
                    />
                  ))}
                </div>
              ) : (
                <EmptyTournamentState title={control.nowEmpty} detail={control.nowEmptyDetail} />
              )}
            </TournamentPanel>

            <TournamentPanel>
              <TournamentSectionHeader title={control.drawTitle} description={control.drawDetail} />
              <div className={styles.draws}>
                {brackets.filter((bracket) => bracket.matches.length).map((bracket) => (
                  <section key={bracket.id} className={styles.draw}>
                    <h3 className={styles.drawName}>{bracket.eventCategory?.category.name}</h3>
                    <div className={styles.rounds}>
                      {activeRounds(bracket.matches).map((round) => (
                        <div key={round} className={styles.round}>
                          <h4 className={styles.roundName}>{tournamentRound(locale, round)}</h4>
                          {bracket.matches
                            .filter((match) => match.round === round)
                            .map((match) => (
                              <MatchControlCard
                                key={match.id}
                                busy={busy}
                                locked={isCompleted}
                                match={match}
                                {...cardHandlers}
                              />
                            ))}
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </TournamentPanel>
          </>
        )}
      </div>

      <DashboardModal
        open={Boolean(confirmation)}
        onOpenChange={(open) => { if (!open && !busy.startsWith('result-')) setConfirmation(null); }}
        title={control.confirmTitle}
        size="md"
        footer={(
          <ModalFormFooter
            onCancel={() => setConfirmation(null)}
            cancelLabel={copy.common.cancel}
            submitType="button"
            onSubmitClick={() => { void submitResult(); }}
            busy={busy.startsWith('result-')}
            submitLabel={busy.startsWith('result-') ? control.recording : control.confirmSubmit}
          />
        )}
      >
        {confirmation ? (
          <>
            <p className={styles.confirmBody}>
              {fillTemplate(control.confirmBody, { pair: winningPair, a: confirmation.setsA, b: confirmation.setsB })}
            </p>
            <p className={styles.confirmScore}>
              {copy.common.sideA} {confirmation.setsA} · {copy.common.sideB} {confirmation.setsB}
            </p>
          </>
        ) : null}
      </DashboardModal>

      <FinishMatchDialog
        busy={busy.startsWith('finish-')}
        match={finishing}
        onOpenChange={(open) => { if (!open) setFinishing(null); }}
        onSubmit={finishEarly}
      />
    </AdminShell>
  );
}

function Metric({ label, value, tone }: { label: string; value: number | string; tone?: 'live' }) {
  return (
    <div className={styles.metric} data-tone={tone}>
      <span className={styles.metricValue}>{value}</span>
      <span className={styles.metricLabel}>{label}</span>
    </div>
  );
}
