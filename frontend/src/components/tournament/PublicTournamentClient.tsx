'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Activity, CalendarDays, Clock, MapPin, Trophy, UsersRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CursorRing, FilmGrain, PageSurface } from '@/components/padel/home/effects';
import { PadelNav, SiteFooter } from '@/components/padel/home/chrome';
import { padelVars } from '@/components/padel/home/constants';
import { PadelHomeStyles } from '@/components/padel/home/PadelHomeStyles';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api';
import type { EventDto } from '@/types/dashboard';
import type { BracketDto, CourtDto, MatchDto, PublicRegistrationTeamDto } from '@/types/tournament';
import { EmptyTournamentState, StatusLabel, TournamentPanel, TournamentSectionHeader } from './TournamentUI';
import { useTournamentRealtime } from '@/hooks/useTournamentRealtime';
import { useI18n } from '@/components/shared/I18nProvider';
import { visibleSets } from '@/lib/matchResult';
import { fillTemplate, tournamentCopy, tournamentRound, tournamentStatus } from '@/lib/i18n/tournament';

const rounds: MatchDto['round'][] = ['ROUND_OF_16', 'QUARTERFINAL', 'SEMIFINAL', 'FINAL'];

function activeRounds(matches: MatchDto[]) {
  const present = new Set(matches.map((match) => match.round));
  return rounds.filter((round) => present.has(round));
}

function pairLabel(bracket: BracketDto, match: MatchDto, side: 'A' | 'B', locale: 'ka' | 'en') {
  const entry = side === 'A' ? match.participantA : match.participantB;
  if (entry) return `${entry.owner.fullName} / ${entry.teammate.fullName}`;
  const source = bracket.matches.find((candidate) => candidate.nextMatchId === match.id && candidate.nextMatchSlot === side);
  const copy = tournamentCopy[locale].publicEvent;
  return source ? fillTemplate(copy.winnerOfMatch, { number: source.matchNumber }) : copy.toBeDetermined;
}

