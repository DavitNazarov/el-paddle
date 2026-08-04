'use client';

import type { ReactNode } from 'react';
import { BarChart3 } from 'lucide-react';
import { Meter, Sparkline, StatDelta, type DeltaLabels } from '@/components/shared/dashboard/DashboardCharts';
import { FilterChip, SectionHeading, SurfaceCard } from '@/components/shared/dashboard/DashboardUI';
import { Skeleton, SkeletonCards, SkeletonRows } from '@/components/shared/dashboard/Feedback';
import { useI18n } from '@/components/shared/I18nProvider';
import { useAdminStats } from '@/hooks/useAdminStats';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import type { PlatformStats, StatsRange } from '@/types/adminStats';
import { StatsBreakdowns } from './StatsBreakdowns';
import { StatsLedger } from './StatsLedger';
import { StatsTrends } from './StatsTrends';
import { StatsWatchList } from './StatsWatchList';
import type { StatsCopy } from './statsModel';
import styles from './AdminStats.module.css';

const RANGES: StatsRange[] = ['7d', '30d', '90d', '12m'];

/**
 * Platform statistics for the administrator home screen: "is the platform
 * growing, and is anything quietly rotting?"
 *
 * The answer is laid out in four falling tiers, and every tier is on screen at
 * once. There are no tabs: the previous three of them hid two thirds of the
 * numbers behind a click and made the questions that span domains — did entries
 * follow accounts, is any queue stuck — impossible to ask. What replaces them is
 * rank. The watch strip asks for action, the headline says how the period moved,
 * the breakdowns say where things stand, and the ledger holds everything that
 * only matters once one of the three above has raised a question.
 *
 * Owns its own read, so the rest of the page never waits on it, and mounts only
 * for an administrator — an organiser holds no power over anything counted here.
 */
export function AdminStatsSection() {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale].admin.stats;
  const { stats, loading, range, setRange } = useAdminStats();

  return (
    <section aria-labelledby="admin-stats-heading" className={styles.section}>
      <SectionHeading
        id="admin-stats-heading"
        title={copy.title}
        description={copy.description}
        actions={
          // The range switcher renders immediately: it is a control, not data.
          <div className={styles.ranges} role="group" aria-label={copy.rangeLabel}>
            {RANGES.map((option) => (
              <FilterChip key={option} active={range === option} onClick={() => setRange(option)}>
                {copy.ranges[option]}
              </FilterChip>
            ))}
          </div>
        }
      />

      {/* Loading shows shape, not the word "loading": skeletons sized like the
          strip, tiles and charts that replace them, so nothing jumps. */}
      {loading && !stats ? (
        <SurfaceCard>
          <div aria-busy="true" aria-label={copy.loading} className={styles.loading}>
            <Skeleton width="100%" height="4.5rem" />
            <SkeletonCards count={4} columns={4} label={copy.loading} />
            <Skeleton width="100%" height="7.5rem" />
            <SkeletonRows rows={3} label={copy.loading} />
          </div>
        </SurfaceCard>
      ) : !stats ? (
        // A refused read is a missing number, not an error banner.
        <SurfaceCard>
          <p className={styles.unavailable}>{copy.unavailable}</p>
        </SurfaceCard>
      ) : (
        <>
          <StatsWatchList stats={stats} copy={copy} />

          <Band title={copy.bands.growth} detail={copy.bands.growthDetail}>
            <Headline stats={stats} copy={copy} trackedSince={
              fillTemplate(copy.notTracked, {
                date: formatDate(stats.headline.deletedAccounts.trackedSince, { dateStyle: 'medium' }),
              })
            } />
            <StatsTrends stats={stats} copy={copy} />
          </Band>

          <Band title={copy.bands.standing} detail={copy.bands.standingDetail}>
            <StatsBreakdowns stats={stats} copy={copy} locale={locale} />
          </Band>

          <Band title={copy.bands.detail} detail={copy.bands.detailDetail}>
            <StatsLedger stats={stats} copy={copy} locale={locale} />
          </Band>

          <p className={styles.asOf}>
            <BarChart3 aria-hidden="true" className={styles.asOfIcon} />
            {fillTemplate(copy.asOf, {
              time: formatDate(stats.generatedAt, { timeStyle: 'short' }),
            })}
          </p>
        </>
      )}
    </section>
  );
}

/** A tier of the screen: a quiet label above its content. Small and uppercase
 *  on purpose — it groups the numbers without competing with them. */
function Band({ title, detail, children }: { title: string; detail: string; children: ReactNode }) {
  return (
    <section className={styles.band}>
      <div className={styles.bandHeading}>
        <h3 className={styles.bandTitle}>{title}</h3>
        <p className={styles.bandDetail}>{detail}</p>
      </div>
      {children}
    </section>
  );
}

/**
 * The four figures that describe the period, each with the shape behind it.
 *
 * A bare "42" says nothing about whether it arrived steadily or in one burst,
 * and the delta only compares two totals. The sparkline is the same series the
 * chart below draws at full size, so the tile and the chart can never disagree.
 */
function Headline({
  stats,
  copy,
  trackedSince,
}: {
  stats: PlatformStats;
  copy: StatsCopy;
  trackedSince: string;
}) {
  const deltaLabels: DeltaLabels = {
    up: copy.up,
    down: copy.down,
    flat: copy.flat,
    vsPrevious: copy.vsPrevious,
    noComparison: copy.noComparison,
  };
  const { headline } = stats;

  return (
    <div className={styles.kpis}>
      <StatDelta
        label={copy.kpi.newAccounts}
        value={headline.newAccounts.current}
        delta={headline.newAccounts}
        goodDirection="up"
        deltaLabels={deltaLabels}
        chart={<Sparkline points={stats.people.joinedAndLeft.joined.map((point) => point.value)} tone="teal" />}
      />
      <StatDelta
        label={copy.kpi.deletedAccounts}
        value={headline.deletedAccounts.current}
        delta={headline.deletedAccounts}
        // Deletions rising is bad news; the direction alone cannot say so.
        goodDirection="down"
        deltaLabels={deltaLabels}
        note={trackedSince}
        chart={<Sparkline points={stats.people.joinedAndLeft.deleted.map((point) => point.value)} tone="coral" />}
      />
      <StatDelta
        label={copy.kpi.signedIn}
        value={headline.signedIn.count}
        hint={fillTemplate(copy.kpi.signedInHint, {
          count: headline.signedIn.count,
          total: headline.signedIn.totalAccounts,
        })}
        // No delta on purpose: only the latest sign-in is stored, so the
        // previous period is unknowable and a delta would be invented. A meter
        // takes the sparkline's place — a share of a known whole, not a series.
        goodDirection="none"
        deltaLabels={deltaLabels}
        note={fillTemplate(copy.kpi.neverSeen, { count: headline.signedIn.neverSeen })}
        chart={
          <Meter
            value={headline.signedIn.count}
            total={headline.signedIn.totalAccounts}
            tone="info"
          />
        }
      />
      <StatDelta
        label={copy.kpi.entries}
        value={headline.entries.current}
        delta={headline.entries}
        goodDirection="up"
        deltaLabels={deltaLabels}
        chart={<Sparkline points={stats.tournaments.entriesPerBucket.map((point) => point.value)} />}
      />
    </div>
  );
}
