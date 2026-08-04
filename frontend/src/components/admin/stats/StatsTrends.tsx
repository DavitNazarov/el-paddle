'use client';

import { TrendBars } from '@/components/shared/dashboard/DashboardCharts';
import { SurfaceCard } from '@/components/shared/dashboard/DashboardUI';
import type { PlatformStats } from '@/types/adminStats';
import { seriesTotal, type StatsCopy } from './statsModel';
import styles from './AdminStats.module.css';

/**
 * The two curves that describe the period: people arriving and leaving, and
 * entries being submitted.
 *
 * They were previously one tab apart, which made the obvious question — did the
 * entries follow the accounts? — impossible to ask. Side by side on the same
 * row, sharing a bucket axis, it answers itself.
 */
export function StatsTrends({ stats, copy }: { stats: PlatformStats; copy: StatsCopy }) {
  const people = copy.people;
  const tournaments = copy.tournaments;
  const { joined, deleted } = stats.people.joinedAndLeft;

  return (
    <SurfaceCard className={styles.card}>
      <div className={styles.trends}>
        <TrendBars
          caption={people.trend}
          series={[
            { key: 'joined', name: people.joined, tone: 'teal', total: seriesTotal(joined), points: joined },
            { key: 'deleted', name: people.left, tone: 'coral', total: seriesTotal(deleted), points: deleted },
          ]}
          tableLabel={people.trend}
          numbersLabel={copy.showNumbers}
          noDataLabel={copy.noData}
          periodHeader={copy.table.period}
          valueHeader={copy.table.value}
        />

        <TrendBars
          caption={tournaments.entriesTrend}
          series={[
            {
              key: 'entries',
              name: tournaments.entries,
              tone: 'primary',
              total: seriesTotal(stats.tournaments.entriesPerBucket),
              points: stats.tournaments.entriesPerBucket,
            },
          ]}
          tableLabel={tournaments.entriesTrend}
          numbersLabel={copy.showNumbers}
          noDataLabel={copy.noData}
          periodHeader={copy.table.period}
          valueHeader={copy.table.value}
        />
      </div>
    </SurfaceCard>
  );
}