export function PublicTournamentClient({ eventId }: { eventId: string }) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale];
  const [event, setEvent] = useState<EventDto | null>(null);
  const [brackets, setBrackets] = useState<BracketDto[]>([]);
  const [courts, setCourts] = useState<CourtDto[]>([]);
  const [registeredTeams, setRegisteredTeams] = useState<PublicRegistrationTeamDto[]>([]);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const [a, b, c, d] = await Promise.all([apiFetch(`/api/public/events/${eventId}`, { cache: 'no-store' }), apiFetch(`/api/public/events/${eventId}/brackets`, { cache: 'no-store' }), apiFetch(`/api/public/events/${eventId}/schedule`, { cache: 'no-store' }), apiFetch(`/api/public/events/${eventId}/registered-teams`, { cache: 'no-store' })]);
    const eventData = await a.json() as { event?: EventDto; error?: string };
    const bracketData = await b.json() as { brackets?: BracketDto[] };
    const scheduleData = await c.json() as { courts?: CourtDto[] };
    const rosterData = await d.json() as { teams?: PublicRegistrationTeamDto[] };
    if (!a.ok) setError(eventData.error ?? copy.publicEvent.loadError); else { setEvent(eventData.event ?? null); setBrackets(bracketData.brackets ?? []); setCourts(scheduleData.courts ?? []); setRegisteredTeams(rosterData.teams ?? []); }
  }, [copy.publicEvent.loadError, eventId]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  useTournamentRealtime({ eventId, onChange: load });
  return (
    <div
      style={padelVars}
      className="el-padel-page min-h-screen overflow-x-clip bg-[var(--padel-red)] text-[var(--padel-ivory)]"
    >
      <CursorRing />
      <FilmGrain />
      <PadelNav />
      <main className="page-canvas relative min-h-dvh">
        <PageSurface />
        <section className="relative z-10 mx-auto max-w-6xl px-5 pb-16 pt-32 md:px-8 md:pt-40">
          {error ? <p role="alert" className="rounded-sm border border-[var(--padel-line)] bg-[var(--padel-red-2)]/45 p-5 text-[var(--padel-ivory)]">{error}</p> : null}
          {event ? (
            <>
              <Badge variant="gold">{copy.publicEvent.badge}</Badge>
              <div className="mt-5 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
                <div>
                  <h1 className="font-display text-5xl font-semibold leading-none md:text-7xl">{event.title}</h1>
                  <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--padel-muted)]">{event.description}</p>
                </div>
                <div className="grid gap-3 rounded-sm border border-[var(--padel-line)] bg-[var(--padel-red-2)]/40 p-5">
                  <EventFact icon={Activity} label={copy.common.status} value={tournamentStatus(locale, event.status)} />
                  <EventFact icon={CalendarDays} label={copy.common.date} value={formatDate(event.date, { dateStyle: 'long', timeStyle: 'short' })} />
                  <EventFact icon={MapPin} label={copy.common.location} value={event.location} />
                  <EventFact icon={Trophy} label={copy.common.categories} value={event.categories.map((category) => category.name).join(', ')} />
                </div>
              </div>

              {event.registrationRosterPublishedAt ? (
                <TournamentPanel className="mt-10 rounded-sm border-[var(--padel-line)] bg-[var(--padel-red-2)]/40">
                  <TournamentSectionHeader title={copy.publicEvent.registeredTeams} description={copy.publicEvent.registeredTeamsDescription} />
                  <PublicRegisteredTeams teams={registeredTeams} />
                </TournamentPanel>
              ) : null}

              <TournamentPanel className={`${event.registrationRosterPublishedAt ? 'mt-6' : 'mt-10'} rounded-sm border-[var(--padel-line)] bg-[var(--padel-red-2)]/40`}>
                <TournamentSectionHeader title={copy.publicEvent.bracket} description={copy.publicEvent.bracketDescription} />
                {brackets.length ? <div className="space-y-8 p-5">{brackets.map((bracket) => <PublicBracketBoard key={bracket.id} bracket={bracket} />)}</div> : <EmptyTournamentState title={copy.publicEvent.bracketNotPublished} />}
              </TournamentPanel>

              <TournamentPanel className="mt-6 rounded-sm border-[var(--padel-line)] bg-[var(--padel-red-2)]/40">
                <TournamentSectionHeader title={copy.publicEvent.schedule} description={copy.publicEvent.scheduleDescription} />
                {courts.length ? <PublicSchedule courts={courts} /> : <EmptyTournamentState title={copy.publicEvent.scheduleNotPublished} />}
              </TournamentPanel>
            </>
          ) : !error ? <p className="text-[var(--padel-muted)]">{copy.publicEvent.loading}</p> : null}
        </section>
      </main>
      <SiteFooter />
      <PadelHomeStyles />
    </div>
  );
}

