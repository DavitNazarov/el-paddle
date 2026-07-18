'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CalendarClock, ClipboardList, GitBranch, Swords } from 'lucide-react';
import { apiFetch, createCommandId } from '@/lib/api';
import type { EventDto } from '@/types/admin';
import { AdminShell } from './AdminShell';
import { CommandButton, InlineNotice, KeyValueGrid, TournamentPanel, TournamentSectionHeader } from '@/components/tournament/TournamentUI';
import { DashboardModal } from '@/components/shared/dashboard/DashboardUI';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import { useI18n } from '@/components/shared/I18nProvider';
import { tournamentCopy, tournamentStatus } from '@/lib/i18n/tournament';

const nextStatus: Partial<Record<EventDto['status'], EventDto['status']>> = {
  REGISTRATION_OPEN: 'REGISTRATION_CLOSED',
  REGISTRATION_CLOSED: 'ONGOING',
  ONGOING: 'COMPLETED',
  COMPLETED: 'ONGOING',
};

function statusAction(status: EventDto['status'], copy: typeof tournamentCopy.en.admin.event | typeof tournamentCopy.ka.admin.event) {
  if (status === 'REGISTRATION_OPEN') return copy.closeRegistration;
  if (status === 'REGISTRATION_CLOSED') return copy.startEvent;
  if (status === 'ONGOING') return copy.completeEvent;
  if (status === 'COMPLETED') return copy.reopenEvent;
  return '';
}

