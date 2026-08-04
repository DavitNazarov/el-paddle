'use client';

import { ShareBar, StatLine } from '@/components/shared/dashboard/DashboardCharts';
import { SectionHeading } from '@/components/shared/dashboard/DashboardUI';
import { fillTemplate, tournamentStatus } from '@/lib/i18n/tournament';
import type { Locale } from '@/lib/i18n/types';
import type { PlatformStats } from '@/types/adminStats';
import { formatAgeSeconds, toSegments, type StatsCopy } from './statsModel';
import styles from './AdminStats.module.css';

/**
 * Whether the machinery behind the product is still running. The outbox backlog
 * is the one number that says "notifications silently stopped", and nothing else
 * in the product surfaces it.
 */
export function StatsOperationsPanel({
  operations,
  copy,
  locale,
}: {
  operations: PlatformStats['operations'];
  copy: StatsCopy;
  locale: Locale;
}) {
  const text = copy.operations;
  const oldest = formatAgeSeconds(
    operations.outbox.oldestPendingAgeSeconds,
    { hours: copy.hours, days: copy.days, minutes: copy.minutes },
    fillTemplate,
  );

  return (
    <div className={styles.panel}>
      <section className={styles.block}>
        <ShareBar
          caption={text.email}
          segments={toSegments(
            operations.email.byStatus,
            Object.fromEntries(
              ['SENT', 'QUEUED', 'PROCESSING', 'SKIPPED', 'FAILED'].map((key) => [
                key,
                tournamentStatus(locale, key),
              ]),
            ),
            { SENT: 'teal', QUEUED: 'info', PROCESSING: 'info', SKIPPED: 'amber', FAILED: 'coral' },
          )}
          emptyLabel={copy.noData}
        />
        <div className={styles.lines}>
          <StatLine
            label={text.failedAfterRetries}
            value={operations.email.failedAfterRetries}
            detail={operations.email.failedAfterRetries > 0 ? text.emailHint : undefined}
            tone={operations.email.failedAfterRetries > 0 ? 'warning' : 'neutral'}
          />
        </div>
        {/* No link: there is no delivery-log screen in the app yet, and offering
            one that 404s reads as broken rather than as a shortcut. */}
      </section>

      <section className={styles.block}>
        <SectionHeading title={text.outbox} />
        {operations.outbox.pending === 0 && operations.outbox.failed === 0 ? (
          <p className={styles.note}>{text.outboxHealthy}</p>
        ) : (
          <div className={styles.lines}>
            <StatLine
              label={text.outboxPending}
              value={operations.outbox.pending}
              detail={oldest ? fillTemplate(text.outboxOldest, { duration: oldest }) : undefined}
              tone={operations.outbox.pending > 0 ? 'warning' : 'neutral'}
            />
            <StatLine
              label={text.outboxFailed}
              value={operations.outbox.failed}
              tone={operations.outbox.failed > 0 ? 'warning' : 'neutral'}
            />
          </div>
        )}
      </section>
    </div>
  );
}
