'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { PublicUser } from '@/types/auth';
import type { ScheduleItemDto } from '@/types/tournament';
import { apiFetch } from '@/lib/api';
import { JudgeShell } from './JudgeShell';
import { BackLink, EmptyTournamentState, InlineNotice, StatusLabel, TournamentPanel, TournamentSectionHeader } from '@/components/tournament/TournamentUI';
import { useTournamentRealtime } from '@/hooks/useTournamentRealtime';
import { useI18n } from '@/components/shared/I18nProvider';
import { tournamentCopy, tournamentRound, tournamentStatus } from '@/lib/i18n/tournament';

export function JudgeQueueClient({ user, eventId, courtId }: { user: PublicUser; eventId: string; courtId: string }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const [items, setItems] = useState<ScheduleItemDto[]>([]);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const response = await apiFetch(`/api/judge/events/${eventId}/courts/${courtId}/queue`, { cache: 'no-store' });
    const data = await response.json() as { items?: ScheduleItemDto[]; error?: string };
    if (!response.ok) setError(data.error ?? copy.judge.queue.loadError); else { setItems(data.items ?? []); setError(''); }
  }, [copy.judge.queue.loadError, courtId, eventId]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  useTournamentRealtime({ eventId, onChange: load });
  const courtName = items[0]?.courtId === courtId ? items[0]?.match.scheduleItem?.courtId : null;
  return <JudgeShell user={user} title={copy.judge.queue.title} description={copy.judge.queue.description}><div className="mb-4"><BackLink href="/judge">{copy.judge.shell.assignments}</BackLink></div>{error ? <div className="mb-4"><InlineNotice kind="error">{error}</InlineNotice></div> : null}<TournamentPanel><TournamentSectionHeader title={courtName ? copy.judge.queue.assignedCourt : copy.judge.queue.matchQueue} description={copy.judge.queue.queueDescription} />{items.length ? <ol className="divide-y divide-[rgba(213,201,177,0.08)]">{items.map((item, index) => { const canOpen = item.status === 'IN_PROGRESS' || (item.status === 'READY' && !items.slice(0, index).some((earlier) => earlier.status === 'READY' || earlier.status === 'IN_PROGRESS')); return <li key={item.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="text-xs text-[rgba(213,201,177,0.5)]">{copy.common.queue} {item.queuePosition}</span><StatusLabel>{tournamentStatus(locale, item.status)}</StatusLabel></div><h2 className="mt-2 font-semibold text-[var(--padel-ivory)]">{tournamentRound(locale, item.match.round)} · {copy.common.match} {item.match.matchNumber}</h2><p className="mt-1 text-sm text-[rgba(213,201,177,0.58)]">{pair(item, copy.common.tbd, copy.common.versus)}</p></div>{canOpen ? <Link href={`/judge/matches/${item.matchId}`} className="inline-flex min-h-11 items-center justify-center rounded-md border border-[rgba(213,201,177,0.2)] px-4 text-sm font-semibold text-[var(--padel-ivory)] hover:bg-[rgba(213,201,177,0.07)]">{item.status === 'IN_PROGRESS' ? copy.judge.queue.continueMatch : copy.judge.queue.openMatch}</Link> : null}</li>; })}</ol> : <EmptyTournamentState title={copy.judge.queue.empty} />}</TournamentPanel></JudgeShell>;
}

function pair(item: ScheduleItemDto, tbd: string, versus: string) {
  const side = (entry: ScheduleItemDto['match']['participantA']) => entry ? `${entry.owner.fullName} / ${entry.teammate.fullName}` : tbd;
  return `${side(item.match.participantA)} ${versus} ${side(item.match.participantB)}`;
}
