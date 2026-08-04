'use client';

import { ShareBar, StatLine, TrendBars } from '@/components/shared/dashboard/DashboardCharts';
import { SectionHeading } from '@/components/shared/dashboard/DashboardUI';
import type { PlatformStats } from '@/types/adminStats';
import { seriesTotal, toSegments, type StatsCopy } from './statsModel';
import styles from './AdminStats.module.css';

/** Who is on the platform, and how that changed. */
export function StatsPeoplePanel({
  people,
  copy,
}: {
  people: PlatformStats['people'];
  copy: StatsCopy;
}) {
  const text = copy.people;

  return (
    <div className={styles.panel}>
      <section className={styles.block}>
        <TrendBars
          caption={text.trend}
          series={[
            {
              key: 'joined',
              name: text.joined,
              tone: 'teal',
              total: seriesTotal(people.joinedAndLeft.joined),
              points: people.joinedAndLeft.joined,
            },
            {
              key: 'deleted',
              name: text.left,
              tone: 'coral',
              total: seriesTotal(people.joinedAndLeft.deleted),
              points: people.joinedAndLeft.deleted,
            },
          ]}
          tableLabel={text.trend}
          numbersLabel={copy.showNumbers}
          noDataLabel={copy.noData}
          periodHeader={copy.table.period}
          valueHeader={copy.table.value}
        />
      </section>

      <div className={styles.pair}>
        <section className={styles.block}>
          <ShareBar
            caption={text.byRole}
            segments={toSegments(
              people.composition.roles,
              text.roles,
              // Players are the overwhelming majority, so they take the quiet
              // tone: red is the loud brand accent and a 95%-wide red bar would
              // shout at a reader who is only being told the roster shape.
              { USER: 'info', JUDGE: 'teal', ORGANISER: 'amber', ADMIN: 'primary' },
            )}
            emptyLabel={copy.noData}
          />
        </section>

        <section className={styles.block}>
          <ShareBar
            caption={text.byStatus}
            segments={toSegments(
              people.composition.statuses,
              text.userStatuses,
              {
                ACTIVE: 'teal',
                PENDING_VERIFICATION: 'amber',
                INVITED: 'info',
                INACTIVE: 'coral',
              },
            )}
            emptyLabel={copy.noData}
          />
        </section>
      </div>

      <section className={styles.block}>
        <SectionHeading title={text.signupRoute} />
        <div className={styles.lines}>
          <StatLine label={text.google} value={people.signupRoute.google} />
          <StatLine label={text.password} value={people.signupRoute.password} />
        </div>
      </section>

      <section className={styles.block}>
        <SectionHeading title={text.invites} />
        <div className={styles.lines}>
          <StatLine label={text.invitesSent} value={people.invites.sent} />
          <StatLine label={text.invitesAccepted} value={people.invites.accepted} />
          <StatLine
            label={text.invitesExpired}
            value={people.invites.expiredUnused}
            tone={people.invites.expiredUnused > 0 ? 'warning' : 'neutral'}
          />
        </div>
      </section>

      <section className={styles.block}>
        <SectionHeading title={text.clubs} />
        <div className={styles.lines}>
          <StatLine label={text.clubsTotal} value={people.clubs.total} />
          <StatLine label={text.clubsNew} value={people.clubs.created} />
          {/* A player with no club cannot enter any event, which makes a non-zero
              number here a support queue rather than a statistic. */}
          <StatLine
            label={text.playersWithoutClub}
            value={people.clubs.playersWithoutClub}
            detail={people.clubs.playersWithoutClub > 0 ? text.playersWithoutClubHint : undefined}
            tone={people.clubs.playersWithoutClub > 0 ? 'warning' : 'neutral'}
          />
          <StatLine label={text.membersRemoved} value={people.clubMembersRemoved} />
        </div>
      </section>

      <section className={styles.block}>
        <SectionHeading title={text.applications} />
        <div className={styles.lines}>
          <StatLine label={text.applicationsApproved} value={people.applications.approved} />
          <StatLine label={text.applicationsRejected} value={people.applications.rejected} />
          <StatLine
            label={text.applicationsWaiting}
            value={people.applications.waiting}
            tone={people.applications.waiting > 0 ? 'warning' : 'neutral'}
          />
        </div>
        {/* Both outcomes delete the application row and the audit payload never
            copied the submission time, so decision latency is gone for good.
            Say so rather than inventing a proxy. */}
        <p className={styles.note}>{text.applicationsNote}</p>
      </section>
    </div>
  );
}
