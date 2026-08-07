'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, CalendarDays, Tags, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { InlineNotice, StatusLabel } from '@/components/tournament/TournamentUI';
import { StageRail, type RailStep } from '@/components/shared/dashboard/DashboardSignals';
import { RegistrationStatusBadge } from '@/components/shared/dashboard/DashboardUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { tournamentCopy, tournamentStatus } from '@/lib/i18n/tournament';
import type { RegistrationDto } from '@/types/dashboard';
import { entryNoteKey, entryPath, entryStage } from './entryStatusModel';
import styles from './PlayerHome.module.css';

/**
 * One competition entry, drawn the same way the player home draws the next
 * one: the path to playing, not a status word on its own. Entries that left
 * the path keep the plain badge — a rail would imply progress they do not have.
 */
export function PlayerEntryCard({
  registration,
  ownershipLabel,
  actions,
}: {
  registration: RegistrationDto;
  ownershipLabel: string;
  actions?: ReactNode;
}) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale].playerHome;
  const stage = entryStage(registration);
  const blocked = stage.kind === 'blocked';
  const reason = registration.declineReason || registration.publicStatusReason;

  return (
    <article className={styles.card} data-blocked={blocked}>
      <div className={styles.cardTop}>
        <div className="min-w-0">
          <h3 className={styles.cardTitle}>
            <Link
              href={`/dashboard/events/${registration.event.id}`}
              className="inline-flex items-center gap-1.5 rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-focus-ring)]"
            >
              {registration.event.title}
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--dash-faint)]" aria-hidden="true" />
            </Link>
          </h3>
          <div className={styles.cardMeta}>
            <span>
              <CalendarDays aria-hidden="true" />
              {formatDate(registration.event.date, { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
            <span>
              <Tags aria-hidden="true" />
              {registration.category.name}
            </span>
            <span>
              <Users aria-hidden="true" />
              <span className="truncate">
                {registration.owner.fullName} / {registration.teammate.fullName}
              </span>
            </span>
          </div>
        </div>
        <div className={styles.cardBadges}>
          <Badge className="border-[var(--dash-border)] bg-[var(--dash-tint)] text-[var(--dash-muted)]">
            {ownershipLabel}
          </Badge>
          {stage.kind === 'blocked' ? (
            <RegistrationStatusBadge status={registration.status} />
          ) : stage.attention ? (
            <StatusLabel icon={stage.attention === 'NEEDS_CHANGES' ? 'warning' : 'dot'}>
              {tournamentStatus(locale, registration.status)}
            </StatusLabel>
          ) : (
            <StatusLabel icon={stage.step >= 1 ? 'check' : 'dot'}>{copy[entryPath[stage.step]!]}</StatusLabel>
          )}
        </div>
      </div>

      {stage.kind === 'blocked' ? null : (
        <div className={styles.cardPath}>
          <StageRail
            steps={entryPath.map((key, index): RailStep => ({
              key,
              label: copy[key],
              state: index < stage.step ? 'done' : index === stage.step ? 'current' : 'upcoming',
            }))}
          />
        </div>
      )}

      <div className="px-5 py-4">
        <p className={styles.entryNote}>{copy[entryNoteKey(registration)]}</p>
        {reason ? (
          <div className="mt-3">
            <InlineNotice kind={blocked || registration.status === 'NEEDS_CHANGES' ? 'error' : 'info'}>
              {reason}
            </InlineNotice>
          </div>
        ) : null}
      </div>

      {actions ? <div className={styles.cardFoot}>{actions}</div> : null}
    </article>
  );
}
