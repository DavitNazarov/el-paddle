'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { PublicUser } from '@/types/auth';
import type { JudgeAssignmentDto } from '@/types/tournament';
import { apiFetch } from '@/lib/api';
import { JudgeShell } from './JudgeShell';
import { EmptyTournamentState, InlineNotice, KeyValueGrid, TournamentPanel, TournamentSectionHeader } from '@/components/tournament/TournamentUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';

export function JudgeAssignmentsClient({ user }: { user: PublicUser }) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale].judge.assignments;
  const [assignments, setAssignments] = useState<JudgeAssignmentDto[]>([]);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const response = await apiFetch('/api/judge/assignments', { cache: 'no-store' });
    const data = await response.json() as { assignments?: JudgeAssignmentDto[]; error?: string };
    if (!response.ok) setError(data.error ?? copy.loadError); else setAssignments(data.assignments ?? []);
  }, [copy.loadError]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  return <JudgeShell user={user} title={copy.title} description={copy.description}>{error ? <div className="mb-4"><InlineNotice kind="error">{error}</InlineNotice></div> : null}<TournamentPanel><TournamentSectionHeader title={copy.upcoming} description={fillTemplate(copy.count, { count: assignments.length })} />{assignments.length ? <div className="divide-y divide-[rgba(213,201,177,0.08)]">{assignments.map((assignment) => <Link key={assignment.id} href={`/judge/events/${assignment.court.eventId}/courts/${assignment.court.id}`} className="block px-5 py-5 transition-colors hover:bg-[rgba(213,201,177,0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--padel-focus-ring)]"><h2 className="font-semibold text-[var(--padel-ivory)]">{assignment.court.event.title}</h2><div className="mt-3"><KeyValueGrid items={[{ label: copy.court, value: assignment.court.name }, { label: copy.starts, value: formatDate(assignment.startsAt, { dateStyle: 'medium', timeStyle: 'short' }) }, { label: copy.ends, value: formatDate(assignment.endsAt, { dateStyle: 'medium', timeStyle: 'short' }) }, { label: copy.location, value: assignment.court.event.location }]} /></div></Link>)}</div> : <EmptyTournamentState title={copy.empty} detail={copy.emptyDescription} />}</TournamentPanel></JudgeShell>;
}
