'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRightLeft, ListChecks, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  EmptyState,
  FeedbackBanner,
  FilterChip,
  SectionHeading,
  softButtonClassName,
} from '@/components/shared/dashboard/DashboardUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { usePlayerDashboard } from '@/hooks/usePlayerDashboard';
import { cn } from '@/lib/utils';
import type { PublicUser } from '@/types/auth';
import type { DashboardData, RegistrationDto, StatusFilter } from '@/types/dashboard';
import { ClubLineupEditor } from './ClubLineupEditor';
import { PlayerEntryCard } from './PlayerEntryCard';
import { PlayerShell } from './PlayerShell';

export function PlayerEntriesClient({
  initialUser,
  initialData = null,
}: {
  initialUser: PublicUser;
  initialData?: DashboardData | null;
}) {
  const { dictionary, t } = useI18n();
  const player = dictionary.dashboard.player;
  const api = usePlayerDashboard(initialUser, initialData);
  const {
    user,
    registrations,
    clubMembers,
    clubMembershipRole,
    registrationCounts,
    loading,
    message,
    error,
    setMessage,
    filterRegistrations,
    loadDashboard,
  } = api;
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [managedEntry, setManagedEntry] = useState<RegistrationDto | null>(null);
  const filtered = filterRegistrations(statusFilter);
  const copy = player.clubEntries;
  const clubPlayers = [user, ...clubMembers].filter(
    (member, index, all) => all.findIndex((candidate) => candidate.id === member.id) === index,
  );
  function openLineupManager(registration: RegistrationDto) {
    setManagedEntry(registration);
  }

  return (
    <PlayerShell
      user={user}
      pendingCount={registrationCounts.pending}
      eyebrow={player.pages.entriesEyebrow}
      title={player.pages.entriesTitle}
      description={player.pages.entriesDescription}
    >
      {message ? <FeedbackBanner kind="success">{message}</FeedbackBanner> : null}
      {error ? <FeedbackBanner kind="error">{error}</FeedbackBanner> : null}

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterChip active={statusFilter === 'ALL'} count={registrationCounts.all} onClick={() => setStatusFilter('ALL')}>
          {player.filters.all}
        </FilterChip>
        <FilterChip
          active={statusFilter === 'PENDING'}
          count={registrationCounts.pending}
          onClick={() => setStatusFilter('PENDING')}
        >
          {player.mini.pending}
        </FilterChip>
        <FilterChip
          active={statusFilter === 'APPROVED'}
          count={registrationCounts.approved}
          onClick={() => setStatusFilter('APPROVED')}
        >
          {player.mini.approved}
        </FilterChip>
        <FilterChip
          active={statusFilter === 'DECLINED'}
          count={registrationCounts.declined}
          onClick={() => setStatusFilter('DECLINED')}
        >
          {player.mini.declined}
        </FilterChip>
      </div>

      <SectionHeading
        title={player.sections.statusTitle}
        description={t('dashboard.player.sections.statusDescription', { count: registrations.length })}
      />

      <div className="mt-4 grid gap-3">
        {loading ? <EmptyState title={player.sections.loadingTitle} icon={ListChecks} /> : null}
        {!loading && !registrations.length ? (
          <EmptyState
            title={player.sections.noTeamsTitle}
            description={player.sections.noTeamsDescription}
            icon={Users}
            action={
              <Button asChild variant="red" className="rounded-md">
                <Link href="/dashboard/events">{player.pages.browseEvents}</Link>
              </Button>
            }
          />
        ) : null}
        {!loading && registrations.length > 0 && !filtered.length ? (
          <EmptyState
            title={player.sections.emptyFilterTitle}
            description={player.sections.emptyFilterDescription}
            icon={ListChecks}
            action={
              <Button variant="outline" className={cn(softButtonClassName, 'rounded-md')} onClick={() => setStatusFilter('ALL')}>
                {player.filters.all}
              </Button>
            }
          />
        ) : null}

        {filtered.map((registration) => (
          <PlayerEntryCard
            key={registration.id}
            registration={registration}
            ownershipLabel={
              registration.owner.id === user.id || registration.teammate.id === user.id
                ? copy.yourTeam
                : copy.clubTeam
            }
            actions={clubMembershipRole === 'LEADER' ? (
              <Button
                type="button"
                variant="outline"
                className={cn(softButtonClassName, 'min-h-11 rounded-lg')}
                onClick={() => openLineupManager(registration)}
              >
                <ArrowRightLeft className="h-4 w-4" />
                {copy.manageLineup}
              </Button>
            ) : undefined}
          />
        ))}
      </div>

      {managedEntry ? (
        <ClubLineupEditor
          key={`${managedEntry.id}:${managedEntry.version}`}
          registration={managedEntry}
          clubPlayers={clubPlayers}
          onClose={() => setManagedEntry(null)}
          onConflict={() => loadDashboard(false)}
          onUpdated={async () => {
            setManagedEntry(null);
            setMessage(copy.success);
            await loadDashboard(false);
          }}
        />
      ) : null}
    </PlayerShell>
  );
}
