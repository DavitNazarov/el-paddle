'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useI18n } from '@/components/shared/I18nProvider';
import { tournamentCopy, tournamentRound, tournamentStatus } from '@/lib/i18n/tournament';
import {
  BackLink,
  EmptyTournamentState,
  InlineNotice,
  StatusLabel,
  TournamentPanel,
  TournamentSectionHeader,
} from '@/components/tournament/TournamentUI';
import { SkeletonCards } from '@/components/shared/dashboard/Feedback';
import { PlayerShell } from '../PlayerShell';
import { activeRounds, pairLabel, winnerSide } from '@/components/admin/bracket/bracketModel';
import type { PublicUser } from '@/types/auth';
import type { DashboardData } from '@/types/dashboard';
import type { BracketDto, MatchDto } from '@/types/tournament';
import styles from './PlayerDraw.module.css';

/**
 * The published draw, read by one competitor: the same matches the public page
 * shows, but with their own team marked so they can trace their path without
 * hunting for their name. Unpublished draws never reach this page — the
 * endpoint only returns published brackets.
 */
export function PlayerDrawClient({ eventId, initialUser }: { eventId: string; initialUser: PublicUser }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const player = copy.playerEvent;

  const [brackets, setBrackets] = useState<BracketDto[]>([]);
  const [eventTitle, setEventTitle] = useState('');
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    const [bracketResponse, dashboardResponse] = await Promise.all([
      apiFetch(`/api/events/${eventId}/brackets`, { cache: 'no-store' }),
      apiFetch('/api/dashboard', { cache: 'no-store' }),
    ]);
    if (!bracketResponse.ok) {
      setError(player.drawLoadError);
      setLoading(false);
      return;
    }
    const bracketData = (await bracketResponse.json()) as { brackets?: BracketDto[] };
    setBrackets(bracketData.brackets ?? []);
    if (dashboardResponse.ok) {
      const dashboard = (await dashboardResponse.json()) as DashboardData;
      setEventTitle(dashboard.events.find((event) => event.id === eventId)?.title ?? '');
      setMine(
        new Set(
          dashboard.registrations
            .filter((registration) => registration.event.id === eventId)
            .map((registration) => registration.id),
        ),
      );
    }
    setLoading(false);
  }, [eventId, player.drawLoadError]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const boards = useMemo(
    () => brackets.map((bracket) => ({ bracket, rounds: activeRounds(bracket.matches) })),
    [brackets],
  );

  return (
    <PlayerShell
      user={initialUser}
      title={player.drawTitle}
      description={player.drawDescription}
      eyebrow={eventTitle || player.event}
    >
      <div className="mb-4">
        <BackLink href={`/dashboard/events/${eventId}`}>{player.backToEvent}</BackLink>
      </div>
      {error ? <div className="mb-4"><InlineNotice kind="error">{error}</InlineNotice></div> : null}

      <div className={styles.page}>
        {loading ? (
          <SkeletonCards count={2} columns={2} label={copy.common.loading} />
        ) : boards.length ? (
          boards.map(({ bracket, rounds }) => (
            <section key={bracket.id} className={styles.category} aria-labelledby={`draw-${bracket.id}`}>
              <TournamentSectionHeader
                id={`draw-${bracket.id}`}
                title={bracket.eventCategory.category.name}
                description={tournamentStatus(locale, bracket.status)}
              />
              <div className={styles.rounds}>
                {rounds.map((round) => {
                  const roundMatches = bracket.matches
                    .filter((match) => match.round === round)
                    .sort((a, b) => a.roundPosition - b.roundPosition);
                  return (
                    <div key={round} className={styles.round}>
                      <h3 className={styles.roundTitle}>
                        {tournamentRound(locale, round)}
                        <small>
                          {roundMatches.length}{' '}
                          {roundMatches.length === 1 ? copy.common.match.toLowerCase() : copy.common.matches}
                        </small>
                      </h3>
                      <ul className={styles.matchList}>
                        {roundMatches.map((match) => (
                          <DrawMatch key={match.id} bracket={bracket} match={match} mine={mine} />
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        ) : (
          <TournamentPanel>
            <EmptyTournamentState title={player.drawNotPublished} />
          </TournamentPanel>
        )}
      </div>
    </PlayerShell>
  );
}

function DrawMatch({ bracket, match, mine }: { bracket: BracketDto; match: MatchDto; mine: Set<string> }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const winner = winnerSide(match);
  const yours =
    (match.participantAEntryId && mine.has(match.participantAEntryId)) ||
    (match.participantBEntryId && mine.has(match.participantBEntryId));
  const scored = match.status === 'IN_PROGRESS' || match.status === 'COMPLETED';

  return (
    <li className={styles.match} data-yours={Boolean(yours)}>
      <Link href={`/matches/${match.id}`} className={styles.matchLink}>
        <div className={styles.matchHead}>
          <span className={styles.matchNumber}>
            {copy.common.match} {match.matchNumber}
          </span>
          <StatusLabel icon={match.status === 'COMPLETED' ? 'check' : 'dot'}>
            {tournamentStatus(locale, match.status)}
          </StatusLabel>
        </div>
        {(['A', 'B'] as const).map((side) => {
          const entryId = side === 'A' ? match.participantAEntryId : match.participantBEntryId;
          const label = pairLabel(bracket, match, side, locale);
          const isYou = Boolean(entryId && mine.has(entryId));
          return (
            <p
              key={side}
              className={styles.pair}
              data-winner={winner === side}
              data-pending={!entryId}
            >
              <span className={styles.pairName}>{label}</span>
              {isYou ? <span className={styles.youBadge}>{copy.playerEvent.yourPath}</span> : null}
              {winner === side ? <Check aria-label={copy.common.winner} /> : null}
              {scored ? (
                <span className={styles.score}>{side === 'A' ? match.scoreA : match.scoreB}</span>
              ) : null}
            </p>
          );
        })}
      </Link>
    </li>
  );
}
