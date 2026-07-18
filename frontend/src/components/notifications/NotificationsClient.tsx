'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { PublicUser } from '@/types/auth';
import type { NotificationDto } from '@/types/tournament';
import { apiFetch } from '@/lib/api';
import { AdminShell } from '@/components/admin/AdminShell';
import { PlayerShell } from '@/components/dashboard/PlayerShell';
import { JudgeShell } from '@/components/judge/JudgeShell';
import { CommandButton, EmptyTournamentState, InlineNotice, StatusLabel, TournamentPanel, TournamentSectionHeader } from '@/components/tournament/TournamentUI';
import { useTournamentRealtime } from '@/hooks/useTournamentRealtime';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';

export function NotificationsClient({ user }: { user: PublicUser }) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale].notifications;
  const [notifications, setNotifications] = useState<NotificationDto[]>([]); const [unreadCount, setUnreadCount] = useState(0); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const response = await apiFetch('/api/notifications', { cache: 'no-store' }); const data = await response.json() as { notifications?: NotificationDto[]; unreadCount?: number; error?: string }; if (!response.ok) setError(data.error ?? copy.loadError); else { setNotifications(data.notifications ?? []); setUnreadCount(data.unreadCount ?? 0); } }, [copy.loadError]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]); useTournamentRealtime({ onChange: load });
  async function markRead(notification: NotificationDto) { if (notification.readAt) return; await apiFetch(`/api/notifications/${notification.id}/read`, { method: 'PATCH' }); void load(); }
  async function markAll() { setBusy(true); await apiFetch('/api/notifications/read-all', { method: 'POST' }); setBusy(false); void load(); }
  const content = <>{error ? <div className="mb-4"><InlineNotice kind="error">{error}</InlineNotice></div> : null}<TournamentPanel><TournamentSectionHeader title={copy.history} description={fillTemplate(copy.unreadCount, { count: unreadCount })} actions={unreadCount ? <CommandButton busy={busy} onClick={markAll}>{copy.markAll}</CommandButton> : undefined} />{notifications.length ? <div className="divide-y divide-[rgba(213,201,177,0.08)]">{notifications.map((notification) => <Link key={notification.id} href={notification.actionPath} onClick={() => void markRead(notification)} className="flex min-h-24 flex-col gap-2 px-5 py-4 hover:bg-[rgba(213,201,177,0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--padel-focus-ring)]"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold text-[var(--padel-ivory)]">{notification.title}</h2><StatusLabel icon={notification.readAt ? 'check' : 'dot'}>{notification.readAt ? copy.read : copy.unread}</StatusLabel></div><p className="text-sm leading-6 text-[rgba(213,201,177,0.6)]">{notification.message}</p><time className="text-xs text-[rgba(213,201,177,0.45)]">{formatDate(notification.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}</time></Link>)}</div> : <EmptyTournamentState title={copy.empty} detail={copy.emptyDescription} />}</TournamentPanel></>;
  if (user.role === 'ADMIN') return <AdminShell title={copy.title} description={copy.adminDescription} eyebrow={copy.account}>{content}</AdminShell>;
  if (user.role === 'JUDGE') return <JudgeShell user={user} title={copy.title} description={copy.judgeDescription}>{content}</JudgeShell>;
  return <PlayerShell user={user} title={copy.title} description={copy.playerDescription}>{content}</PlayerShell>;
}
