'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Clock, MapPin, Search, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/components/shared/I18nProvider';
import { visibleSets } from '@/lib/matchResult';
import { fillTemplate, tournamentCopy, tournamentRound, tournamentStatus } from '@/lib/i18n/tournament';
import type { Locale } from '@/lib/i18n/types';
import { cn } from '@/lib/utils';
import type { BracketDto, CourtDto, MatchDto, PublicRegistrationTeamDto } from '@/types/tournament';
import { EmptyTournamentState, StatusLabel, TournamentPanel, TournamentSectionHeader } from './TournamentUI';

/** The one panel surface every public event section sits on. */
export const panelSurface = 'rounded-sm border-[var(--padel-line)] bg-[var(--padel-red-2)]/40';

const roundOrder: MatchDto['round'][] = ['ROUND_OF_32', 'ROUND_OF_16', 'QUARTERFINAL', 'SEMIFINAL', 'FINAL'];

/** Live participants, else the locked snapshot, else "to be determined". */
export function matchSideName(match: MatchDto, side: 'A' | 'B', locale: Locale) {
  const entry = side === 'A' ? match.participantA : match.participantB;
  if (entry) return `${entry.owner.fullName} / ${entry.teammate.fullName}`;
  const snapshot = match.snapshots.find((item) => item.side === side);
  if (snapshot) return `${snapshot.ownerName} / ${snapshot.teammateName}`;
  return tournamentCopy[locale].publicEvent.toBeDetermined;
}

/** The winners of a bracket's completed final, or null while the title is open. */
export function bracketChampion(bracket: BracketDto): { names: string; club: string | null } | null {
  const final = bracket.matches.find((match) => match.round === 'FINAL' && match.status === 'COMPLETED');
  if (!final) return null;
  const side = final.winnerEntryId
    ? final.winnerEntryId === final.participantAEntryId ? 'A' : final.winnerEntryId === final.participantBEntryId ? 'B' : null
    : final.scoreA === final.scoreB ? null : final.scoreA > final.scoreB ? 'A' : 'B';
  if (!side) return null;
  const snapshot = final.snapshots.find((item) => item.side === side);
  const entry = side === 'A' ? final.participantA : final.participantB;
  const names = entry
    ? `${entry.owner.fullName} / ${entry.teammate.fullName}`
    : snapshot
      ? `${snapshot.ownerName} / ${snapshot.teammateName}`
      : null;
  return names ? { names, club: snapshot?.clubName ?? null } : null;
}

export type StandingTeam = { names: string; club: string | null };

/** Identity for one side of a match: the frozen snapshot first, the live entry as fallback. */
function sideTeam(match: MatchDto, side: 'A' | 'B'): StandingTeam | null {
  const snapshot = match.snapshots.find((item) => item.side === side);
  const entry = side === 'A' ? match.participantA : match.participantB;
  const names = entry
    ? `${entry.owner.fullName} / ${entry.teammate.fullName}`
    : snapshot
      ? `${snapshot.ownerName} / ${snapshot.teammateName}`
      : null;
  return names ? { names, club: snapshot?.clubName ?? null } : null;
}

function winningSide(match: MatchDto): 'A' | 'B' | null {
  if (match.winnerEntryId) {
    if (match.winnerEntryId === match.participantAEntryId) return 'A';
    if (match.winnerEntryId === match.participantBEntryId) return 'B';
    return null;
  }
  if (match.scoreA === match.scoreB) return null;
  return match.scoreA > match.scoreB ? 'A' : 'B';
}

/**
 * Where a category finished: the final's winner and loser, then whoever the
 * semifinals eliminated.
 *
 * The draw already carries all of it — the page just never read past the
 * champion, so a runner-up who played five matches appeared nowhere. Third place
 * is not played, so both losing semifinalists hold it; saying "3=" twice is
 * truer than inventing an order between them.
 */
