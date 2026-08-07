'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarClock, MapPin, Search, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/shared/I18nProvider';
import { formatMatchResult } from '@/lib/matchResult';
import { fillTemplate, tournamentCopy, tournamentRound, tournamentStatus } from '@/lib/i18n/tournament';
import type { EventDto } from '@/types/dashboard';
import type { MatchDto } from '@/types/tournament';
import { EmptyTournamentState, InlineNotice, StatusLabel, TournamentPanel, TournamentSectionHeader } from './TournamentUI';
import { SkeletonRows } from '@/components/shared/dashboard/Feedback';

type PublicEventsPayload = {
  upcoming: EventDto | null;
  previous: EventDto[];
};

type MatchHistoryClientProps = {
  endpoint?: string;
  tone?: 'brand' | 'dashboard';
  /** When set, cards frame each match as yours: You / opponent, won or lost. */
  viewerUserId?: string;
};

export function MatchHistoryClient({
  endpoint = '/api/matches',
  tone = 'brand',
  viewerUserId,
}: MatchHistoryClientProps) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].history;
  const eventScoped = endpoint === '/api/matches';
  const dashboardTone = tone === 'dashboard';
  const personal = Boolean(viewerUserId);
  const [events, setEvents] = useState<EventDto[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [matches, setMatches] = useState<MatchDto[]>([]);
  // Event titles are hoisted out of the match rows and sent once per response (F4).
  const [eventTitles, setEventTitles] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventScoped) return;
    let mounted = true;
    apiFetch('/api/public/events', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('Events unavailable');
        return response.json();
      })
      .then((data: PublicEventsPayload) => {
        if (!mounted) return;
        const nextEvents = [data.upcoming, ...(Array.isArray(data.previous) ? data.previous : [])].filter((event): event is EventDto => Boolean(event));
        setEvents(nextEvents);
        setSelectedEventId((current) => current || nextEvents[0]?.id || '');
      })
      .catch(() => {
        if (mounted) {
          setEvents([]);
          setSelectedEventId('');
        }
      });
    return () => {
      mounted = false;
    };
  }, [eventScoped]);

  const load = useCallback(async () => {
    if (eventScoped && !selectedEventId) {
      setMatches([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const scopedEndpoint = eventScoped ? `${endpoint}?eventId=${encodeURIComponent(selectedEventId)}` : endpoint;
    const response = await apiFetch(scopedEndpoint, { cache: 'no-store' });
    const data = await response.json() as { matches?: MatchDto[]; events?: { id: string; title: string }[]; error?: string };
    if (!response.ok) {
      setError(data.error ?? copy.loadError);
    } else {
      setMatches(data.matches ?? []);
      setEventTitles(Object.fromEntries((data.events ?? []).map((event) => [event.id, event.title])));
    }
    setLoading(false);
  }, [copy.loadError, endpoint, eventScoped, selectedEventId]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const eventTitleFor = useCallback(
    (match: MatchDto) =>
      match.bracket?.event?.title ??
      (match.bracket?.eventId ? eventTitles[match.bracket.eventId] : undefined),
    [eventTitles],
  );

  const filtered = useMemo(() => matches.filter((match) => {
    const haystack = [
      eventTitleFor(match),
      match.bracket?.eventCategory?.category.name,
      match.round,
      match.resultType,
      ...match.snapshots.flatMap((snapshot) => [snapshot.ownerName, snapshot.teammateName, snapshot.clubName]),
    ].join(' ').toLowerCase();
    return haystack.includes(query.toLowerCase());
  }), [matches, query, eventTitleFor]);
  const selectedEvent = events.find((event) => event.id === selectedEventId);
  const shownCopy = personal ? copy.personalShown : copy.shown;
  const emptyDetail = personal
    ? query
      ? copy.searchEmpty
      : copy.personalEmptyDescription
    : copy.emptyDescription;

  return (
    <div className="space-y-4">
      {error ? <InlineNotice kind="error">{error}</InlineNotice> : null}
      <TournamentPanel
        className={cn(
          dashboardTone
            ? 'rounded-xl border-[var(--dash-border)] bg-white shadow-[0_12px_32px_rgba(43,26,24,0.05)]'
            : 'rounded-sm border-[var(--padel-line)] bg-[var(--padel-red-2)]/40',
        )}
      >
        <TournamentSectionHeader
          title={copy.title}
          description={
            loading
              ? copy.loading
              : `${eventScoped && selectedEvent ? `${selectedEvent.title} · ` : ''}${fillTemplate(shownCopy, { shown: filtered.length, total: matches.length })}`
          }
          actions={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              {eventScoped ? (
                <select
                  aria-label={copy.selectEvent}
                  value={selectedEventId}
                  onChange={(event) => setSelectedEventId(event.target.value)}
                  className="min-h-11 rounded-full border border-[var(--padel-line)] bg-[var(--padel-red)]/35 px-4 text-sm font-semibold text-[var(--padel-ivory)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]"
                >
                  {events.length ? events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>) : <option value="">{copy.noEvents}</option>}
                </select>
              ) : null}
              <label className="relative block sm:min-w-80">
                <Search
                  className={cn(
                    'pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2',
                    dashboardTone ? 'text-[var(--dash-primary)]' : 'text-[var(--padel-gold)]',
                  )}
                  aria-hidden="true"
                />
                <Input
                  aria-label={copy.searchLabel}
                  placeholder={copy.searchPlaceholder}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className={cn(
                    'min-h-11 w-full min-w-0 pl-10 sm:w-80',
                    dashboardTone
                      ? 'rounded-lg border-[var(--dash-border)] bg-[#faf6f3] text-[var(--dash-text)] shadow-none placeholder:text-[var(--dash-faint)] hover:border-[var(--dash-border-strong)] focus-visible:border-[var(--dash-primary)] focus-visible:ring-[var(--padel-focus-ring)]'
                      : 'rounded-full border-[var(--padel-line)] bg-[var(--padel-red)]/35 text-[var(--padel-ivory)] placeholder:text-[var(--padel-muted)]',
                  )}
                />
              </label>
            </div>
          }
        />
        {loading ? (
          <SkeletonRows rows={4} label={copy.loading} />
        ) : filtered.length ? (
          <div className={cn('grid gap-4 p-4 sm:p-5 lg:grid-cols-2', dashboardTone && 'bg-[#fbfcfe]')}>
            {filtered.map((match) => (
              <MatchResultCard
                key={match.id}
                match={match}
                tone={tone}
                eventTitle={eventTitleFor(match)}
                viewerUserId={viewerUserId}
              />
            ))}
          </div>
        ) : (
          <EmptyTournamentState title={copy.empty} detail={emptyDetail} />
        )}
      </TournamentPanel>
    </div>
  );
}

function MatchResultCard({
  match,
  tone,
  eventTitle,
  viewerUserId,
}: {
  match: MatchDto;
  tone: 'brand' | 'dashboard';
  eventTitle?: string;
  viewerUserId?: string;
}) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale];
  const sideA = matchSide(match, 'A');
  const sideB = matchSide(match, 'B');
  const winnerSide = match.scoreA > match.scoreB ? 'A' : match.scoreB > match.scoreA ? 'B' : null;
  const dashboardTone = tone === 'dashboard';
  // Set matches read "2–1 in sets" so a low tally is not mistaken for a point score.
  const resultLabel = match.scoringMode === 'SETS' ? formatMatchResult(match, locale) : null;
  const yourSide = viewerUserId ? sideForViewer(match, viewerUserId) : null;
  const youWon = yourSide && winnerSide ? yourSide === winnerSide : null;
  const courtName = match.scheduleItem?.court?.name;
  const plannedStart = match.scheduleItem?.plannedStartAt;
  const gloss =
    match.resultType && match.resultType !== 'NORMAL'
      ? copy.playerMatches.resultGloss[match.resultType as keyof typeof copy.playerMatches.resultGloss]
      : null;

  return (
    <Link
      href={`/matches/${match.id}`}
      className={cn(
        'group block p-4 transition duration-200 focus-visible:outline-none focus-visible:ring-2 sm:p-5',
        dashboardTone
          ? 'rounded-xl border border-[var(--dash-border)] bg-white shadow-[0_1px_2px_rgba(43,26,24,0.04)] hover:-translate-y-0.5 hover:border-[var(--dash-border-strong)] hover:shadow-[0_10px_24px_rgba(43,26,24,0.08)] focus-visible:ring-[var(--dash-primary)]'
          : 'rounded-sm border border-[var(--padel-line)] bg-[var(--padel-red)]/24 hover:bg-[var(--padel-red)]/40 focus-visible:ring-[var(--padel-gold)]',
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className={cn('text-xs font-semibold uppercase tracking-[0.18em]', dashboardTone ? 'text-[var(--dash-primary)]' : 'text-[var(--padel-gold)]')}>
            {eventTitle ?? copy.history.eventFallback}
          </p>
          <h2 className={cn('mt-2 text-lg font-semibold', dashboardTone ? 'text-[var(--dash-text)]' : 'text-[var(--padel-ivory)]')}>
            {match.bracket?.eventCategory?.category.name ?? copy.history.categoryFallback} · {tournamentRound(locale, match.round)}
          </h2>
          {dashboardTone && (courtName || plannedStart) ? (
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--dash-muted)]">
              {plannedStart ? (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                  {formatDate(plannedStart, { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              ) : null}
              {courtName ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  {courtName}
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
        {youWon === null ? (
          <StatusLabel icon="check">{match.resultType ? tournamentStatus(locale, match.resultType) : copy.common.completed}</StatusLabel>
        ) : (
          <StatusLabel icon={youWon ? 'check' : 'dot'}>
            {youWon ? copy.playerMatches.wonChip : copy.playerMatches.lostChip}
          </StatusLabel>
        )}
      </div>

      <div className="mt-5 grid gap-3">
        <ResultSide
          side="A"
          snapshot={sideA.snapshot}
          isBye={sideA.isBye}
          score={match.scoreA}
          winner={winnerSide === 'A'}
          tone={tone}
          yours={yourSide === 'A'}
          personal={Boolean(yourSide)}
        />
        <ResultSide
          side="B"
          snapshot={sideB.snapshot}
          isBye={sideB.isBye}
          score={match.scoreB}
          winner={winnerSide === 'B'}
          tone={tone}
          yours={yourSide === 'B'}
          personal={Boolean(yourSide)}
        />
      </div>

      {gloss ? (
        <p className={cn('mt-3 text-xs', dashboardTone ? 'text-[var(--dash-muted)]' : 'text-[var(--padel-muted)]')}>{gloss}</p>
      ) : null}

      <div className={cn('mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4', dashboardTone ? 'border-[var(--dash-border)]' : 'border-[var(--padel-line)]')}>
        <div className="flex flex-wrap gap-2">
          <Badge variant="gold" className={cn(dashboardTone && 'border-[var(--dash-border)] bg-[var(--dash-primary-soft)] text-[var(--dash-primary)]')}>{copy.common.match} {match.matchNumber}</Badge>
          {resultLabel ? <Badge variant="gold" className={cn(dashboardTone && 'border-[var(--dash-border)] bg-[#f5f7fa] text-[var(--dash-muted)]')}>{resultLabel}</Badge> : null}
          {match.completedAt ? <Badge variant="gold" className={cn(dashboardTone && 'border-[var(--dash-border)] bg-[#f5f7fa] text-[var(--dash-muted)]')}>{formatDate(match.completedAt)}</Badge> : null}
        </div>
        <span className={cn('inline-flex items-center gap-2 text-sm font-semibold', dashboardTone ? 'text-[var(--dash-primary)]' : 'text-[var(--padel-gold)]')}>
          {copy.history.details}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

function ResultSide({
  side,
  snapshot,
  isBye,
  score,
  winner,
  tone,
  yours = false,
  personal = false,
}: {
  side: 'A' | 'B';
  snapshot?: MatchDto['snapshots'][number];
  isBye: boolean;
  score: number;
  winner: boolean;
  tone: 'brand' | 'dashboard';
  yours?: boolean;
  personal?: boolean;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const dashboardTone = tone === 'dashboard';
  const sideLabel = personal
    ? yours
      ? copy.playerEvent.yourPath
      : null
    : side === 'A'
      ? copy.common.sideA
      : copy.common.sideB;

  return (
    <div
      className={cn(
        'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border p-3',
        dashboardTone
          ? yours
            ? 'rounded-lg border-[rgba(164,22,26,0.24)] bg-[var(--dash-primary-soft)]'
            : winner
              ? 'rounded-lg border-[var(--dash-border)] bg-[#faf6f3]'
              : 'rounded-lg border-[var(--dash-border)] bg-[#faf6f3]'
          : 'rounded-sm border-[var(--padel-line)] bg-[var(--padel-red-2)]/30',
      )}
      data-yours={yours || undefined}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {sideLabel ? (
            <p className={cn('text-[0.65rem] font-semibold uppercase tracking-[0.18em]', dashboardTone ? 'text-[var(--dash-faint)]' : 'text-[var(--padel-muted)]')}>
              {sideLabel}
            </p>
          ) : null}
          {winner ? (
            <span className={cn('inline-flex items-center gap-1 text-[0.65rem] font-bold uppercase tracking-[0.08em]', dashboardTone ? 'text-[var(--dash-primary)]' : 'text-[var(--padel-gold)]')}>
              <Trophy className="h-3 w-3" aria-hidden="true" />
              {copy.common.winner}
            </span>
          ) : null}
        </div>
        <p className={cn('mt-1 text-sm font-semibold leading-5', dashboardTone ? 'text-[var(--dash-text)]' : 'text-[var(--padel-ivory)]')}>
          {snapshot ? `${snapshot.ownerName} / ${snapshot.teammateName}` : isBye ? copy.common.bye : copy.common.participantPending}
        </p>
        {snapshot?.clubName ? <p className={cn('mt-1 text-xs', dashboardTone ? 'text-[var(--dash-muted)]' : 'text-[var(--padel-muted)]')}>{snapshot.clubName}</p> : null}
      </div>
      <div className="text-right">
        <p className={cn('font-mono text-4xl font-semibold tabular-nums', dashboardTone ? 'text-[var(--dash-text)]' : 'text-[var(--padel-ivory)]')}>{score}</p>
      </div>
    </div>
  );
}

function matchSide(match: MatchDto, side: 'A' | 'B') {
  const snapshot = match.snapshots.find((item) => item.side === side);
  return { snapshot, isBye: match.resultType === 'BYE' && !snapshot };
}

/** Which side of a completed match the viewer was on, from live participant ids. */
function sideForViewer(match: MatchDto, viewerUserId: string): 'A' | 'B' | null {
  const onSide = (entry: MatchDto['participantA']) =>
    Boolean(entry && (entry.owner.id === viewerUserId || entry.teammate.id === viewerUserId));
  if (onSide(match.participantA)) return 'A';
  if (onSide(match.participantB)) return 'B';
  return null;
}
