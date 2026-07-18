'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRightLeft, CalendarDays, ListChecks, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  EmptyState,
  FeedbackBanner,
  FilterChip,
  MetaRow,
  RegistrationStatusBadge,
  SectionHeading,
  SurfaceCard,
  softButtonClassName,
} from '@/components/shared/dashboard/DashboardUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { usePlayerDashboard } from '@/hooks/usePlayerDashboard';
import { cn } from '@/lib/utils';
import type { PublicUser } from '@/types/auth';
import type { RegistrationDto, StatusFilter } from '@/types/dashboard';
import { ClubLineupEditor } from './ClubLineupEditor';
import { PlayerShell } from './PlayerShell';

export function PlayerEntriesClient({ initialUser }: { initialUser: PublicUser }) {
  const { dictionary, t, formatDate } = useI18n();
  const player = dictionary.dashboard.player;
  const api = usePlayerDashboard(initialUser);
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
          <SurfaceCard key={registration.id}>
            <div className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-[var(--padel-ivory)]">{registration.event.title}</h3>
                  <p className="mt-1 text-sm text-[rgba(213,201,177,0.5)]">{registration.category.name}</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Badge className="border-[var(--dash-border)] bg-[#f7f9fc] text-[var(--dash-muted)]">
                    {registration.owner.id === user.id || registration.teammate.id === user.id
                      ? copy.yourTeam
                      : copy.clubTeam}
                  </Badge>
                  <RegistrationStatusBadge status={registration.status} />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                <MetaRow icon={CalendarDays}>
                  {formatDate(registration.event.date, { dateStyle: 'medium', timeStyle: 'short' })}
                </MetaRow>
                <MetaRow icon={Users}>
                  <span className="truncate">
                    {registration.owner.fullName} / {registration.teammate.fullName}
                  </span>
                </MetaRow>
              </div>
              {registration.declineReason ? (
                <p className="mt-3 rounded-md border border-[rgba(194,65,59,0.24)] bg-[var(--dash-coral-soft)] px-3 py-2 text-sm text-[var(--dash-coral)]">
                  {registration.declineReason}
                </p>
              ) : null}
              {clubMembershipRole === 'LEADER' ? (
                <div className="mt-4 border-t border-[var(--dash-border)] pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(softButtonClassName, 'min-h-11 rounded-lg')}
                    onClick={() => openLineupManager(registration)}
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                    {copy.manageLineup}
                  </Button>
                </div>
              ) : null}
            </div>
          </SurfaceCard>
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
