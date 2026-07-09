'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ListChecks, Users } from 'lucide-react';
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
import type { StatusFilter } from '@/types/dashboard';
import { PlayerShell } from './PlayerShell';

export function PlayerEntriesClient({ initialUser }: { initialUser: PublicUser }) {
  const { dictionary, t, formatDate } = useI18n();
  const player = dictionary.dashboard.player;
  const api = usePlayerDashboard(initialUser);
  const { user, registrations, registrationCounts, loading, message, error, filterRegistrations } = api;
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const filtered = filterRegistrations(statusFilter);

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
                  <p className="mt-1 text-sm text-[rgba(246,239,225,0.5)]">{registration.category.name}</p>
                </div>
                <RegistrationStatusBadge status={registration.status} />
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
                <p className="mt-3 rounded-md border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {registration.declineReason}
                </p>
              ) : null}
            </div>
          </SurfaceCard>
        ))}
      </div>
    </PlayerShell>
  );
}