export function AdminEventControlClient({ eventId }: { eventId: string }) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale];
  const [event, setEvent] = useState<EventDto | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);

  const load = useCallback(async () => {
    const response = await apiFetch(`/api/events/${eventId}`, { cache: 'no-store' });
    const data = await response.json() as { event?: EventDto; error?: string };
    if (!response.ok) setError(data.error ?? copy.admin.event.loadError);
    else setEvent(data.event ?? null);
  }, [copy.admin.event.loadError, eventId]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  async function advanceStatus() {
    if (!event || !nextStatus[event.status]) return;
    const target = nextStatus[event.status]!;
    setBusy(true);
    setError('');
    const response = await apiFetch(`/api/admin/events/${event.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: target, expectedVersion: event.version, commandId: createCommandId('event-status') }),
    });
    const data = await response.json() as { event?: EventDto; error?: string };
    setBusy(false);
    if (!response.ok) setError(data.error ?? copy.admin.event.updateError);
    else { setEvent(data.event ?? event); setStatusModalOpen(false); }
  }

  async function updatePublication(field: 'publicLiveScoringEnabled' | 'resultsPublished') {
    if (!event) return;
    const value = field === 'publicLiveScoringEnabled' ? !event.publicLiveScoringEnabled : !event.resultsPublishedAt;
    setBusy(true); setError('');
    const response = await apiFetch(`/api/admin/events/${event.id}/tournament-publication`, { method: 'PATCH', body: JSON.stringify({ [field]: value, expectedVersion: event.version }) });
    const data = await response.json() as { event?: EventDto; error?: string };
    setBusy(false); if (!response.ok) setError(data.error ?? copy.admin.event.visibilityError); else setEvent(data.event ?? event);
  }

  return (
    <AdminShell title={event?.title ?? copy.admin.event.fallbackTitle} description={copy.admin.event.description} eyebrow={copy.admin.common.eyebrow}>
      {error ? <InlineNotice kind="error">{error}</InlineNotice> : null}
      {event ? (
        <div className="space-y-5">
          <KeyValueGrid items={[
            { label: copy.admin.event.lifecycle, value: tournamentStatus(locale, event.status) },
            { label: copy.admin.event.eventDate, value: formatDate(event.date, { dateStyle: 'long', timeStyle: 'short' }) },
            { label: copy.common.location, value: event.location },
            { label: copy.common.categories, value: event.categories.map((category) => category.name).join(', ') },
            { label: copy.admin.event.registeredTeams, value: event.registrationRosterPublishedAt ? copy.admin.event.published : copy.admin.event.notPublished },
          ]} />
          <TournamentPanel>
            <TournamentSectionHeader title={copy.admin.event.lifecycle} description={copy.admin.event.lifecycleDescription} actions={statusAction(event.status, copy.admin.event) ? <CommandButton tone="primary" busy={busy} onClick={() => setStatusModalOpen(true)}>{statusAction(event.status, copy.admin.event)}</CommandButton> : undefined} />
            <div className="px-5 py-4 text-sm leading-6 text-[rgba(213,201,177,0.65)]">
              {event.status === 'REGISTRATION_OPEN' ? copy.admin.event.registrationOpenHelp : null}
              {event.status === 'REGISTRATION_CLOSED' ? copy.admin.event.registrationClosedHelp : null}
              {event.status === 'ONGOING' ? copy.admin.event.ongoingHelp : null}
              {event.status === 'COMPLETED' ? copy.admin.event.completedHelp : null}
            </div>
          </TournamentPanel>
          <TournamentPanel>
            <TournamentSectionHeader title={copy.admin.event.visibility} description={event.status === 'COMPLETED' ? copy.admin.event.visibilityLocked : copy.admin.event.visibilityDescription} actions={event.status !== 'COMPLETED' ? <><CommandButton busy={busy} onClick={() => updatePublication('publicLiveScoringEnabled')}>{event.publicLiveScoringEnabled ? copy.admin.event.disableScores : copy.admin.event.enableScores}</CommandButton><CommandButton busy={busy} onClick={() => updatePublication('resultsPublished')}>{event.resultsPublishedAt ? copy.admin.event.unpublishResults : copy.admin.event.publishResults}</CommandButton></> : undefined} />
          </TournamentPanel>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <OperationLink href={`/admin/events/${event.id}/registrations`} icon={ClipboardList} title={copy.admin.event.registrations} detail={copy.admin.event.registrationsDetail} />
            <OperationLink href={`/admin/events/${event.id}/opponent-requests`} icon={Swords} title={copy.admin.event.requests} detail={copy.admin.event.requestsDetail} />
            <OperationLink href={`/admin/events/${event.id}/bracket`} icon={GitBranch} title={copy.admin.event.bracket} detail={copy.admin.event.bracketDetail} />
            <OperationLink href={`/admin/events/${event.id}/schedule`} icon={CalendarClock} title={copy.admin.event.schedule} detail={copy.admin.event.scheduleDetail} />
          </div>
          <DashboardModal
            open={statusModalOpen}
            onOpenChange={(open) => { if (!busy) setStatusModalOpen(open); }}
            title={statusAction(event.status, copy.admin.event)}
            description={copy.admin.event.confirmDescription}
            size="md"
            footer={
              <ModalFormFooter
                onCancel={() => setStatusModalOpen(false)}
                cancelLabel={copy.common.cancel}
                submitType="button"
                onSubmitClick={() => { void advanceStatus(); }}
                busy={busy}
                submitLabel={busy ? copy.admin.event.updating : statusAction(event.status, copy.admin.event)}
              />
            }
          >
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg border border-[rgba(88,16,16,0.12)] bg-white/55 p-4 text-center">
              <div><p className="text-xs uppercase tracking-[0.1em] text-[rgba(88,16,16,0.5)]">{copy.admin.common.current}</p><p className="mt-1 text-sm font-semibold">{tournamentStatus(locale, event.status)}</p></div>
              <ArrowRight aria-hidden="true" className="h-4 w-4 text-[rgba(88,16,16,0.4)]" />
              <div><p className="text-xs uppercase tracking-[0.1em] text-[rgba(88,16,16,0.5)]">{copy.admin.common.next}</p><p className="mt-1 text-sm font-semibold">{nextStatus[event.status] ? tournamentStatus(locale, nextStatus[event.status]!) : ''}</p></div>
            </div>
          </DashboardModal>
        </div>
      ) : !error ? <p className="text-sm text-[rgba(213,201,177,0.6)]">{copy.admin.event.loading}</p> : null}
    </AdminShell>
  );
}

function OperationLink({ href, icon: Icon, title, detail }: { href: string; icon: typeof Swords; title: string; detail: string }) {
  return (
    <Link href={href} className="group min-h-40 rounded-xl border border-[var(--dash-border)] bg-white p-5 shadow-sm transition-colors hover:border-[var(--dash-border-strong)] hover:bg-[#fbfdff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-focus-ring)]">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--dash-sky-soft)] text-[var(--dash-sky)]"><Icon className="h-4 w-4" aria-hidden="true" /></span>
      <h2 className="mt-5 text-base font-semibold text-[var(--dash-text)] group-hover:underline">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--dash-muted)]">{detail}</p>
    </Link>
  );
}