export function bracketStandings(bracket: BracketDto): Array<{ place: 1 | 2 | 3; team: StandingTeam }> {
  const final = bracket.matches.find((match) => match.round === 'FINAL' && match.status === 'COMPLETED');
  if (!final) return [];
  const winner = winningSide(final);
  if (!winner) return [];
  const loser = winner === 'A' ? 'B' : 'A';

  const podium: Array<{ place: 1 | 2 | 3; team: StandingTeam }> = [];
  const champion = sideTeam(final, winner);
  const runnerUp = sideTeam(final, loser);
  if (champion) podium.push({ place: 1, team: champion });
  if (runnerUp) podium.push({ place: 2, team: runnerUp });

  for (const match of bracket.matches
    .filter((candidate) => candidate.round === 'SEMIFINAL' && candidate.status === 'COMPLETED')
    .sort((left, right) => left.matchNumber - right.matchNumber)) {
    const side = winningSide(match);
    if (!side) continue;
    const beaten = sideTeam(match, side === 'A' ? 'B' : 'A');
    if (beaten) podium.push({ place: 3, team: beaten });
  }
  return podium;
}

export function LiveBadge() {
  const { locale } = useI18n();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--padel-gold)]/50 bg-[var(--padel-gold)]/10 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.08em] text-[var(--padel-gold)]">
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--padel-gold)] opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--padel-gold)]" />
      </span>
      {tournamentCopy[locale].publicEvent.live}
    </span>
  );
}

