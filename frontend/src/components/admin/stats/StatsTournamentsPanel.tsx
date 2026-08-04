'use client';

import { ShareBar, StatLine, TrendBars } from '@/components/shared/dashboard/DashboardCharts';
import { DataTable, EmptyState, SectionHeading } from '@/components/shared/dashboard/DashboardUI';
import { fillTemplate, tournamentStatus } from '@/lib/i18n/tournament';
import type { Locale } from '@/lib/i18n/types';
import type { PlatformStats } from '@/types/adminStats';
import { formatDuration, seriesTotal, toSegments, type StatsCopy } from './statsModel';
import styles from './AdminStats.module.css';

/** Registration throughput and what the events themselves are doing. */
export function StatsTournamentsPanel({
  tournaments,
  copy,
  locale,
}: {
  tournaments: PlatformStats['tournaments'];
  copy: StatsCopy;
  locale: Locale;
}) {
  const text = copy.tournaments;
  const durations = { hours: copy.hours, days: copy.days, minutes: copy.minutes };
  // Enum labels come from the shared status vocabulary, so the words here match
  // the ones on every other tournament screen.
  const statusLabels = (keys: string[]) =>
    Object.fromEntries(keys.map((key) => [key, tournamentStatus(locale, key)]));

  const median = formatDuration(tournaments.reviewLatency.medianHours, durations, fillTemplate);
  const p90 = formatDuration(tournaments.reviewLatency.p90Hours, durations, fillTemplate);

  return (
    <div className={styles.panel}>
      {/* The most actionable number on the page: it turns "players are
          complaining" into a figure someone can be held to. */}
      <section className={styles.block}>
        <SectionHeading
          title={text.reviewLatency}
          description={fillTemplate(text.decided, { count: tournaments.reviewLatency.decided })}
        />
        {median === null ? (
          <p className={styles.note}>{text.noDecisions}</p>
        ) : (
          <div className={styles.lines}>
            <StatLine label={text.median} value={median} />
            <StatLine label={text.p90} value={p90 ?? median} />
          </div>
        )}
      </section>

      <section className={styles.block}>
        <TrendBars
          caption={text.entriesTrend}
          series={[
            {
              key: 'entries',
              name: text.entries,
              tone: 'primary',
              total: seriesTotal(tournaments.entriesPerBucket),
              points: tournaments.entriesPerBucket,
            },
          ]}
          tableLabel={text.entriesTrend}
          numbersLabel={copy.showNumbers}
          noDataLabel={copy.noData}
          periodHeader={copy.table.period}
          valueHeader={copy.table.value}
        />
      </section>

      <div className={styles.pair}>
        <section className={styles.block}>
          <ShareBar
            caption={text.outcomes}
            segments={toSegments(
              tournaments.entryOutcomes,
              statusLabels([
                'PENDING',
                'APPROVED',
                'DECLINED',
                'NEEDS_CHANGES',
                'WAITLISTED',
                'WITHDRAWN',
                'CANCELLED',
              ]),
              {
                APPROVED: 'teal',
                PENDING: 'amber',
                NEEDS_CHANGES: 'amber',
                WAITLISTED: 'info',
                DECLINED: 'coral',
                WITHDRAWN: 'coral',
                CANCELLED: 'coral',
              },
            )}
            emptyLabel={copy.noData}
          />
        </section>

        <section className={styles.block}>
          <ShareBar
            caption={text.lifecycle}
            segments={toSegments(
              tournaments.events.byStatus,
              statusLabels(['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'ONGOING', 'COMPLETED']),
              {
                REGISTRATION_OPEN: 'teal',
                REGISTRATION_CLOSED: 'info',
                ONGOING: 'primary',
                COMPLETED: 'amber',
              },
            )}
            emptyLabel={copy.noData}
          />
        </section>
      </div>

      <section className={styles.block}>
        <SectionHeading title={text.lifecycle} />
        <div className={styles.lines}>
          <StatLine label={text.drafts} value={tournaments.events.drafts} />
          {/* Two quiet failures nothing else in the product surfaces. */}
          <StatLine
            label={text.overdue}
            value={tournaments.events.overdue}
            tone={tournaments.events.overdue > 0 ? 'warning' : 'neutral'}
          />
          <StatLine
            label={text.noBracket}
            value={tournaments.events.publishedWithoutDraw}
            tone={tournaments.events.publishedWithoutDraw > 0 ? 'warning' : 'neutral'}
          />
        </div>
      </section>

      <div className={styles.pair}>
        <section className={styles.block}>
          <ShareBar
            caption={text.matchesHint}
            totalLabel={`${text.matches}: ${tournaments.matches.finished}`}
            segments={toSegments(
              tournaments.matches.byResultType,
              statusLabels([
                'NORMAL',
                'BYE',
                'WALKOVER',
                'DISQUALIFICATION',
                'WITHDRAWAL',
                'ADMIN_DECISION',
              ]),
              {
                NORMAL: 'teal',
                BYE: 'info',
                WALKOVER: 'amber',
                WITHDRAWAL: 'amber',
                DISQUALIFICATION: 'coral',
                ADMIN_DECISION: 'primary',
              },
            )}
            emptyLabel={copy.noData}
          />
        </section>

        <section className={styles.block}>
          <ShareBar
            caption={text.requests}
            segments={toSegments(
              tournaments.opponentRequests,
              statusLabels([
                'PENDING_RESPONSE',
                'ACCEPTED_BY_OPPONENT',
                'REFUSED_BY_OPPONENT',
                'WITHDRAWN_BY_REQUESTER',
                'EXPIRED',
                'CONFLICTED',
                'APPROVED_BY_ADMIN',
                'OVERRIDDEN_BY_ADMIN',
                'REJECTED_BY_ADMIN',
                'APPLIED_TO_BRACKET',
              ]),
              {
                APPLIED_TO_BRACKET: 'teal',
                APPROVED_BY_ADMIN: 'teal',
                PENDING_RESPONSE: 'amber',
                ACCEPTED_BY_OPPONENT: 'amber',
                CONFLICTED: 'coral',
                REJECTED_BY_ADMIN: 'coral',
                REFUSED_BY_OPPONENT: 'coral',
              },
            )}
            emptyLabel={copy.noData}
          />
        </section>
      </div>

      <section className={styles.block}>
        <SectionHeading title={text.topClubs} />
        {tournaments.topClubs.length === 0 ? (
          <EmptyState title={text.noClubs} />
        ) : (
          <DataTable
            rows={tournaments.topClubs}
            rowKey={(row) => row.clubId}
            columns={[
              { key: 'name', header: copy.table.club, cell: (row) => row.name },
              {
                key: 'entries',
                header: copy.table.entries,
                width: '8rem',
                cell: (row) => fillTemplate(text.topClubsEntries, { count: row.entries }),
              },
            ]}
          />
        )}
      </section>
    </div>
  );
}
