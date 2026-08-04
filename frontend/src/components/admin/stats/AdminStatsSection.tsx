'use client';

import { BarChart3 } from 'lucide-react';
import { StatDelta, type DeltaLabels } from '@/components/shared/dashboard/DashboardCharts';
import {
  FilterChip,
  SectionHeading,
  SurfaceCard,
} from '@/components/shared/dashboard/DashboardUI';
import { Skeleton, SkeletonCards, SkeletonRows } from '@/components/shared/dashboard/Feedback';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useI18n } from '@/components/shared/I18nProvider';
import { useAdminStats } from '@/hooks/useAdminStats';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import type { StatsRange } from '@/types/adminStats';
import { StatsOperationsPanel } from './StatsOperationsPanel';
import { StatsPeoplePanel } from './StatsPeoplePanel';
import { StatsTournamentsPanel } from './StatsTournamentsPanel';
import styles from './AdminStats.module.css';

const RANGES: StatsRange[] = ['7d', '30d', '90d', '12m'];

/**
 * Platform statistics for the administrator home screen: "is the platform
 * growing, and is anything quietly rotting?"
 *
 * Owns its own read, so the rest of the page never waits on it, and mounts only
 * for an administrator — an organiser holds no power over anything counted here.
 */
export function AdminStatsSection() {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale].admin.stats;
  const { stats, loading, range, setRange } = useAdminStats();

  const deltaLabels: DeltaLabels = {
    up: copy.up,
    down: copy.down,
    flat: copy.flat,
    vsPrevious: copy.vsPrevious,
    noComparison: copy.noComparison,
  };

  const headline = stats?.headline;
  const trackedSince = headline
    ? fillTemplate(copy.notTracked, {
        date: formatDate(headline.deletedAccounts.trackedSince, { dateStyle: 'medium' }),
      })
    : undefined;

  return (
    <section aria-labelledby="admin-stats-heading">
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

      <SurfaceCard className={styles.card}>
        {/* Loading shows shape, not the word "loading": skeletons sized like the
            tiles and chart that replace them, so nothing jumps. */}
        {loading && !stats ? (
          <div aria-busy="true" aria-label={copy.loading} className={styles.loading}>
            <SkeletonCards count={4} columns={4} label={copy.loading} />
            <Skeleton width="100%" height="7.5rem" />
            <SkeletonRows rows={3} label={copy.loading} />
          </div>
        ) : !stats ? (
          // A refused read is a missing number, not an error banner.
          <p className={styles.unavailable}>{copy.unavailable}</p>
        ) : (
          <>
            <div className={styles.kpis}>
              <StatDelta
                label={copy.kpi.newAccounts}
                value={stats.headline.newAccounts.current}
                delta={stats.headline.newAccounts}
                goodDirection="up"
                deltaLabels={deltaLabels}
              />
              <StatDelta
                label={copy.kpi.deletedAccounts}
                value={stats.headline.deletedAccounts.current}
                delta={stats.headline.deletedAccounts}
                // Deletions rising is bad news; the direction alone cannot say so.
                goodDirection="down"
                deltaLabels={deltaLabels}
                note={trackedSince}
              />
              <StatDelta
                label={copy.kpi.signedIn}
                value={stats.headline.signedIn.count}
                hint={fillTemplate(copy.kpi.signedInHint, {
                  count: stats.headline.signedIn.count,
                  total: stats.headline.signedIn.totalAccounts,
                })}
                // No delta on purpose: only the latest sign-in is stored, so the
                // previous period is unknowable and a delta would be invented.
                goodDirection="none"
                deltaLabels={deltaLabels}
                note={fillTemplate(copy.kpi.neverSeen, {
                  count: stats.headline.signedIn.neverSeen,
                })}
              />
              <StatDelta
                label={copy.kpi.entries}
                value={stats.headline.entries.current}
                delta={stats.headline.entries}
                goodDirection="up"
                deltaLabels={deltaLabels}
              />
            </div>

            <Tabs defaultValue="people" className={styles.tabs}>
              {/* The vendored tab styling is built for the dark marketing theme;
                  these overrides put it on the light dashboard canvas and keep
                  three Georgian labels inside 375px. */}
              <TabsList className={styles.tabsList}>
                <TabsTrigger value="people" className={styles.tabsTrigger}>
                  {copy.tabs.people}
                </TabsTrigger>
                <TabsTrigger value="tournaments" className={styles.tabsTrigger}>
                  {copy.tabs.tournaments}
                </TabsTrigger>
                <TabsTrigger value="operations" className={styles.tabsTrigger}>
                  {copy.tabs.operations}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="people">
                <StatsPeoplePanel people={stats.people} copy={copy} />
              </TabsContent>
              <TabsContent value="tournaments">
                <StatsTournamentsPanel
                  tournaments={stats.tournaments}
                  copy={copy}
                  locale={locale}
                />
              </TabsContent>
              <TabsContent value="operations">
                <StatsOperationsPanel
                  operations={stats.operations}
                  copy={copy}
                  locale={locale}
                />
              </TabsContent>
            </Tabs>

            <p className={styles.asOf}>
              <BarChart3 aria-hidden="true" className={styles.asOfIcon} />
              {fillTemplate(copy.asOf, {
                time: formatDate(stats.generatedAt, { timeStyle: 'short' }),
              })}
            </p>
          </>
        )}
      </SurfaceCard>
    </section>
  );
}
