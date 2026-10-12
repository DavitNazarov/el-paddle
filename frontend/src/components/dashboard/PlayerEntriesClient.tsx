'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRightLeft, ListChecks, LogOut, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  EmptyState,
  FeedbackBanner,
  FilterChip,
  softButtonClassName,
} from '@/components/shared/dashboard/DashboardUI';
import { SkeletonCards } from '@/components/shared/dashboard/Feedback';
import { useI18n } from '@/components/shared/I18nProvider';
import { usePlayerDashboard } from '@/hooks/usePlayerDashboard';
import { tournamentCopy } from '@/lib/i18n/tournament';
import { cn } from '@/lib/utils';
import type { PublicUser } from '@/types/auth';
import type { DashboardData, RegistrationDto, StatusFilter } from '@/types/dashboard';
import { ClubLineupEditor } from './ClubLineupEditor';
import { EntryWithdrawDialog } from './EntryWithdrawDialog';
import { PlayerEntryCard } from './PlayerEntryCard';
import { PlayerShell } from './PlayerShell';

/**
 * Entries a club can still pull out of. Once a status is terminal — declined,
 * cancelled, already withdrawn — there is nothing to withdraw from, and the
 * server refuses anyway, so the command is not offered.
 */
const withdrawableStatuses = new Set(['PENDING', 'APPROVED', 'NEEDS_CHANGES', 'WAITLISTED']);

export function PlayerEntriesClient({
  initialUser,
  initialData = null,
}: {
  initialUser: PublicUser;
  initialData?: DashboardData | null;
}) {
  const { dictionary, locale } = useI18n();
  const player = dictionary.dashboard.player;
  const api = usePlayerDashboard(initialUser, initialData);
  const {
    user,
    registrations,
    clubMembers,
    clubMembershipRole,
    registrationCounts,
    loading,
    loadFailed,
    message,
    error,
    setMessage,
    filterRegistrations,
    loadDashboard,
  } = api;
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [managedEntry, setManagedEntry] = useState<RegistrationDto | null>(null);
  const [withdrawingEntry, setWithdrawingEntry] = useState<RegistrationDto | null>(null);
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
      eyebrow={player.pages.entriesEyebrow}
      title={player.pages.entriesTitle}
      description={player.pages.entriesDescription}
    >
      {loadFailed ? (
        <FeedbackBanner
          kind="error"
          actions={
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn(softButtonClassName, 'rounded-md')}
              onClick={() => void loadDashboard()}
            >
              {tournamentCopy[locale].playerHome.retry}
            </Button>
          }
        >
          {tournamentCopy[locale].playerHome.loadFailed}
        </FeedbackBanner>
      ) : null}
      {message ? <FeedbackBanner kind="success">{message}</FeedbackBanner> : null}
      {error ? <FeedbackBanner kind="error">{error}</FeedbackBanner> : null}

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterChip active={statusFilter === 'ALL'} count={registrationCounts.all} onClick={() => setStatusFilter('ALL')}>
          {player.filters.all}
        </FilterChip>
        {/* Entries waiting on the player come first — they are the only ones
            the player can actually move. Hidden when there are none. */}
        {registrationCounts.attention > 0 ? (
          <FilterChip
            active={statusFilter === 'NEEDS_CHANGES'}
            count={registrationCounts.attention}
            onClick={() => setStatusFilter('NEEDS_CHANGES')}
          >
            {player.mini.attention}
          </FilterChip>
        ) : null}
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
        {registrationCounts.waitlisted > 0 ? (
          <FilterChip
            active={statusFilter === 'WAITLISTED'}
            count={registrationCounts.waitlisted}
            onClick={() => setStatusFilter('WAITLISTED')}
          >
            {player.mini.waitlisted}
          </FilterChip>
        ) : null}
        <FilterChip
          active={statusFilter === 'DECLINED'}
          count={registrationCounts.declined}
          onClick={() => setStatusFilter('DECLINED')}
        >
          {player.mini.declined}
        </FilterChip>
      </div>

      <div className="mt-4 grid gap-3">
        {loading ? (
          <SkeletonCards count={3} columns={2} label={player.sections.loadingTitle} />
        ) : null}
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
              <>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(softButtonClassName, 'min-h-11 rounded-lg')}
                  onClick={() => openLineupManager(registration)}
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  {copy.manageLineup}
                </Button>
                {withdrawableStatuses.has(registration.status) ? (
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(softButtonClassName, 'min-h-11 rounded-lg')}
                    onClick={() => setWithdrawingEntry(registration)}
                  >
                    <LogOut className="h-4 w-4" />
                    {dictionary.dashboard.player.withdrawEntry.action}
                  </Button>
                ) : null}
              </>
            ) : undefined}
          />
        ))}
      </div>

      {withdrawingEntry ? (
        <EntryWithdrawDialog
          key={`${withdrawingEntry.id}:${withdrawingEntry.version}`}
          registration={withdrawingEntry}
          onClose={() => setWithdrawingEntry(null)}
          onConflict={() => loadDashboard(false)}
          onWithdrawn={async () => {
            const title = withdrawingEntry.event.title;
            setWithdrawingEntry(null);
            // Names the entry that left, not "Saved" — a leader may withdraw
            // one of several teams and has to see which one landed.
            setMessage(dictionary.dashboard.player.withdrawEntry.success.replace('{event}', title));
            await loadDashboard(false);
          }}
        />
      ) : null}

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