export function FilterChips({ label, options, value, onChange }: {
  label: string;
  options: Array<{ id: string; label: string; count?: number }>;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={selected}
            className={cn(
              'min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]',
              selected
                ? 'border-[var(--padel-gold)]/70 bg-[var(--padel-gold)]/15 text-[var(--padel-ivory)]'
                : 'border-[var(--padel-line)] text-[var(--padel-muted)] hover:text-[var(--padel-ivory)]',
            )}
          >
            {option.label}
            {option.count !== undefined ? <span className="ml-2 tabular-nums text-[var(--padel-gold)]">{option.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** One participant line: name on the left, set tally on the right, trophy on the winner. */
export function SideLine({ name, score, winner = false }: { name: string; score: number | null; winner?: boolean }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  return (
    <div className="flex items-center justify-between gap-3">
      <p className={cn('min-w-0 text-sm leading-5', winner ? 'font-bold text-[var(--padel-ivory)]' : 'font-semibold text-[var(--padel-ivory)]/90')}>
        {winner ? <Trophy className="mr-1.5 inline h-3.5 w-3.5 text-[var(--padel-gold)]" aria-label={copy.common.winner} /> : null}
        {name}
      </p>
      {score !== null ? (
        <p className={cn('font-mono text-xl font-semibold tabular-nums', winner ? 'text-[var(--padel-gold)]' : 'text-[var(--padel-ivory)]/80')}>{score}</p>
      ) : null}
    </div>
  );
}

/** Compact per-set winners, so a set tally reads as more than two numbers. */
export function SetChips({ match }: { match: MatchDto }) {
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

/* ------------------------------- Teams tab ------------------------------- */

export function TeamsSection({ teams, rosterPublished }: { teams: PublicRegistrationTeamDto[]; rosterPublished: boolean }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const categories = useMemo(
    () => Array.from(new Map(teams.map((team) => [team.category.id, team.category])).values()),
    [teams],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return teams.filter((team) => {
      if (categoryId !== 'all' && team.category.id !== categoryId) return false;
      if (!needle) return true;
      return [team.owner.fullName, team.teammate.fullName, team.club?.name ?? ''].join(' ').toLowerCase().includes(needle);
    });
  }, [teams, query, categoryId]);

  if (!rosterPublished || !teams.length) {
    return (
      <TournamentPanel className={panelSurface}>
        <TournamentSectionHeader title={copy.publicEvent.registeredTeams} description={copy.publicEvent.registeredTeamsDescription} />
        <EmptyTournamentState title={copy.publicEvent.noApprovedTeams} detail={copy.publicEvent.noApprovedTeamsDescription} />
      </TournamentPanel>
    );
  }

  const groups = categories
    .map((category) => ({ category, rows: filtered.filter((team) => team.category.id === category.id) }))
    .filter((group) => group.rows.length);

  return (
    <TournamentPanel className={panelSurface}>
      <TournamentSectionHeader
        title={copy.publicEvent.registeredTeams}
        description={fillTemplate(copy.publicEvent.teamsTab.shown, { shown: filtered.length, total: teams.length })}
        actions={
          <label className="relative block w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--padel-gold)]" aria-hidden="true" />
            <Input
              aria-label={copy.publicEvent.teamsTab.search}
              placeholder={copy.publicEvent.teamsTab.search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-h-11 w-full rounded-full border-[var(--padel-line)] bg-[var(--padel-red)]/35 pl-10 text-[var(--padel-ivory)] placeholder:text-[var(--padel-muted)]"
            />
          </label>
        }
      />
      <div className="space-y-6 p-4 sm:p-5">
        {categories.length > 1 ? (
          <FilterChips
            label={copy.common.categories}
            value={categoryId}
            onChange={setCategoryId}
            options={[
              { id: 'all', label: copy.publicEvent.teamsTab.allCategories, count: teams.length },
              ...categories.map((category) => ({
                id: category.id,
                label: category.name,
                count: teams.filter((team) => team.category.id === category.id).length,
              })),
            ]}
          />
        ) : null}
        {groups.length ? (
          groups.map(({ category, rows }) => (
            <section key={category.id} aria-labelledby={`teams-${category.id}`}>
              <div className="flex items-center justify-between gap-3 border-b border-[var(--padel-line)] pb-3">
                <h3 id={`teams-${category.id}`} className="font-display text-2xl font-semibold text-[var(--padel-ivory)]">{category.name}</h3>
                <Badge variant="gold">{rows.length} {rows.length === 1 ? copy.common.team : copy.common.teams}</Badge>
              </div>
              <ol className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {rows.map((team, index) => (
                  <li key={team.id} className="flex min-h-16 items-center gap-3 rounded-sm border border-[var(--padel-line)] bg-[var(--padel-red)]/24 p-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--padel-line)] text-xs font-semibold tabular-nums text-[var(--padel-gold)]" aria-hidden="true">{index + 1}</span>
                    <div className="min-w-0">
                      <p className="font-semibold leading-5 text-[var(--padel-ivory)]">{team.owner.fullName} / {team.teammate.fullName}</p>
                      {team.club ? (
                        <Link
                          href={`/clubs/${team.club.slug}`}
                          className="mt-1 inline-flex min-h-6 items-center text-sm font-semibold text-[var(--padel-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]"
                        >
                          {team.club.name}
                        </Link>
                      ) : (
                        <p className="mt-1 text-sm leading-5 text-[var(--padel-muted)]">{copy.publicEvent.independentTeam}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))
        ) : (
          <EmptyTournamentState title={copy.publicEvent.teamsTab.searchEmpty} />
        )}
      </div>
    </TournamentPanel>
  );
}

/* -------------------------------- Draw tab ------------------------------- */

function pairLabel(bracket: BracketDto, match: MatchDto, side: 'A' | 'B', locale: Locale) {
  const entry = side === 'A' ? match.participantA : match.participantB;
  if (entry) return `${entry.owner.fullName} / ${entry.teammate.fullName}`;
  const snapshot = match.snapshots.find((item) => item.side === side);
  if (snapshot) return `${snapshot.ownerName} / ${snapshot.teammateName}`;
  const copy = tournamentCopy[locale];
  // The empty side of a bye is not a team still to be decided — nobody is coming.
  if (match.resultType === 'BYE') return copy.common.bye;
  const source = bracket.matches.find((candidate) => candidate.nextMatchId === match.id && candidate.nextMatchSlot === side);
  return source ? fillTemplate(copy.publicEvent.winnerOfMatch, { number: source.matchNumber }) : copy.publicEvent.toBeDetermined;
}

export function ChampionBanner({ category, champion }: { category: string; champion: { names: string; club: string | null } }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].publicEvent;
  return (
    <div className="flex items-center gap-4 rounded-sm border border-[var(--padel-gold)]/50 bg-[var(--padel-gold)]/10 p-4">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--padel-gold)]/50 bg-[var(--padel-gold)]/10">
        <Trophy className="h-5 w-5 text-[var(--padel-gold)]" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--padel-gold)]">{fillTemplate(copy.drawTab.champions, { category })}</p>
        <p className="mt-1 font-display text-2xl font-semibold leading-7 text-[var(--padel-ivory)]">{champion.names}</p>
        {champion.club ? <p className="mt-0.5 text-sm text-[var(--padel-muted)]">{champion.club}</p> : null}
      </div>
    </div>
  );
}

/**
 * A category's final standings.
 *
 * Place is stated as a number and a word, never by colour alone: the champion
 * row carries the only accent on the panel, and the two below it are told apart
 * by their rank and rule, which is what a printed result sheet does. Joint third
 * repeats the same "3=" on both rows rather than picking one to be fourth.
 */
export function StandingsPanel({ category, standings }: { category: string; standings: Array<{ place: 1 | 2 | 3; team: StandingTeam }> }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].publicEvent.standings;
  const placeLabel = (place: 1 | 2 | 3) =>
    place === 1 ? copy.first : place === 2 ? copy.second : copy.thirdEqual;

  return (
    <section
      className="rounded-sm border border-[var(--padel-line)] bg-[var(--padel-red)]/24 p-4"
      aria-label={fillTemplate(copy.ariaLabel, { category })}
    >
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--padel-muted)]">
        {category}
      </p>
      <ol className="mt-3 space-y-2">
        {standings.map((standing, index) => (
          <li
            key={`${standing.place}-${standing.team.names}-${index}`}
            data-place={standing.place}
            className={
              standing.place === 1
                ? 'flex items-center gap-3 rounded-sm border border-[var(--padel-gold)]/50 bg-[var(--padel-gold)]/10 px-3 py-2.5'
                : 'flex items-center gap-3 rounded-sm border border-[var(--padel-line)] px-3 py-2.5'
            }
          >
            <span
              className={
                standing.place === 1
                  ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--padel-gold)]/50 text-sm font-bold text-[var(--padel-gold)]'
                  : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--padel-line)] text-sm font-bold text-[var(--padel-muted)]'
              }
              aria-hidden="true"
            >
              {standing.place === 3 ? '3=' : standing.place}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium leading-6 text-[var(--padel-ivory)]">{standing.team.names}</p>
              <p className="text-xs text-[var(--padel-muted)]">
                <span className="sr-only">{placeLabel(standing.place)} — </span>
                {standing.team.club ?? placeLabel(standing.place)}
              </p>
            </div>
            {standing.place === 1 ? (
              <Trophy className="h-4 w-4 shrink-0 text-[var(--padel-gold)]" aria-hidden="true" />
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function DrawMatchCard({ bracket, match }: { bracket: BracketDto; match: MatchDto }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const live = match.status === 'IN_PROGRESS';
  const bye = match.resultType === 'BYE';
  const hasScore = !bye && (live || match.status === 'COMPLETED');
  const winnerSide = match.status === 'COMPLETED' ? (match.scoreA > match.scoreB ? 'A' : match.scoreB > match.scoreA ? 'B' : null) : null;
  const nextMatch = match.nextMatchId ? bracket.matches.find((candidate) => candidate.id === match.nextMatchId) : undefined;
  return (
    <Link
      href={`/matches/${match.id}`}
      className={cn(
        'block rounded-sm border border-[var(--padel-line)] p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]',
        bye ? 'bg-[var(--padel-red)]/12 hover:bg-[var(--padel-red)]/28' : 'bg-[var(--padel-red)]/28 hover:bg-[var(--padel-red)]/45',
        live && 'border-[var(--padel-gold)]/50',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[var(--padel-muted)]">{copy.common.match} {match.matchNumber}</span>
        {live ? <LiveBadge /> : <StatusLabel>{tournamentStatus(locale, bye ? 'BYE' : match.status)}</StatusLabel>}
      </div>
      <div className="mt-3 space-y-1.5">
        <SideLine name={pairLabel(bracket, match, 'A', locale)} score={hasScore ? match.scoreA : null} winner={!bye && winnerSide === 'A'} />
        <p className="text-xs text-[var(--padel-muted)]">{copy.common.versus}</p>
        <SideLine name={pairLabel(bracket, match, 'B', locale)} score={hasScore ? match.scoreB : null} winner={!bye && winnerSide === 'B'} />
      </div>
      <SetChips match={match} />
      {bye ? (
        <p className="mt-3 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--padel-muted)]">{copy.publicEvent.drawTab.bye}</p>
      ) : nextMatch ? (
        <p className="mt-3 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--padel-muted)]">
          {fillTemplate(copy.publicEvent.drawTab.advancesTo, { number: nextMatch.matchNumber })}
        </p>
      ) : null}
    </Link>
  );
}

export function DrawSection({ brackets, selectedCategoryId, onSelectCategory }: {
  brackets: BracketDto[];
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  if (!brackets.length) {
    return (
      <TournamentPanel className={panelSurface}>
        <TournamentSectionHeader title={copy.publicEvent.bracket} description={copy.publicEvent.bracketDescription} />
        <EmptyTournamentState title={copy.publicEvent.bracketNotPublished} detail={copy.publicEvent.drawEmptyDescription} />
      </TournamentPanel>
    );
  }
  const bracket = brackets.find((item) => item.categoryId === selectedCategoryId) ?? brackets[0];
  const champion = bracketChampion(bracket);
  const visibleRounds = roundOrder.filter((round) => bracket.matches.some((match) => match.round === round));
  const playable = bracket.matches.filter((match) => match.resultType !== 'BYE');
  const played = playable.filter((match) => match.status === 'COMPLETED').length;
  return (
    <TournamentPanel className={panelSurface}>
      <TournamentSectionHeader title={copy.publicEvent.bracket} description={copy.publicEvent.drawTab.explainer} />
      <div className="space-y-5 p-4 sm:p-5">
        {brackets.length > 1 ? (
          <FilterChips
            label={copy.publicEvent.drawTab.category}
            value={bracket.categoryId}
            onChange={onSelectCategory}
            options={brackets.map((item) => ({ id: item.categoryId, label: item.eventCategory.category.name }))}
          />
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--padel-muted)]">
            {bracket.eventCategory.category.name} · {fillTemplate(copy.publicEvent.drawEntries, { count: bracket.size })} · {fillTemplate(copy.publicEvent.drawTab.playedOf, { done: played, total: playable.length })}
          </p>
          <StatusLabel>{tournamentStatus(locale, bracket.status)}</StatusLabel>
        </div>
        {champion ? <ChampionBanner category={bracket.eventCategory.category.name} champion={champion} /> : null}
        {bracket.matches.length ? (
          <>
            <p className="text-xs text-[var(--padel-muted)] lg:hidden">{copy.publicEvent.drawTab.swipeHint}</p>
            <div className="snap-x overflow-x-auto pb-2">
              <div
                className="grid items-stretch gap-4"
                style={{ gridTemplateColumns: `repeat(${visibleRounds.length}, minmax(15rem, 1fr))`, minWidth: `${visibleRounds.length * 16}rem` }}
              >
                {visibleRounds.map((round) => {
                  const roundMatches = bracket.matches.filter((match) => match.round === round);
                  const setsToWin = bracket.setDefaults[round];
                  return (
                    <div key={round} className="flex min-w-0 snap-start flex-col">
                      <h3 className="mb-3 flex items-baseline justify-between gap-2 border-b border-[var(--padel-line)] pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--padel-gold)]">
                        <span>{tournamentRound(locale, round)}</span>
                        <span className="tabular-nums text-[var(--padel-muted)]">
                          {setsToWin ? `${fillTemplate(copy.publicEvent.drawTab.firstTo, { count: setsToWin })} · ` : ''}{roundMatches.length}
                        </span>
                      </h3>
                      {/* justify-around centers later rounds between their feeder matches, so the columns read as a bracket tree. */}
                      <div className="flex flex-1 flex-col justify-around gap-3">
                        {roundMatches.map((match) => <DrawMatchCard key={match.id} bracket={bracket} match={match} />)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <EmptyTournamentState title={copy.publicEvent.drawEmpty} detail={copy.publicEvent.drawEmptyDescription} />
        )}
      </div>
    </TournamentPanel>
  );
}

/* ------------------------------ Schedule tab ----------------------------- */

/** Planned times repeat dozens of times on match day — show just the time when it falls on the event day. */
function usePlannedTime(eventDate: string) {
  const { formatDate } = useI18n();
  const eventDay = new Date(eventDate).toDateString();
  return (plannedStartAt: string) =>
    new Date(plannedStartAt).toDateString() === eventDay
      ? formatDate(plannedStartAt, { timeStyle: 'short' })
      : formatDate(plannedStartAt, { dateStyle: 'medium', timeStyle: 'short' });
}

function ScheduleMatchCard({ item, eventDate, isUpNext }: {
  item: CourtDto['scheduleItems'][number];
  eventDate: string;
  isUpNext: boolean;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const plannedTime = usePlannedTime(eventDate);
  const match = item.match;
  const category = match.bracket?.eventCategory.category.name ?? copy.publicEvent.tournament;
  const live = match.status === 'IN_PROGRESS';
  const completed = match.status === 'COMPLETED';
  const hasScore = live || completed;
  const winnerSide = completed ? (match.scoreA > match.scoreB ? 'A' : match.scoreB > match.scoreA ? 'B' : null) : null;

  return (
    <Link
      href={`/matches/${match.id}`}
      className={cn(
        'block p-4 transition-colors hover:bg-[var(--padel-red)]/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--padel-gold)]',
        live && 'border-l-2 border-l-[var(--padel-gold)]',
        completed && 'opacity-70 hover:opacity-100',
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="gold">{copy.common.queue} {item.queuePosition}</Badge>
            {isUpNext ? <Badge variant="gold" className="border-[var(--padel-gold)]/60">{copy.publicEvent.scheduleTab.upNext}</Badge> : null}
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--padel-muted)]">
              {category} · {tournamentRound(locale, match.round)} · {copy.common.match} {match.matchNumber}
            </span>
          </div>
          <p className="mt-3 flex items-center gap-2 text-sm text-[var(--padel-muted)]">
            <Clock className="h-4 w-4 text-[var(--padel-gold)]" aria-hidden="true" />
            {item.plannedStartAt ? plannedTime(item.plannedStartAt) : copy.publicEvent.timeTbc}
          </p>
        </div>
        {live ? <LiveBadge /> : <StatusLabel>{tournamentStatus(locale, item.status)}</StatusLabel>}
      </div>

      <div className="mt-4 grid gap-1.5 rounded-sm border border-[var(--padel-line)] bg-[var(--padel-red-2)]/30 p-3">
        <SideLine name={matchSideName(match, 'A', locale)} score={hasScore ? match.scoreA : null} winner={winnerSide === 'A'} />
        <SideLine name={matchSideName(match, 'B', locale)} score={hasScore ? match.scoreB : null} winner={winnerSide === 'B'} />
      </div>
      <SetChips match={match} />
    </Link>
  );
}

function CourtCard({ court, items, eventDate }: {
  court: CourtDto;
  items: CourtDto['scheduleItems'];
  eventDate: string;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const plannedTime = usePlannedTime(eventDate);
  const allItems = [...court.scheduleItems].sort((a, b) => a.queuePosition - b.queuePosition);
  const done = allItems.filter((item) => item.match.status === 'COMPLETED').length;
  const liveItem = allItems.find((item) => item.match.status === 'IN_PROGRESS');
  const upNextItem = allItems.find((item) => item.match.status === 'READY' || item.match.status === 'PENDING');
  const finished = allItems.length > 0 && done === allItems.length;

  return (
    <section className="rounded-sm border border-[var(--padel-line)] bg-[var(--padel-red)]/24">
      <div className="border-b border-[var(--padel-line)] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="font-display text-2xl font-semibold text-[var(--padel-ivory)]">{court.name}</h3>
            <p className="mt-1 flex items-center gap-2 text-sm text-[var(--padel-muted)]">
              <MapPin className="h-4 w-4 text-[var(--padel-gold)]" aria-hidden="true" />
              {court.location || copy.publicEvent.courtLocation}
            </p>
          </div>
          {liveItem ? (
            <LiveBadge />
          ) : finished ? (
            <StatusLabel icon="check">{copy.publicEvent.scheduleTab.finished}</StatusLabel>
          ) : upNextItem ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-[var(--padel-ivory)]">
              <Clock className="h-4 w-4 text-[var(--padel-gold)]" aria-hidden="true" />
              {copy.publicEvent.scheduleTab.upNext}: {upNextItem.plannedStartAt ? plannedTime(upNextItem.plannedStartAt) : `${copy.common.match} ${upNextItem.match.matchNumber}`}
            </p>
          ) : null}
        </div>
        {allItems.length ? (
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--padel-muted)]">
              {fillTemplate(copy.publicEvent.scheduleTab.playedOf, { done, total: allItems.length })}
            </p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--padel-ivory)]/10" aria-hidden="true">
              <div className="h-full rounded-full bg-[var(--padel-gold)]" style={{ width: `${allItems.length ? Math.round((done / allItems.length) * 100) : 0}%` }} />
            </div>
          </div>
        ) : null}
      </div>
      {items.length ? (
        <ol className="divide-y divide-[var(--padel-line)]">
          {items.map((item) => (
            <li key={item.id}>
              <ScheduleMatchCard item={item} eventDate={eventDate} isUpNext={item.id === upNextItem?.id} />
            </li>
          ))}
        </ol>
      ) : (
        <EmptyTournamentState title={copy.publicEvent.noCourtMatches} />
      )}
    </section>
  );
}

function scheduleHaystack(item: CourtDto['scheduleItems'][number], courtName: string) {
  const match = item.match;
  return [
    match.bracket?.eventCategory.category.name,
    String(match.matchNumber),
    courtName,
    match.participantA && `${match.participantA.owner.fullName} ${match.participantA.teammate.fullName}`,
    match.participantB && `${match.participantB.owner.fullName} ${match.participantB.teammate.fullName}`,
    ...match.snapshots.flatMap((snapshot) => [snapshot.ownerName, snapshot.teammateName, snapshot.clubName]),
  ].filter(Boolean).join(' ').toLowerCase();
}

export function ScheduleSection({ courts, eventDate }: { courts: CourtDto[]; eventDate: string }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const [courtId, setCourtId] = useState('all');
  const [query, setQuery] = useState('');
  const scheduledCount = courts.reduce((total, court) => total + court.scheduleItems.length, 0);
  const needle = query.trim().toLowerCase();

  const visibleCourts = useMemo(() => {
    const chipCourts = courtId === 'all' ? courts : courts.filter((court) => court.id === courtId);
    return chipCourts
      .map((court) => ({
        court,
        items: [...court.scheduleItems]
          .sort((a, b) => a.queuePosition - b.queuePosition)
          .filter((item) => !needle || scheduleHaystack(item, court.name).includes(needle)),
      }))
      // While searching, drop courts with no hits instead of showing empty shells.
      .filter(({ items }) => !needle || items.length > 0);
  }, [courts, courtId, needle]);

  if (!courts.length || !scheduledCount) {
    return (
      <TournamentPanel className={panelSurface}>
        <TournamentSectionHeader title={copy.publicEvent.schedule} description={copy.publicEvent.scheduleDescription} />
        <EmptyTournamentState title={copy.publicEvent.scheduleNotPublished} detail={copy.publicEvent.scheduleNotPublishedDescription} />
      </TournamentPanel>
    );
  }

  return (
    <TournamentPanel className={panelSurface}>
      <TournamentSectionHeader
        title={copy.publicEvent.schedule}
        description={copy.publicEvent.scheduleTab.explainer}
        actions={
          <label className="relative block w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--padel-gold)]" aria-hidden="true" />
            <Input
              aria-label={copy.publicEvent.scheduleTab.search}
              placeholder={copy.publicEvent.scheduleTab.search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-h-11 w-full rounded-full border-[var(--padel-line)] bg-[var(--padel-red)]/35 pl-10 text-[var(--padel-ivory)] placeholder:text-[var(--padel-muted)]"
            />
          </label>
        }
      />
      <div className="space-y-5 p-4 sm:p-5">
        {courts.length > 1 ? (
          <FilterChips
            label={copy.publicEvent.schedule}
            value={courtId}
            onChange={setCourtId}
            options={[
              { id: 'all', label: copy.publicEvent.scheduleTab.allCourts, count: scheduledCount },
              ...courts.map((court) => ({ id: court.id, label: court.name, count: court.scheduleItems.length })),
            ]}
          />
        ) : null}
        {visibleCourts.length ? (
          <div className="grid gap-5 lg:grid-cols-2">
            {visibleCourts.map(({ court, items }) => <CourtCard key={court.id} court={court} items={items} eventDate={eventDate} />)}
          </div>
        ) : (
          <EmptyTournamentState title={copy.publicEvent.scheduleTab.searchEmpty} />
        )}
      </div>
    </TournamentPanel>
  );
}

/* ------------------------------ Results tab ------------------------------ */

function ResultCard({ bracket, match }: { bracket: BracketDto; match: MatchDto }) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale];
  const winnerSide = match.scoreA > match.scoreB ? 'A' : match.scoreB > match.scoreA ? 'B' : null;
  return (
    <Link
      href={`/matches/${match.id}`}
      className="block rounded-sm border border-[var(--padel-line)] bg-[var(--padel-red)]/24 p-4 transition-colors hover:bg-[var(--padel-red)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--padel-muted)]">
          {bracket.eventCategory.category.name} · {tournamentRound(locale, match.round)} · {copy.common.match} {match.matchNumber}
        </span>
        {match.completedAt ? <span className="text-xs text-[var(--padel-muted)]">{formatDate(match.completedAt, { dateStyle: 'medium' })}</span> : null}
      </div>
      <div className="mt-3 space-y-1.5">
        <SideLine name={matchSideName(match, 'A', locale)} score={match.scoreA} winner={winnerSide === 'A'} />
        <SideLine name={matchSideName(match, 'B', locale)} score={match.scoreB} winner={winnerSide === 'B'} />
      </div>
      {match.resultType && match.resultType !== 'NORMAL' ? (
        <p className="mt-2 text-xs text-[var(--padel-muted)]">{tournamentStatus(locale, match.resultType)}</p>
      ) : null}
      <SetChips match={match} />
    </Link>
  );
}

export function ResultsSection({ brackets }: { brackets: BracketDto[] }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  // The podium replaces the champion banner here: a runner-up who played every
  // round to the final was previously nowhere on the page that exists to say
  // how the event finished. The banner is still used on the draw tab, where the
  // question really is only "who won this".
  const podiums = brackets
    .map((bracket) => ({ bracket, standings: bracketStandings(bracket) }))
    .filter((entry) => entry.standings.length > 0);
  // Byes are advancement bookkeeping, not played matches — keep them out of results.
  const ordered = brackets
    .flatMap((bracket) => bracket.matches
      .filter((match) => match.status === 'COMPLETED' && match.resultType !== 'BYE')
      .map((match) => ({ bracket, match })))
    .sort((a, b) => {
      const roundDiff = roundOrder.indexOf(b.match.round) - roundOrder.indexOf(a.match.round);
      if (roundDiff) return roundDiff;
      return (b.match.completedAt ?? '').localeCompare(a.match.completedAt ?? '');
    });

  return (
    <TournamentPanel className={panelSurface}>
      <TournamentSectionHeader title={copy.publicEvent.resultsTab.title} description={copy.publicEvent.resultsTab.description} />
      {ordered.length || podiums.length ? (
        <div className="space-y-5 p-4 sm:p-5">
          {podiums.length ? (
            <>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--padel-muted)]">
                {copy.publicEvent.standings.title}
              </p>
              <div className="grid gap-3 lg:grid-cols-2">
                {podiums.map(({ bracket, standings }) => (
                  <StandingsPanel
                    key={bracket.id}
                    category={bracket.eventCategory.category.name}
                    standings={standings}
                  />
                ))}
              </div>
            </>
          ) : null}
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--padel-muted)]">
            {fillTemplate(copy.publicEvent.resultsTab.completedCount, { count: ordered.length })}
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            {ordered.map(({ bracket, match }) => <ResultCard key={match.id} bracket={bracket} match={match} />)}
          </div>
        </div>
      ) : (
        <EmptyTournamentState title={copy.publicEvent.resultsTab.pendingTitle} detail={copy.publicEvent.resultsTab.pendingDetail} />
      )}
    </TournamentPanel>
  );
}

/* --------------------------- Shared match refs ---------------------------- */

/** A match with the court context a visitor needs to find it. */
export type CourtMatchRef = {
  match: MatchDto;
  categoryName: string | null;
  courtName: string | null;
  plannedStartAt: string | null;
  queuePosition: number;
};

export function OverviewMatchCard({ item, live }: { item: CourtMatchRef; live: boolean }) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale];
  const match = item.match;
  return (
    <Link
      href={`/matches/${match.id}`}
      className="block rounded-sm border border-[var(--padel-line)] bg-[var(--padel-red)]/24 p-4 transition-colors hover:bg-[var(--padel-red)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--padel-muted)]">
          {[item.categoryName, tournamentRound(locale, match.round), `${copy.common.match} ${match.matchNumber}`].filter(Boolean).join(' · ')}
        </span>
        {live ? <LiveBadge /> : null}
      </div>
      <div className="mt-3 space-y-1.5">
        <SideLine name={matchSideName(match, 'A', locale)} score={live ? match.scoreA : null} />
        <SideLine name={matchSideName(match, 'B', locale)} score={live ? match.scoreB : null} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--padel-muted)]">
        {item.courtName ? (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-[var(--padel-gold)]" aria-hidden="true" />
            {item.courtName}
          </span>
        ) : null}
        {!live ? (
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-[var(--padel-gold)]" aria-hidden="true" />
            {item.plannedStartAt ? formatDate(item.plannedStartAt, { dateStyle: 'medium', timeStyle: 'short' }) : copy.publicEvent.timeTbc}
          </span>
        ) : null}
      </div>
      {live ? <SetChips match={match} /> : null}
    </Link>
  );
}
