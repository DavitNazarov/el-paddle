'use client';

import Link from 'next/link';
import { ArrowRight, Minus, Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { PublicUser } from '@/types/auth';
import type { MatchDto, ScheduleItemDto } from '@/types/tournament';
import { apiFetch, createCommandId } from '@/lib/api';
import { JudgeShell } from './JudgeShell';
import { findNextCourtMatchId } from './judgeQueue';
import { BackLink, CommandButton, InlineNotice, StatusLabel, TournamentPanel, TournamentSectionHeader } from '@/components/tournament/TournamentUI';
import { useTournamentRealtime } from '@/hooks/useTournamentRealtime';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy, tournamentRound, tournamentStatus } from '@/lib/i18n/tournament';

export function JudgeMatchClient({ user, matchId }: { user: PublicUser; matchId: string }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const [match, setMatch] = useState<MatchDto | null>(null);
  const [nextMatchId, setNextMatchId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
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

  async function start() {
    if (!match) return;
    setBusy('start'); setError('');
    const response = await apiFetch(`/api/judge/matches/${match.id}/start`, { method: 'POST', body: JSON.stringify({ expectedVersion: match.version, commandId: createCommandId('match-start') }) });
    const data = await response.json() as { match?: MatchDto; error?: string };
    setBusy(''); if (!response.ok) setError(data.error ?? copy.judge.match.startError); else setMatch(data.match ?? match);
  }

  async function score(side: 'A' | 'B', action: 'INCREMENT' | 'DECREMENT') {
    if (!match) return;
    const key = `${side}-${action}`; setBusy(key); setError('');
    const response = await apiFetch(`/api/judge/matches/${match.id}/score`, { method: 'POST', body: JSON.stringify({ side, action, expectedVersion: match.version, commandId: createCommandId('score') }) });
    const data = await response.json() as { match?: MatchDto; error?: string };
    setBusy(''); if (!response.ok) { setError(data.error ?? copy.judge.match.scoreError); void load(); } else {
      const updatedMatch = data.match ?? match;
      setMatch(updatedMatch);
      setNextMatchId(null);
      if (updatedMatch.status === 'COMPLETED') void loadNextFight(updatedMatch);
    }
  }

  return <JudgeShell user={user} title={match ? `${tournamentRound(locale, match.round)} · ${copy.common.match} ${match.matchNumber}` : copy.judge.match.title} description={copy.judge.match.description}>{match?.scheduleItem ? <div className="mb-4"><BackLink href={`/judge/events/${match.bracket?.eventId}/courts/${match.scheduleItem.courtId}`}>{copy.judge.match.courtQueue}</BackLink></div> : null}{error ? <div className="mb-4"><InlineNotice kind="error">{error}</InlineNotice></div> : null}{match ? <TournamentPanel><TournamentSectionHeader title={copy.judge.match.liveScore} description={copy.judge.match.liveDescription} actions={<StatusLabel icon={match.status === 'COMPLETED' ? 'check' : 'dot'}>{tournamentStatus(locale, match.status)}</StatusLabel>} /><div className="grid gap-4 bg-[#f6f8fc] p-4 md:grid-cols-2"><ScoreSide label={copy.common.sideA} entry={match.participantA} score={match.scoreA} disabled={match.status !== 'IN_PROGRESS'} busy={busy} onIncrement={() => score('A', 'INCREMENT')} onDecrement={() => score('A', 'DECREMENT')} /><ScoreSide label={copy.common.sideB} entry={match.participantB} score={match.scoreB} disabled={match.status !== 'IN_PROGRESS'} busy={busy} onIncrement={() => score('B', 'INCREMENT')} onDecrement={() => score('B', 'DECREMENT')} /></div>{match.status === 'READY' ? <div className="border-t border-[var(--dash-border)] bg-white p-4"><CommandButton tone="primary" className="w-full" busy={busy === 'start'} onClick={start}>{copy.judge.match.start}</CommandButton></div> : null}{match.status === 'COMPLETED' ? <div className="flex flex-col gap-3 border-t border-[var(--dash-border)] bg-[var(--dash-teal-soft)] px-5 py-4 text-sm font-medium text-[var(--dash-teal)] sm:flex-row sm:items-center sm:justify-between"><p role="status">{copy.judge.match.complete}</p>{nextMatchId ? <CommandButton asChild tone="primary" className="min-h-11 w-full sm:w-auto"><Link href={`/judge/matches/${nextMatchId}`}>{copy.judge.match.nextFight}<ArrowRight aria-hidden="true" /></Link></CommandButton> : null}</div> : null}</TournamentPanel> : <p className="text-sm text-[var(--dash-muted)]">{copy.judge.match.loading}</p>}</JudgeShell>;
}

function ScoreSide({ label, entry, score, disabled, busy, onIncrement, onDecrement }: { label: string; entry: MatchDto['participantA']; score: number; disabled: boolean; busy: string; onIncrement: () => void; onDecrement: () => void }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].judge.match;
  return <section className="overflow-hidden rounded-xl border border-[var(--dash-border)] bg-white p-5 shadow-sm sm:p-6" aria-label={label}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--dash-sky)]">{label}</p><h2 className="mt-2 min-h-12 text-base font-semibold leading-6 text-[var(--dash-text)]">{entry ? `${entry.owner.fullName} / ${entry.teammate.fullName}` : copy.participantPending}</h2></div><span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--dash-sky-soft)] text-xs font-bold text-[var(--dash-sky)]">{label.slice(-1)}</span></div><p className="my-7 text-center font-mono text-7xl font-semibold tabular-nums text-[var(--dash-text)]" aria-live="polite">{score}</p><div className="grid grid-cols-2 gap-3"><CommandButton aria-label={fillTemplate(copy.subtractLabel, { side: label })} className="min-h-14" busy={busy.includes('DECREMENT')} disabled={disabled || score === 0} onClick={onDecrement}><Minus />{copy.subtract}</CommandButton><CommandButton tone="primary" aria-label={fillTemplate(copy.addLabel, { side: label })} className="min-h-14" busy={busy.includes('INCREMENT')} disabled={disabled || score === 6} onClick={onIncrement}><Plus />{copy.add}</CommandButton></div></section>;
}
