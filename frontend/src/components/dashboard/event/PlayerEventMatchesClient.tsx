'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { useI18n } from '@/components/shared/I18nProvider';
import { tournamentCopy } from '@/lib/i18n/tournament';
import { BackLink, InlineNotice } from '@/components/tournament/TournamentUI';
import { softButtonClassName } from '@/components/shared/dashboard/DashboardUI';
import { SkeletonCards } from '@/components/shared/dashboard/Feedback';
import { cn } from '@/lib/utils';
import { PlayerShell } from '../PlayerShell';
import { PlayerMatchPanel } from './PlayerEventSections';
import { ownEntryIds, playerMatches } from './playerEventModel';
import type { PublicUser } from '@/types/auth';
import type { DashboardData } from '@/types/dashboard';
import type { BracketDto, CourtDto } from '@/types/tournament';

/**
 * One event, only the competitor's matches — court, time, round, and score —
 * without the entry path and opponent-request workspace around them.
 */
export function PlayerEventMatchesClient({
  eventId,
  initialUser,
}: {
  eventId: string;
  initialUser: PublicUser;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const player = copy.playerEvent;

  const [eventTitle, setEventTitle] = useState('');
  const [brackets, setBrackets] = useState<BracketDto[]>([]);
  const [courts, setCourts] = useState<CourtDto[]>([]);
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    const [dashboardResponse, bracketResponse, scheduleResponse] = await Promise.all([
      apiFetch('/api/dashboard', { cache: 'no-store' }),
      apiFetch(`/api/events/${eventId}/brackets`, { cache: 'no-store' }),
      apiFetch(`/api/public/events/${eventId}/schedule`, { cache: 'no-store' }),
    ]);
    if (!dashboardResponse.ok) {
      setError(player.loadError);
      setLoading(false);
      return;
    }
    const dashboard = (await dashboardResponse.json()) as DashboardData;
    const bracketData = (await bracketResponse.json()) as { brackets?: BracketDto[] };
    const scheduleData = (await scheduleResponse.json()) as { courts?: CourtDto[] };
    setEventTitle(dashboard.events.find((event) => event.id === eventId)?.title ?? '');
    setMine(
      ownEntryIds(
        dashboard.registrations.filter((registration) => registration.event.id === eventId),
      ),
    );
    setBrackets(bracketResponse.ok ? bracketData.brackets ?? [] : []);
    setCourts(scheduleResponse.ok ? scheduleData.courts ?? [] : []);
    setLoading(false);
  }, [eventId, player.loadError]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const matches = useMemo(() => playerMatches(brackets, courts, mine), [brackets, courts, mine]);

  return (
    <PlayerShell
      user={initialUser}
      title={eventTitle || player.matchesTitle}
      description={player.matchesDescription}
      eyebrow={player.eyebrow}
    >
      <div className="mb-4">
        <BackLink href={`/dashboard/events/${eventId}`}>{player.backToEvent}</BackLink>
      </div>
      {error ? (
        <div className="mb-4">
          <InlineNotice kind="error">{error}</InlineNotice>
        </div>
      ) : null}
      {loading ? (
        <SkeletonCards count={1} columns={2} label={copy.common.loading} />
      ) : (
        <PlayerMatchPanel
          matches={matches}
          emptyTitle={player.noMatches}
          emptyDetail={player.noMatchesDetail}
          actions={
            brackets.length ? (
              <Button asChild variant="outline" size="sm" className={cn(softButtonClassName, 'rounded-md')}>
                <Link href={`/dashboard/events/${eventId}/draw`}>
                  <Network className="h-4 w-4" aria-hidden="true" />
                  {player.seeDraw}
                </Link>
              </Button>
            ) : undefined
          }
        />
      )}
    </PlayerShell>
  );
}