function PublicRegisteredTeams({ teams }: { teams: PublicRegistrationTeamDto[] }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  if (!teams.length) {
    return <EmptyTournamentState title={copy.publicEvent.noApprovedTeams} detail={copy.publicEvent.noApprovedTeamsDescription} />;
  }

  const categories = Array.from(new Map(teams.map((team) => [team.category.id, team.category])).values());

  return (
    <div className="grid gap-6 p-5 md:grid-cols-2">
      {categories.map((category) => {
        const categoryTeams = teams.filter((team) => team.category.id === category.id);
        return (
          <section key={category.id} aria-labelledby={`registered-teams-${category.id}`} className="rounded-sm border border-[var(--padel-line)] bg-[var(--padel-red)]/24">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--padel-line)] p-4">
              <h3 id={`registered-teams-${category.id}`} className="font-display text-2xl font-semibold text-[var(--padel-ivory)]">{category.name}</h3>
              <Badge variant="gold">{categoryTeams.length} {categoryTeams.length === 1 ? copy.common.team : copy.common.teams}</Badge>
            </div>
            <ol className="divide-y divide-[var(--padel-line)]">
              {categoryTeams.map((team, index) => (
                <li key={team.id} className="flex min-h-20 items-start gap-3 p-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--padel-line)] text-xs font-semibold tabular-nums text-[var(--padel-gold)]" aria-hidden="true">{index + 1}</span>
                  <div className="min-w-0">
                    <p className="font-semibold leading-6 text-[var(--padel-ivory)]">{team.owner.fullName} / {team.teammate.fullName}</p>
                    <p className="mt-1 text-sm leading-5 text-[var(--padel-muted)]">{team.club?.name ?? copy.publicEvent.independentTeam}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

function EventFact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="border-b border-[var(--padel-line)] pb-3 last:border-b-0 last:pb-0">
      <p className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--padel-gold)]">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold leading-6 text-[var(--padel-ivory)]">{value}</p>
    </div>
  );
}

function PublicSchedule({ courts }: { courts: CourtDto[] }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const scheduledCount = courts.reduce((total, court) => total + court.scheduleItems.length, 0);

  if (!scheduledCount) return <EmptyTournamentState title={copy.publicEvent.scheduleNotPublished} detail={copy.publicEvent.scheduleNotPublishedDescription} />;

  return (
    <div className="grid gap-5 p-5 lg:grid-cols-2">
      {courts.map((court) => (
        <section key={court.id} className="rounded-sm border border-[var(--padel-line)] bg-[var(--padel-red)]/24">
          <div className="border-b border-[var(--padel-line)] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-display text-2xl font-semibold text-[var(--padel-ivory)]">{court.name}</h3>
                <p className="mt-1 flex items-center gap-2 text-sm text-[var(--padel-muted)]">
                  <MapPin className="h-4 w-4 text-[var(--padel-gold)]" />
                  {court.location || copy.publicEvent.courtLocation}
                </p>
              </div>
              <Badge variant="gold">{court.scheduleItems.length} {court.scheduleItems.length === 1 ? copy.common.match.toLowerCase() : copy.common.matches}</Badge>
            </div>
          </div>
          {court.scheduleItems.length ? (
            <ol className="divide-y divide-[var(--padel-line)]">
              {[...court.scheduleItems].sort((a, b) => a.queuePosition - b.queuePosition).map((item) => (
                <li key={item.id}>
                  <ScheduleMatchCard item={item} />
                </li>
              ))}
            </ol>
          ) : (
            <EmptyTournamentState title={copy.publicEvent.noCourtMatches} />
          )}
        </section>
      ))}
    </div>
  );
}

function ScheduleMatchCard({ item }: { item: CourtDto['scheduleItems'][number] }) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale];
  const match = item.match;
  const category = match.bracket?.eventCategory.category.name ?? copy.publicEvent.tournament;
  const sideA = scheduleSideName(match, 'A', locale);
  const sideB = scheduleSideName(match, 'B', locale);
  const hasScore = match.status === 'IN_PROGRESS' || match.status === 'COMPLETED';

  return (
    <Link href={`/matches/${match.id}`} className="block p-4 transition-colors hover:bg-[var(--padel-red)]/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--padel-gold)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="gold">{copy.common.queue} {item.queuePosition}</Badge>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--padel-muted)]">
              {category} · {tournamentRound(locale, match.round)} · {copy.common.match} {match.matchNumber}
            </span>
          </div>
          <p className="mt-3 flex items-center gap-2 text-sm text-[var(--padel-muted)]">
            <Clock className="h-4 w-4 text-[var(--padel-gold)]" />
            {item.plannedStartAt ? formatDate(item.plannedStartAt, { dateStyle: 'medium', timeStyle: 'short' }) : copy.publicEvent.timeTbc}
          </p>
        </div>
        <StatusLabel>{tournamentStatus(locale, item.status)}</StatusLabel>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
        <ScheduleSide label={copy.common.sideA} name={sideA} score={hasScore ? match.scoreA : null} />
        <div className="hidden text-center text-xs font-semibold uppercase tracking-[0.18em] text-[var(--padel-muted)] md:block">{copy.common.versus}</div>
        <ScheduleSide label={copy.common.sideB} name={sideB} score={hasScore ? match.scoreB : null} />
      </div>
      <SetChips match={match} />
    </Link>
  );
}

/** Compact per-set winners, so a set tally reads as more than two numbers. */
function SetChips({ match }: { match: MatchDto }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const sets = visibleSets(match);
  if (!sets.length) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={copy.publicEvent.setWinners}>
      {sets.map((set) => (
        <li key={set.setNumber} className="inline-flex items-center gap-1 rounded-sm border border-[var(--padel-line)] px-1.5 py-0.5 text-[0.65rem] font-semibold tabular-nums text-[var(--padel-muted)]">
          {fillTemplate(copy.publicEvent.setShort, { number: set.setNumber })}
          <span aria-hidden="true">·</span>
          {set.winnerSide}
        </li>
      ))}
    </ul>
  );
}

