'use client';

import { RangeBar, ShareBar, StatRow } from '@/components/shared/dashboard/DashboardCharts';
import { SurfaceCard } from '@/components/shared/dashboard/DashboardUI';
import { fillTemplate, tournamentStatus } from '@/lib/i18n/tournament';
import type { Locale } from '@/lib/i18n/types';
import type { PlatformStats } from '@/types/adminStats';
import { formatDuration, toSegments, type StatsCopy } from './statsModel';
import styles from './AdminStats.module.css';

/**
 * Four cards of the same shape — a title, a share bar, and at most two figures.
 *
 * Repeating one shape four times is the point: the reader learns it once and
 * then reads composition, review, lifecycle and play at the same speed. The
 * distributions that used to be spread over three tabs sit on one grid, and
 * none of them is allowed to grow a second chart or a third list.
 */
export function StatsBreakdowns({
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
  const cards = copy.cards;
  // Enum labels come from the shared status vocabulary, so the words here match
  // the ones on every other tournament screen.
  const statusLabels = (keys: string[]) =>
    Object.fromEntries(keys.map((key) => [key, tournamentStatus(locale, key)]));

  const durations = { hours: copy.hours, days: copy.days, minutes: copy.minutes };
  const latency = stats.tournaments.reviewLatency;
  const median = formatDuration(latency.medianHours, durations, fillTemplate);
  const p90 = formatDuration(latency.p90Hours, durations, fillTemplate);

  return (
    <div className={styles.cards}>
      <SurfaceCard className={styles.card}>
        <h3 className={styles.cardTitle}>{cards.accounts}</h3>
        <div className={styles.stack}>
          <ShareBar
            caption={people.byRole}
            segments={toSegments(
              stats.people.composition.roles,
              people.roles,
              // Players are the overwhelming majority, so they take the quiet
              // tone: red is the loud brand accent and a 95%-wide red bar would
              // shout at a reader who is only being told the roster shape.
              { USER: 'info', JUDGE: 'teal', ORGANISER: 'amber', ADMIN: 'primary' },
            )}
            emptyLabel={copy.noData}
          />
          <ShareBar
            caption={people.byStatus}
            segments={toSegments(stats.people.composition.statuses, people.userStatuses, {
              ACTIVE: 'teal',
              PENDING_VERIFICATION: 'amber',
              INVITED: 'info',
              INACTIVE: 'coral',
            })}
            emptyLabel={copy.noData}
          />
        </div>
      </SurfaceCard>

      {/* The most actionable numbers on the screen: they turn "players are
          complaining" into a figure someone can be held to. */}
      <SurfaceCard className={styles.card}>
        <h3 className={styles.cardTitle}>{cards.entryReview}</h3>
        <div className={styles.stack}>
          {median === null || latency.medianHours === null ? (
            <p className={styles.note}>{tournaments.noDecisions}</p>
          ) : (
            <RangeBar
              caption={tournaments.reviewLatency}
              lowerLabel={tournaments.median}
              lowerText={median}
              lowerValue={latency.medianHours}
              upperLabel={tournaments.p90}
              upperText={p90 ?? median}
              // No ninetieth percentile means too few decisions to have a tail;
              // anchoring on the median then draws a full track rather than a
              // scale that silently pretends the tail is zero.
              upperValue={latency.p90Hours ?? latency.medianHours}
            />
          )}
          <ShareBar
            caption={tournaments.outcomes}
            totalLabel={fillTemplate(tournaments.decided, {
              count: stats.tournaments.reviewLatency.decided,
            })}
            segments={toSegments(
              stats.tournaments.entryOutcomes,
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
        </div>
      </SurfaceCard>

      <SurfaceCard className={styles.card}>
        <h3 className={styles.cardTitle}>{cards.events}</h3>
        <div className={styles.stack}>
          <ShareBar
            caption={tournaments.lifecycle}
            segments={toSegments(
              stats.tournaments.events.byStatus,
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
          {/* Overdue and draw-less events are deliberately plain here: the watch
              strip at the top of the screen already owns the alarm, and sounding
              it twice teaches the reader to discount both. */}
          <div className={styles.figures}>
            <StatRow label={tournaments.drafts} value={stats.tournaments.events.drafts} />
            <StatRow label={tournaments.overdue} value={stats.tournaments.events.overdue} />
            <StatRow
              label={tournaments.noBracket}
              value={stats.tournaments.events.publishedWithoutDraw}
            />
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard className={styles.card}>
        <h3 className={styles.cardTitle}>{cards.play}</h3>
        <div className={styles.stack}>
          <ShareBar
            caption={tournaments.matchesHint}
            totalLabel={`${tournaments.matches}: ${stats.tournaments.matches.finished}`}
            segments={toSegments(
              stats.tournaments.matches.byResultType,
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
          <ShareBar
            caption={tournaments.requests}
            segments={toSegments(
              stats.tournaments.opponentRequests,
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
        </div>
      </SurfaceCard>
    </div>
  );
}
