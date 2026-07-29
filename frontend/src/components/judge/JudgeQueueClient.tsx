'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  BackLink,
  EmptyTournamentState,
  InlineNotice,
  StatusLabel,
  TournamentPanel,
  TournamentSectionHeader,
} from '@/components/tournament/TournamentUI';
import { QueueMeter } from '@/components/shared/dashboard/DashboardSignals';
import { SkeletonRows } from '@/components/shared/dashboard/Feedback';
import { useTournamentRealtime } from '@/hooks/useTournamentRealtime';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import type { PublicUser } from '@/types/auth';
import type { ScheduleItemDto } from '@/types/tournament';
import { courtQueueState } from './judgeQueue';
import { JudgeNowCard } from './JudgeNowCard';
import { JudgeQueueList } from './JudgeQueueList';
import { JudgeShell } from './JudgeShell';

export function JudgeQueueClient({ user, eventId, courtId }: { user: PublicUser; eventId: string; courtId: string }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const queueCopy = copy.judge.queue;
  const home = copy.judge.home;
  const [items, setItems] = useState<ScheduleItemDto[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const response = await apiFetch(`/api/judge/events/${eventId}/courts/${courtId}/queue`, { cache: 'no-store' });
    const data = await response.json() as { items?: ScheduleItemDto[]; error?: string };
    if (!response.ok) setError(data.error ?? queueCopy.loadError);
    else {
      setItems(data.items ?? []);
      setError('');
    }
    setLoading(false);
  }, [queueCopy.loadError, courtId, eventId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useTournamentRealtime({ eventId, onChange: load });

  const queue = courtQueueState(items);
  const openable = queue.current ?? queue.next;
  const courtName = items[0]?.court?.name ?? '';

  return (
    <JudgeShell user={user} title={queueCopy.title} description={queueCopy.description}>
      <div className="mb-4">
        <BackLink href="/judge">{copy.judge.shell.assignments}</BackLink>
      </div>
      {error ? <div className="mb-4"><InlineNotice kind="error">{error}</InlineNotice></div> : null}

      <div className="space-y-5">
        {/* The same card as the judge home, so the match in front of the judge
            looks identical whichever screen they reached it from. */}
        <JudgeNowCard
          target={openable ? {
            item: openable,
            live: Boolean(queue.current),
            courtName: courtName || queueCopy.assignedCourt,
            eventTitle: openable.match.bracket?.event.title ?? '',
            queueHref: `/judge/events/${eventId}/courts/${courtId}`,
          } : null}
          loading={loading}
          hasCourts
        />

        <TournamentPanel labelledBy="judge-queue">
          <TournamentSectionHeader
            id="judge-queue"
            title={queueCopy.matchQueue}
            description={queueCopy.queueDescription}
            actions={queue.total ? (
              <StatusLabel icon={queue.done >= queue.total ? 'check' : 'dot'}>
                {fillTemplate(home.matchesDone, { done: queue.done, total: queue.total })}
              </StatusLabel>
            ) : undefined}
          />
          {queue.total ? (
            <>
              <div className="border-b border-[var(--dash-border)] px-5 py-4">
                <QueueMeter
                  label={home.queueProgress}
                  done={queue.done}
                  total={queue.total}
                  valueLabel={fillTemplate(home.matchesDone, { done: queue.done, total: queue.total })}
                />
              </div>
              <JudgeQueueList
                items={items}
                openItemId={openable?.id ?? null}
                liveItemId={queue.current?.id ?? null}
              />
            </>
          ) : loading ? (
            <SkeletonRows rows={4} label={copy.common.loading} />
          ) : (
            <EmptyTournamentState title={queueCopy.empty} />
          )}
        </TournamentPanel>
      </div>
    </JudgeShell>
  );
}
