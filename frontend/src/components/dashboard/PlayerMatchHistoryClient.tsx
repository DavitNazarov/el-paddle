'use client';

import type { PublicUser } from '@/types/auth';
import { PlayerShell } from './PlayerShell';
import { MatchHistoryClient } from '@/components/tournament/MatchHistoryClient';
import { useI18n } from '@/components/shared/I18nProvider';
import { tournamentCopy } from '@/lib/i18n/tournament';

export function PlayerMatchHistoryClient({ user }: { user: PublicUser }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].playerMatches;
  return (
    <PlayerShell
      user={user}
      title={copy.title}
      description={copy.description}
    >
      <MatchHistoryClient endpoint="/api/me/matches" tone="dashboard" />
    </PlayerShell>
  );
}
