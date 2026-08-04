'use client';

import {
  DonutChart,
  FunnelBars,
  Meter,
  RankedBars,
  ShareBar,
  StatRow,
} from '@/components/shared/dashboard/DashboardCharts';
import { SurfaceCard } from '@/components/shared/dashboard/DashboardUI';
import { fillTemplate, tournamentStatus } from '@/lib/i18n/tournament';
import type { Locale } from '@/lib/i18n/types';
import type { PlatformStats } from '@/types/adminStats';
import { formatAgeSeconds, toSegments, valueFor, type StatsCopy } from './statsModel';
import styles from './AdminStats.module.css';

/**
 * The long tail: every count that explains a headline number but is not one.
 *
 * Each card leads with the picture its numbers make — a ratio as a ring, a
 * process as a funnel, a part of a whole as a meter — and then states the exact
 * figures underneath. The chart is what makes a card readable at a glance; the
 * rows are what make it quotable, and neither is allowed to exist without the
 * other.
 */
export function StatsLedger({
  stats,
  copy,
  locale,
}: {
  stats: PlatformStats;
  copy: StatsCopy;
  locale: Locale;
}) {
  const people = copy.people;
  const tournaments = copy.tournaments;
  const operations = copy.operations;
  const cards = copy.cards;
  const oldest = formatAgeSeconds(
    stats.operations.outbox.oldestPendingAgeSeconds,
    { hours: copy.hours, days: copy.days, minutes: copy.minutes },
    fillTemplate,
  );
  const signup = stats.people.signupRoute;
  const players = valueFor(stats.people.composition.roles, 'USER');

  return (
    <div className={styles.cards}>
      {/* A near-even two-way split is the one case a ring beats a bar: the
          question is the ratio, and a ring is read as a ratio. */}
      <SurfaceCard className={styles.card}>
        <h3 className={styles.cardTitle}>{people.signupRoute}</h3>
        <DonutChart
          caption={people.signupRoute}
          hideCaption
          centerValue={String(signup.google + signup.password)}
          centerLabel={copy.total}
          segments={[
            { key: 'google', name: people.google, value: signup.google, tone: 'info' },
            { key: 'password', name: people.password, value: signup.password, tone: 'teal' },
          ]}
          emptyLabel={copy.noData}
        />
      </SurfaceCard>

      {/* Sent and accepted are the same population measured twice, not two parts
          of one — so they taper rather than stack. */}
      <SurfaceCard className={styles.card}>
        <h3 className={styles.cardTitle}>{people.invites}</h3>
        <div className={styles.stack}>
          <FunnelBars
            caption={people.invites}
            hideCaption
            steps={[
              { key: 'sent', name: people.invitesSent, value: stats.people.invites.sent },
              { key: 'accepted', name: people.invitesAccepted, value: stats.people.invites.accepted },
            ]}
            emptyLabel={copy.noData}
          />
          <div className={styles.figures}>
            <StatRow label={people.invitesExpired} value={stats.people.invites.expiredUnused} />
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard className={styles.card}>
        <h3 className={styles.cardTitle}>{people.clubs}</h3>
        <div className={styles.stack}>
          {/* Twelve is meaningless on its own: twelve out of twenty players is a
              crisis and twelve out of three hundred is a Tuesday. */}
          <Meter
            value={stats.people.clubs.playersWithoutClub}
            total={players}
            tone="amber"
            // The meter is the only thing above the rows, so it has to name
            // itself; a bare "12 of 318" would be a bar measuring nothing.
            caption={`${people.playersWithoutClub} · ${fillTemplate(people.playersWithoutClubShare, {
              count: stats.people.clubs.playersWithoutClub,
              total: players,
            })}`}
          />
          <div className={styles.figures}>
            <StatRow label={people.clubsTotal} value={stats.people.clubs.total} />
            <StatRow label={people.clubsNew} value={stats.people.clubs.created} />
            <StatRow
              label={people.playersWithoutClub}
              value={stats.people.clubs.playersWithoutClub}
              detail={
                stats.people.clubs.playersWithoutClub > 0 ? people.playersWithoutClubHint : undefined
              }
            />
            <StatRow label={people.membersRemoved} value={stats.people.clubMembersRemoved} />
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard className={styles.card}>
        <h3 className={styles.cardTitle}>{people.applications}</h3>
        <div className={styles.stack}>
          <DonutChart
            caption={people.applications}
            hideCaption
            centerValue={String(
              stats.people.applications.approved +
                stats.people.applications.rejected +
                stats.people.applications.waiting,
            )}
            centerLabel={copy.total}
            segments={[
              { key: 'approved', name: people.applicationsApproved, value: stats.people.applications.approved, tone: 'teal' },
              { key: 'rejected', name: people.applicationsRejected, value: stats.people.applications.rejected, tone: 'coral' },
              { key: 'waiting', name: people.applicationsWaiting, value: stats.people.applications.waiting, tone: 'amber' },
            ]}
            emptyLabel={copy.noData}
          />
          {/* Both outcomes delete the application row and the audit payload never
              copied the submission time, so decision latency is gone for good.
              Say so rather than inventing a proxy. */}
          <p className={styles.note}>{people.applicationsNote}</p>
        </div>
      </SurfaceCard>

      {/* The outbox backlog is the one number that says "notifications silently
          stopped", and nothing else in the product surfaces it. Full width
          because it is the fifth of five: half a row of empty card beside it
          would read as something that failed to load. */}
      <SurfaceCard className={`${styles.card} ${styles.cardWide}`}>
        <h3 className={styles.cardTitle}>{cards.delivery}</h3>
        <div className={styles.stack}>
          <ShareBar
            caption={operations.email}
            segments={toSegments(
              stats.operations.email.byStatus,
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
          <div className={styles.figures}>
            <StatRow
              label={operations.failedAfterRetries}
              value={stats.operations.email.failedAfterRetries}
              detail={
                stats.operations.email.failedAfterRetries > 0 ? operations.emailHint : undefined
              }
            />
            <StatRow
              label={operations.outboxPending}
              value={stats.operations.outbox.pending}
              detail={oldest ? fillTemplate(operations.outboxOldest, { duration: oldest }) : undefined}
            />
            <StatRow label={operations.outboxFailed} value={stats.operations.outbox.failed} />
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard className={`${styles.card} ${styles.cardWide}`}>
        <RankedBars
          caption={tournaments.topClubs}
          rows={stats.tournaments.topClubs.map((club) => ({
            key: club.clubId,
            name: club.name,
            value: club.entries,
          }))}
          emptyLabel={tournaments.noClubs}
          formatValue={(value) => fillTemplate(tournaments.topClubsEntries, { count: value })}
        />
      </SurfaceCard>
    </div>
  );
}
