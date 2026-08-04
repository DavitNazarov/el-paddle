'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PublicUser } from '@/types/auth';
import type { NotificationDto } from '@/types/tournament';
import { apiFetch } from '@/lib/api';
import { AdminShell } from '@/components/admin/AdminShell';
import { PlayerShell } from '@/components/dashboard/PlayerShell';
import { JudgeShell } from '@/components/judge/JudgeShell';
import {
  CommandButton,
  EmptyTournamentState,
  InlineNotice,
  TournamentPanel,
  TournamentSectionHeader,
} from '@/components/tournament/TournamentUI';
import { QueueMeter } from '@/components/shared/dashboard/DashboardSignals';
import { SkeletonRows } from '@/components/shared/dashboard/Feedback';
import { useTournamentRealtime } from '@/hooks/useTournamentRealtime';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import { NotificationQueue, meterClassName, queueClassName } from './NotificationQueue';
import { readProgress, sortForQueue } from './notificationsModel';

/**
 * Notifications as a queue: how much is left at the top, then everything still
 * waiting on the reader, then the history grouped by day. Every row links to
 * the thing it is about, so the page is a set of doorways rather than a log.
 */
export function NotificationsClient({ user }: { user: PublicUser }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].notifications;
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const response = await apiFetch('/api/notifications', { cache: 'no-store' });
    const data = await response.json() as { notifications?: NotificationDto[]; unreadCount?: number; error?: string };
    if (!response.ok) setError(data.error ?? copy.loadError);
    else {
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    }
    setLoading(false);
  }, [copy.loadError]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  useTournamentRealtime({ onChange: load });

  async function markRead(notification: NotificationDto) {
    if (notification.readAt) return;
    await apiFetch(`/api/notifications/${notification.id}/read`, { method: 'PATCH' });
    void load();
  }

  async function markAll() {
    setBusy(true);
    await apiFetch('/api/notifications/read-all', { method: 'POST' });
    setBusy(false);
    void load();
  }

  const { unread, read } = sortForQueue(notifications);
  const progress = readProgress(notifications);

  const content = (
    <>
      {error ? <div className="mb-4"><InlineNotice kind="error">{error}</InlineNotice></div> : null}

      <div className={queueClassName}>
        <TournamentPanel>
          <TournamentSectionHeader
            title={copy.history}
            // Never invent a zero: the count is unknown until the read lands.
            description={unreadCount === null ? undefined : fillTemplate(copy.unreadCount, { count: unreadCount })}
            actions={unreadCount ? <CommandButton busy={busy} onClick={markAll}>{copy.markAll}</CommandButton> : undefined}
          />

          {loading ? (
            <SkeletonRows rows={4} label={copy.history} />
          ) : notifications.length ? (
            <>
              {progress.total ? (
                <div className={meterClassName}>
                  <QueueMeter
                    label={copy.readProgress}
                    done={progress.read}
                    total={progress.total}
                    valueLabel={`${progress.read} / ${progress.total}`}
                  />
                </div>
              ) : null}

              {unread.length ? <NotificationQueue notifications={unread} onOpen={markRead} /> : null}
              {read.length ? <NotificationQueue notifications={read} onOpen={markRead} /> : null}
            </>
          ) : (
            <EmptyTournamentState title={copy.empty} detail={copy.emptyDescription} />
          )}
        </TournamentPanel>
      </div>
    </>
  );

  if (user.role === 'ADMIN') return <AdminShell title={copy.title} description={copy.adminDescription} eyebrow={copy.account}>{content}</AdminShell>;
  if (user.role === 'JUDGE') return <JudgeShell user={user} title={copy.title} description={copy.judgeDescription}>{content}</JudgeShell>;
  return <PlayerShell user={user} title={copy.title} description={copy.playerDescription}>{content}</PlayerShell>;
}
