'use client';

import type { ReactNode } from 'react';
import { CalendarDays, Tags, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { InlineNotice, StatusLabel } from '@/components/tournament/TournamentUI';
import { StageRail, type RailStep } from '@/components/shared/dashboard/DashboardSignals';
import { RegistrationStatusBadge } from '@/components/shared/dashboard/DashboardUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { tournamentCopy } from '@/lib/i18n/tournament';
import type { RegistrationDto } from '@/types/dashboard';
import { entryPath, entryStep } from './PlayerNextEvent';
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
  const step = entryStep(registration.status);
  const blocked = step < 0;
  const reason = registration.declineReason || registration.publicStatusReason;

  return (
    <article className={styles.card} data-blocked={blocked}>
      <div className={styles.cardTop}>
        <div className="min-w-0">
          <h3 className={styles.cardTitle}>{registration.event.title}</h3>
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
          {blocked ? (
            <RegistrationStatusBadge status={registration.status} />
          ) : (
            <StatusLabel icon={step >= 1 ? 'check' : 'dot'}>{copy[entryPath[step]!]}</StatusLabel>
          )}
        </div>
      </div>

      {blocked ? null : (
        <div className={styles.cardPath}>
          <StageRail
            steps={entryPath.map((key, index): RailStep => ({
              key,
              label: copy[key],
              state: index < step ? 'done' : index === step ? 'current' : 'upcoming',
            }))}
          />
        </div>
      )}

      {reason ? (
        <div className="px-5 py-4">
          <InlineNotice kind={blocked ? 'error' : 'info'}>{reason}</InlineNotice>
        </div>
      ) : null}

      {actions ? <div className={styles.cardFoot}>{actions}</div> : null}
    </article>
  );
}
