'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, CalendarClock, MapPin } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { EmptyTournamentState, InlineNotice, StatusLabel, TournamentPanel, TournamentSectionHeader } from '@/components/tournament/TournamentUI';
import { QueueMeter } from '@/components/shared/dashboard/DashboardSignals';
import { SkeletonCards } from '@/components/shared/dashboard/Feedback';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import type { PublicUser } from '@/types/auth';
import type { JudgeCourtDto } from '@/types/tournament';
import { courtQueueState, type CourtQueueState } from './judgeQueue';
import { JudgeNowCard, type JudgeNowTarget } from './JudgeNowCard';
import { JudgeShell } from './JudgeShell';
import styles from './JudgeHome.module.css';

/** A judge stands at a court for hours; the console has to age gracefully. */
const REFRESH_INTERVAL_MS = 30_000;

type CourtView = JudgeCourtDto & { queue: CourtQueueState };

/**
 * Exactly one match is ever openable across every court a judge holds — the
 * running one, or the first ready one — so the console picks it rather than
 * making the judge choose between courts.
 */
export function selectNowTarget(courts: CourtView[]): JudgeNowTarget | null {
  const court = courts.find((row) => row.queue.current) ?? courts.find((row) => row.queue.next);
  const item = court?.queue.current ?? court?.queue.next;
  if (!court || !item) return null;
  return {
    item,
    live: Boolean(court.queue.current),
    courtName: court.court.name,
    eventTitle: court.event.title,
    queueHref: `/judge/events/${court.event.id}/courts/${court.court.id}`,
  };
}

export function JudgeHomeClient({ user }: { user: PublicUser }) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale];
  const home = copy.judge.home;
  const [courts, setCourts] = useState<CourtView[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const response = await apiFetch('/api/judge/home', { cache: 'no-store' });
    const data = (await response.json()) as { courts?: JudgeCourtDto[]; error?: string };
    if (!response.ok) {
      setError(data.error ?? home.loadError);
      return;
    }
    setError('');
    setCourts((data.courts ?? []).map((court) => ({ ...court, queue: courtQueueState(court.items) })));
  }, [home.loadError]);

  // Scores are recorded on other devices, so a console left open on a bench
  // goes stale. It refreshes on a timer and whenever the judge returns to the
  // tab, and stays quiet while the tab is hidden rather than polling in the dark.
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      if (cancelled || document.visibilityState === 'hidden') return;
      await load();
      if (!cancelled) setLoading(false);
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, REFRESH_INTERVAL_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load]);

  const target = selectNowTarget(courts);
  const allFinished = courts.length > 0
    && courts.every((court) => court.queue.total > 0 && court.queue.done >= court.queue.total);

  return (
    <JudgeShell user={user} title={home.title} description={home.description}>
      {error ? <div className="mb-4"><InlineNotice kind="error">{error}</InlineNotice></div> : null}

      <div className="space-y-5">
        <JudgeNowCard target={target} loading={loading} hasCourts={courts.length > 0} />

        {allFinished ? <InlineNotice kind="success">{home.allDone}</InlineNotice> : null}

        <TournamentPanel labelledBy="judge-courts">
          <TournamentSectionHeader
            id="judge-courts"
            title={home.yourCourts}
            description={home.yourCourtsDescription}
            actions={courts.length ? <StatusLabel>{fillTemplate(home.courtCount, { count: courts.length })}</StatusLabel> : undefined}
          />
          {courts.length ? (
            <div className="p-4 sm:p-5">
              <JudgeCourtGrid courts={courts} formatDate={formatDate} />
            </div>
          ) : loading ? (
            <div className="p-4 sm:p-5">
              <SkeletonCards count={2} columns={2} label={copy.common.loading} />
            </div>
          ) : (
            <EmptyTournamentState title={home.noAssignment} detail={home.noAssignmentDetail} />
          )}
        </TournamentPanel>
      </div>
    </JudgeShell>
  );
}

/** Every court the judge holds, each with how far its queue has run. */
export function JudgeCourtGrid({
  courts,
  formatDate,
}: {
  courts: CourtView[];
  formatDate: (value: string, options?: Intl.DateTimeFormatOptions) => string;
}) {
  const { locale } = useI18n();
  const home = tournamentCopy[locale].judge.home;

  return (
    <div className={styles.courtGrid}>
      {courts.map((court) => {
        const finished = court.queue.total > 0 && court.queue.done >= court.queue.total;
        return (
          <article key={court.assignmentId} className={styles.courtCard}>
            <div className={styles.courtTop}>
              <div className="min-w-0">
                <h3 className={styles.courtName}>{court.court.name}</h3>
                <p className={styles.courtEvent}>{court.event.title}</p>
              </div>
              <StatusLabel icon={finished ? 'check' : 'dot'}>
                {court.queue.current ? home.live : finished ? home.courtClear : home.waiting}
              </StatusLabel>
            </div>
            <QueueMeter
              label={home.queueProgress}
              done={court.queue.done}
              total={court.queue.total}
              valueLabel={fillTemplate(home.matchesDone, { done: court.queue.done, total: court.queue.total })}
            />
            <p className={styles.courtShift}>
              <CalendarClock aria-hidden="true" />
              {formatDate(court.startsAt, { timeStyle: 'short' })} – {formatDate(court.endsAt, { timeStyle: 'short' })}
            </p>
            {court.court.location ? (
              <p className={styles.courtShift}>
                <MapPin aria-hidden="true" />
                {court.court.location}
              </p>
            ) : null}
            <div className={styles.courtFoot}>
              <Link href={`/judge/events/${court.event.id}/courts/${court.court.id}`} className={styles.queueLink}>
                {home.openQueue}
                <ArrowUpRight aria-hidden="true" />
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
