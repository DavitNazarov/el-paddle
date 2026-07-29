'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { apiFetch, createCommandId } from '@/lib/api';
import type { EventDto } from '@/types/admin';
import { AdminShell } from './AdminShell';
import { EventOrganiserPanel } from './EventOrganiserPanel';
import { EventLifecycleHero } from './event-workspace/EventLifecycleHero';
import { EventStageBoard } from './event-workspace/EventStageBoard';
import { EventPublicationBoard, type PublicationField } from './event-workspace/EventPublicationBoard';
import { CommandButton, InlineNotice } from '@/components/tournament/TournamentUI';
import { DashboardModal } from '@/components/shared/dashboard/DashboardUI';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import { useI18n } from '@/components/shared/I18nProvider';
import { useEventWorkspaceSignals } from '@/hooks/useEventWorkspaceSignals';
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
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const [event, setEvent] = useState<EventDto | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  // Stage counts load beside the event rather than blocking it: the lifecycle
  // must be actionable even when a stage read is slow or refused.
  const { signals } = useEventWorkspaceSignals(eventId);

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

  async function updatePublication(field: PublicationField) {
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
          <EventLifecycleHero
            event={event}
            action={statusAction(event.status, copy.admin.event) ? (
              <CommandButton tone="primary" busy={busy} onClick={() => setStatusModalOpen(true)}>
                {statusAction(event.status, copy.admin.event)}
              </CommandButton>
            ) : undefined}
          />
          <EventStageBoard event={event} signals={signals} />
          <EventPublicationBoard event={event} signals={signals} busy={busy} onToggle={(field) => { void updatePublication(field); }} />
          <EventOrganiserPanel eventId={event.id} />
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
      ) : !error ? <p className="text-sm text-[var(--dash-muted)]">{copy.admin.event.loading}</p> : null}
    </AdminShell>
  );
}