function ScheduleSide({ label, name, score }: { label: string; name: string; score: number | null }) {
  return (
    <div className="min-w-0 rounded-sm border border-[var(--padel-line)] bg-[var(--padel-red-2)]/30 p-3">
      <p className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--padel-muted)]">
        <UsersRound className="h-3.5 w-3.5 text-[var(--padel-gold)]" />
        {label}
      </p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="min-w-0 text-sm font-semibold leading-5 text-[var(--padel-ivory)]">{name}</p>
        {score !== null ? <p className="font-mono text-2xl font-semibold tabular-nums text-[var(--padel-gold)]">{score}</p> : null}
      </div>
    </div>
  );
}

function scheduleSideName(match: MatchDto, side: 'A' | 'B', locale: 'ka' | 'en') {
  const entry = side === 'A' ? match.participantA : match.participantB;
  if (entry) return `${entry.owner.fullName} / ${entry.teammate.fullName}`;
  const snapshot = match.snapshots.find((item) => item.side === side);
  if (snapshot) return `${snapshot.ownerName} / ${snapshot.teammateName}`;
  return tournamentCopy[locale].publicEvent.toBeDetermined;
}

function PublicBracketBoard({ bracket }: { bracket: BracketDto }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const visibleRounds = activeRounds(bracket.matches);

  return (
    <section>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[var(--padel-ivory)]">{bracket.eventCategory.category.name}</h2>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-[var(--padel-muted)]">
            {tournamentStatus(locale, bracket.status)} · {fillTemplate(copy.publicEvent.drawEntries, { count: bracket.size })}
          </p>
        </div>
        <StatusLabel>{bracket.publishedAt ? copy.publicEvent.published : copy.publicEvent.unpublished}</StatusLabel>
      </div>
      {bracket.matches.length ? (
        <div className="overflow-x-auto pb-2">
          <div className="grid min-w-[58rem] gap-4 lg:grid-cols-4">
            {visibleRounds.map((round) => (
              <div key={round} className="min-w-0">
                <h3 className="mb-3 border-b border-[var(--padel-line)] pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--padel-gold)]">
                  {tournamentRound(locale, round)}
                </h3>
                <div className="space-y-3">
                  {bracket.matches.filter((match) => match.round === round).map((match) => (
                    <PublicMatchCard key={match.id} bracket={bracket} match={match} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyTournamentState title={copy.publicEvent.drawEmpty} detail={copy.publicEvent.drawEmptyDescription} />
      )}
    </section>
  );
}

function PublicMatchCard({ bracket, match }: { bracket: BracketDto; match: MatchDto }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  return <Link href={`/matches/${match.id}`} className="block rounded-sm border border-[var(--padel-line)] bg-[var(--padel-red)]/28 p-4 transition-colors hover:bg-[var(--padel-red)]/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]"><div className="flex items-center justify-between gap-2"><span className="text-xs text-[var(--padel-muted)]">{copy.common.match} {match.matchNumber}</span><StatusLabel>{tournamentStatus(locale, match.status)}</StatusLabel></div><p className="mt-4 min-h-10 text-sm font-semibold leading-5">{pairLabel(bracket, match, 'A', locale)}</p><p className="my-1 text-xs text-[var(--padel-muted)]">{copy.common.versus}</p><p className="min-h-10 text-sm font-semibold leading-5">{pairLabel(bracket, match, 'B', locale)}</p>{match.status === 'IN_PROGRESS' || match.status === 'COMPLETED' ? <p className="mt-4 font-mono text-2xl font-semibold tabular-nums">{match.scoreA}-{match.scoreB}</p> : null}<SetChips match={match} /></Link>;
}
