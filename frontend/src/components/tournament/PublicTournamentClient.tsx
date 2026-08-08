'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { CalendarDays, Check, Clock, CreditCard, MapPin, Tag, Trophy, UsersRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CursorRing, FilmGrain, PageSurface } from '@/components/padel/home/effects';
import { PadelNav, SiteFooter } from '@/components/padel/home/chrome';
import { padelVars } from '@/components/padel/home/constants';
import { PadelHomeStyles } from '@/components/padel/home/PadelHomeStyles';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { EventDto } from '@/types/dashboard';
import type { BracketDto, CourtDto, PublicRegistrationTeamDto } from '@/types/tournament';
import { EmptyTournamentState, TournamentPanel, TournamentSectionHeader } from './TournamentUI';
import {
  DrawSection,
  LiveBadge,
  OverviewMatchCard,
  ResultsSection,
  ScheduleSection,
  TeamsSection,
  bracketChampion,
  panelSurface,
  type CourtMatchRef,
} from './PublicEventSections';
import { useTournamentRealtime } from '@/hooks/useTournamentRealtime';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';

const TAB_IDS = ['overview', 'teams', 'draw', 'schedule', 'results'] as const;
type TabId = (typeof TAB_IDS)[number];

const STAGES = ['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'ONGOING', 'COMPLETED'] as const;

export function PublicTournamentClient({ eventId }: { eventId: string }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const eventCopy = copy.publicEvent;
  const [event, setEvent] = useState<EventDto | null>(null);
  const [brackets, setBrackets] = useState<BracketDto[]>([]);
  const [courts, setCourts] = useState<CourtDto[]>([]);
  const [registeredTeams, setRegisteredTeams] = useState<PublicRegistrationTeamDto[]>([]);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<TabId>('overview');
  const [drawCategoryId, setDrawCategoryId] = useState('');

  const load = useCallback(async () => {
    const [a, b, c, d] = await Promise.all([
      apiFetch(`/api/public/events/${eventId}`, { cache: 'no-store' }),
      apiFetch(`/api/public/events/${eventId}/brackets`, { cache: 'no-store' }),
      apiFetch(`/api/public/events/${eventId}/schedule`, { cache: 'no-store' }),
      apiFetch(`/api/public/events/${eventId}/registered-teams`, { cache: 'no-store' }),
    ]);
    const eventData = await a.json() as { event?: EventDto; error?: string };
    const bracketData = await b.json() as { brackets?: BracketDto[] };
    const scheduleData = await c.json() as { courts?: CourtDto[] };
    const rosterData = await d.json() as { teams?: PublicRegistrationTeamDto[] };
    if (!a.ok) {
      setError(eventData.error ?? copy.publicEvent.loadError);
    } else {
      setEvent(eventData.event ?? null);
      setBrackets(bracketData.brackets ?? []);
      setCourts(scheduleData.courts ?? []);
      setRegisteredTeams(rosterData.teams ?? []);
    }
  }, [copy.publicEvent.loadError, eventId]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  useTournamentRealtime({ eventId, onChange: load });

  // A shared #hash deep-links straight to a section, and survives realtime reloads.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const initial = window.location.hash.replace('#', '');
      if ((TAB_IDS as readonly string[]).includes(initial)) setTab(initial as TabId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const selectTab = useCallback((next: TabId) => {
    setTab(next);
    window.history.replaceState(null, '', `#${next}`);
  }, []);
  const openDraw = useCallback((categoryId: string) => {
    setDrawCategoryId(categoryId);
    selectTab('draw');
  }, [selectTab]);

  const scheduleRefs = useMemo<CourtMatchRef[]>(() => courts.flatMap((court) => court.scheduleItems.map((item) => ({
    match: item.match,
    categoryName: item.match.bracket?.eventCategory.category.name ?? null,
    courtName: court.name,
    plannedStartAt: item.plannedStartAt,
    queuePosition: item.queuePosition,
  }))), [courts]);

  const liveMatches = useMemo<CourtMatchRef[]>(() => {
    const fromSchedule = scheduleRefs.filter((ref) => ref.match.status === 'IN_PROGRESS');
    const seen = new Set(fromSchedule.map((ref) => ref.match.id));
    const fromBrackets = brackets
      .flatMap((bracket) => bracket.matches.map((match) => ({ bracket, match })))
      .filter(({ match }) => match.status === 'IN_PROGRESS' && !seen.has(match.id))
      .map(({ bracket, match }) => ({
        match,
        categoryName: bracket.eventCategory.category.name,
        courtName: null,
        plannedStartAt: null,
        queuePosition: 0,
      }));
    return [...fromSchedule, ...fromBrackets];
  }, [scheduleRefs, brackets]);

  // One "up next" match per court: the first queued match that has not started.
  const upNext = useMemo<CourtMatchRef[]>(() => courts
    .map((court): CourtMatchRef | null => {
      const next = [...court.scheduleItems]
        .sort((a, b) => a.queuePosition - b.queuePosition)
        .find((item) => item.match.status === 'READY' || item.match.status === 'PENDING');
      return next ? {
        match: next.match,
        categoryName: next.match.bracket?.eventCategory.category.name ?? null,
        courtName: court.name,
        plannedStartAt: next.plannedStartAt,
        queuePosition: next.queuePosition,
      } : null;
    })
    .filter((item): item is CourtMatchRef => Boolean(item))
    .slice(0, 4), [courts]);

  const completedCount = useMemo(
    () => brackets.reduce((total, bracket) => total + bracket.matches.filter((match) => match.status === 'COMPLETED' && match.resultType !== 'BYE').length, 0),
    [brackets],
  );

  const tabs: Array<{ id: TabId; label: string; count?: number }> = [
    { id: 'overview', label: eventCopy.tabs.overview },
    { id: 'teams', label: eventCopy.tabs.teams, count: registeredTeams.length || undefined },
    { id: 'draw', label: eventCopy.tabs.draw, count: brackets.length || undefined },
    { id: 'schedule', label: eventCopy.tabs.schedule, count: courts.length || undefined },
    { id: 'results', label: eventCopy.tabs.results, count: completedCount || undefined },
  ];

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
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="gold">{eventCopy.badge}</Badge>
                {liveMatches.length ? <LiveBadge /> : null}
              </div>
              <h1 className="mt-5 font-display text-5xl font-semibold leading-none md:text-7xl">{event.title}</h1>
              {event.description ? <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--padel-muted)]">{event.description}</p> : null}

              <StageStepper status={event.status} />
              <EventFacts event={event} teamsCount={event.registrationRosterPublishedAt ? registeredTeams.length : null} />

              <TabBar tabs={tabs} active={tab} onSelect={selectTab} label={eventCopy.sectionsLabel} />

              <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-6">
                {tab === 'overview' ? (
                  <OverviewSection
                    event={event}
                    brackets={brackets}
                    teams={registeredTeams}
                    live={liveMatches}
                    upNext={upNext}
                    onOpenDraw={openDraw}
                  />
                ) : null}
                {tab === 'teams' ? <TeamsSection teams={registeredTeams} rosterPublished={Boolean(event.registrationRosterPublishedAt)} /> : null}
                {tab === 'draw' ? <DrawSection brackets={brackets} selectedCategoryId={drawCategoryId} onSelectCategory={setDrawCategoryId} /> : null}
                {tab === 'schedule' ? <ScheduleSection courts={courts} eventDate={event.date} /> : null}
                {tab === 'results' ? <ResultsSection brackets={brackets} /> : null}
              </div>
            </>
          ) : !error ? <p className="text-[var(--padel-muted)]">{eventCopy.loading}</p> : null}
        </section>
      </main>
      <SiteFooter />
      <PadelHomeStyles />
    </div>
  );
}

/** The event lifecycle in plain words: where the event is, and what that means. */
function StageStepper({ status }: { status: EventDto['status'] }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].publicEvent;
  const current = STAGES.indexOf(status);
  return (
    <div className="mt-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--padel-gold)]">
        {fillTemplate(copy.stageStep, { current: current + 1, total: STAGES.length })}
      </p>
      <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {STAGES.map((stage, index) => {
          const state = index < current ? 'done' : index === current ? 'current' : 'todo';
          return (
            <li
              key={stage}
              aria-current={state === 'current' ? 'step' : undefined}
              className={cn(
                'flex min-h-14 items-center gap-3 rounded-sm border p-3',
                state === 'current' ? 'border-[var(--padel-gold)]/60 bg-[var(--padel-gold)]/10' : 'border-[var(--padel-line)] bg-[var(--padel-red-2)]/30',
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold tabular-nums',
                  state === 'todo' ? 'border-[var(--padel-line)] text-[var(--padel-muted)]' : 'border-[var(--padel-gold)]/60 text-[var(--padel-gold)]',
                )}
                aria-hidden="true"
              >
                {state === 'done' ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <span className={cn('text-sm font-semibold leading-5', state === 'todo' ? 'text-[var(--padel-muted)]' : 'text-[var(--padel-ivory)]')}>
                {copy.stages[stage]}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--padel-muted)]">{copy.stageNow[status]}</p>
    </div>
  );
}

function EventFacts({ event, teamsCount }: { event: EventDto; teamsCount: number | null }) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale];
  const facts: Array<{ icon: LucideIcon; label: string; value: string }> = [
    { icon: CalendarDays, label: copy.common.date, value: formatDate(event.date, { dateStyle: 'long', timeStyle: 'short' }) },
    ...(event.arrivalTime ? [{ icon: Clock, label: copy.publicEvent.facts.arrival, value: formatDate(event.arrivalTime, { dateStyle: 'medium', timeStyle: 'short' }) }] : []),
    { icon: MapPin, label: copy.common.location, value: event.location },
    { icon: Tag, label: copy.common.categories, value: event.categories.map((category) => category.name).join(', ') },
    ...(teamsCount !== null ? [{ icon: UsersRound, label: copy.publicEvent.facts.teams, value: fillTemplate(copy.publicEvent.facts.teamsCount, { count: teamsCount }) }] : []),
    {
      icon: CreditCard,
      label: copy.publicEvent.facts.fee,
      value: event.participationFee > 0 ? fillTemplate(copy.publicEvent.facts.feeAmount, { amount: event.participationFee }) : copy.publicEvent.facts.feeFree,
    },
  ];
  return (
    <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {facts.map((fact) => (
        <div key={fact.label} className="rounded-sm border border-[var(--padel-line)] bg-[var(--padel-red-2)]/40 p-4">
          <dt className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--padel-gold)]">
            <fact.icon className="h-3.5 w-3.5" aria-hidden="true" />
            {fact.label}
          </dt>
          <dd className="mt-1.5 text-sm font-semibold leading-6 text-[var(--padel-ivory)]">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TabBar({ tabs, active, onSelect, label }: {
  tabs: Array<{ id: TabId; label: string; count?: number }>;
  active: TabId;
  onSelect: (id: TabId) => void;
  label: string;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const index = tabs.findIndex((item) => item.id === active);
    const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    onSelect(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  };
  return (
    <div className="sticky top-20 z-40 mt-8 md:top-24">
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex gap-1 overflow-x-auto rounded-sm border border-[var(--padel-line)] bg-[var(--padel-red)]/90 p-1.5 backdrop-blur"
      >
        {tabs.map((item) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              id={`tab-${item.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onSelect(item.id)}
              className={cn(
                'min-h-11 shrink-0 rounded-sm px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]',
                selected
                  ? 'bg-[var(--padel-gold)]/15 text-[var(--padel-ivory)] shadow-[inset_0_0_0_1px_var(--padel-gold)]'
                  : 'text-[var(--padel-muted)] hover:text-[var(--padel-ivory)]',
              )}
            >
              {item.label}
              {item.count !== undefined ? <span className="ml-2 text-xs tabular-nums text-[var(--padel-gold)]">{item.count}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OverviewSection({ event, brackets, teams, live, upNext, onOpenDraw }: {
  event: EventDto;
  brackets: BracketDto[];
  teams: PublicRegistrationTeamDto[];
  live: CourtMatchRef[];
  upNext: CourtMatchRef[];
  onOpenDraw: (categoryId: string) => void;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const overviewCopy = copy.publicEvent.overview;
  const rosterPublished = Boolean(event.registrationRosterPublishedAt);
  const summaries = event.categories.map((category) => {
    const bracket = brackets.find((item) => item.categoryId === category.id);
    return {
      category,
      teamCount: teams.filter((team) => team.category.id === category.id).length,
      bracket,
      champion: bracket ? bracketChampion(bracket) : null,
    };
  });

  return (
    <div className="space-y-6">
      <TournamentPanel className={panelSurface}>
        <TournamentSectionHeader title={overviewCopy.liveTitle} />
        <div className="space-y-5 p-4 sm:p-5">
          {live.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {live.map((item) => <OverviewMatchCard key={item.match.id} item={item} live />)}
            </div>
          ) : (
            <p className="text-sm leading-6 text-[var(--padel-muted)]">{overviewCopy.liveEmpty}</p>
          )}
          {upNext.length ? (
            <div>
              <h3 className="border-b border-[var(--padel-line)] pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--padel-gold)]">{overviewCopy.upNext}</h3>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {upNext.map((item) => <OverviewMatchCard key={item.match.id} item={item} live={false} />)}
              </div>
            </div>
          ) : null}
        </div>
      </TournamentPanel>

      <TournamentPanel className={panelSurface}>
        <TournamentSectionHeader title={overviewCopy.glanceTitle} description={overviewCopy.glanceDescription} />
        <div className="grid gap-3 p-4 sm:p-5 md:grid-cols-2">
          {summaries.map(({ category, teamCount, bracket, champion }) => (
            <div key={category.id} className="rounded-sm border border-[var(--padel-line)] bg-[var(--padel-red)]/24 p-4">
              <h3 className="font-display text-2xl font-semibold text-[var(--padel-ivory)]">{category.name}</h3>
              <div className="mt-3 space-y-2 text-sm leading-6 text-[var(--padel-muted)]">
                {rosterPublished ? (
                  <p className="flex items-center gap-2">
                    <UsersRound className="h-4 w-4 text-[var(--padel-gold)]" aria-hidden="true" />
                    {fillTemplate(overviewCopy.teamsCount, { count: teamCount })}
                  </p>
                ) : null}
                <p className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-[var(--padel-gold)]" aria-hidden="true" />
                  {bracket ? overviewCopy.drawReady : overviewCopy.drawPending}
                </p>
                {champion ? (
                  <p className="flex items-center gap-2 font-semibold text-[var(--padel-ivory)]">
                    <Trophy className="h-4 w-4 text-[var(--padel-gold)]" aria-hidden="true" />
                    {overviewCopy.champions}: {champion.names}
                  </p>
                ) : null}
              </div>
              {bracket ? (
                <button
                  type="button"
                  onClick={() => onOpenDraw(category.id)}
                  className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--padel-line)] px-4 text-sm font-semibold text-[var(--padel-gold)] transition-colors hover:border-[var(--padel-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]"
                >
                  {overviewCopy.openDraw}
                </button>
              ) : null}
            </div>
          ))}
        </div>
        {!summaries.length ? <EmptyTournamentState title={copy.publicEvent.drawEmpty} /> : null}
      </TournamentPanel>

      <TournamentPanel className={panelSurface}>
        <TournamentSectionHeader title={overviewCopy.howTitle} />
        <ol className="grid gap-3 p-4 sm:p-5 md:grid-cols-3">
          {[overviewCopy.how1, overviewCopy.how2, overviewCopy.how3].map((step, index) => (
            <li key={step} className="flex gap-3 rounded-sm border border-[var(--padel-line)] bg-[var(--padel-red)]/24 p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--padel-gold)]/60 text-xs font-bold tabular-nums text-[var(--padel-gold)]" aria-hidden="true">{index + 1}</span>
              <p className="text-sm leading-6 text-[var(--padel-muted)]">{step}</p>
            </li>
          ))}
        </ol>
      </TournamentPanel>
    </div>
  );
}
