'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, createCommandId } from '@/lib/api';
import type { EventDto } from '@/types/admin';
import { AdminShell } from './AdminShell';
import { EventOrganiserPanel } from './EventOrganiserPanel';
import { EventHeaderBand } from './event-workspace/EventHeaderBand';
import { EventAgendaBand } from './event-workspace/EventAgendaBand';
import { EventStageList } from './event-workspace/EventStageList';
import { EventPublicationList, type PublicationField } from './event-workspace/EventPublicationList';
import { CommandButton, InlineNotice } from '@/components/tournament/TournamentUI';
import { DashboardModal } from '@/components/shared/dashboard/DashboardUI';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import { SkeletonRows } from '@/components/shared/dashboard/Feedback';
import { pushToast } from '@/components/shared/Toasts';
import { useI18n } from '@/components/shared/I18nProvider';
import { useEventWorkspaceSignals } from '@/hooks/useEventWorkspaceSignals';
import { fillTemplate, tournamentCopy, tournamentStatus } from '@/lib/i18n/tournament';

/**
 * The event workspace: what needs doing, and where each thing is done.
 *
 * It answers three questions in that order — which event and how far along, what
 * is waiting on the operator, and which screen resolves it. Everything the page
 * used to explain about each stage in prose is now the stage's own live count,
 * because after the first visit nobody reads the explanation and everybody reads
 * the number.
 */

const nextStatus: Partial<Record<EventDto['status'], EventDto['status']>> = {
  REGISTRATION_OPEN: 'REGISTRATION_CLOSED',
  REGISTRATION_CLOSED: 'ONGOING',
  ONGOING: 'COMPLETED',
  COMPLETED: 'ONGOING',
};

type EventCopy = (typeof tournamentCopy)['en' | 'ka']['admin']['event'];

function statusAction(status: EventDto['status'], copy: EventCopy) {
  if (status === 'REGISTRATION_OPEN') return copy.closeRegistration;
  if (status === 'REGISTRATION_CLOSED') return copy.startEvent;
  if (status === 'ONGOING') return copy.completeEvent;
  if (status === 'COMPLETED') return copy.reopenEvent;
  return '';
}

export function AdminEventControlClient({ eventId }: { eventId: string }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const eventCopy = copy.admin.event;
  const shared = copy.admin.common;
  const [event, setEvent] = useState<EventDto | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  // Stage counts load beside the event rather than blocking it: the lifecycle
  // must be actionable even when a stage read is slow or refused.
  const { signals, loading: signalsLoading } = useEventWorkspaceSignals(eventId);

  const load = useCallback(async () => {
    try {
      const response = await apiFetch(`/api/events/${eventId}`, { cache: 'no-store' });
      const data = await response.json() as { event?: EventDto; error?: string };
      if (!response.ok) setError(data.error ?? eventCopy.loadError);
      else { setEvent(data.event ?? null); setError(''); }
    } catch {
      setError(eventCopy.loadError);
    }
  }, [eventCopy.loadError, eventId]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  /**
   * Both commands on this screen report through the message layer: one is sent
   * from inside a dialog and the other from a row far down the page, and a
   * banner at the top is a result neither reader would see.
   */
  const send = useCallback(async (
    path: string,
    body: unknown,
    failure: string,
    success: (updated: EventDto) => string,
  ) => {
    setBusy(true);
    try {
      const response = await apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) });
      const data = await response.json().catch(() => ({})) as { event?: EventDto; error?: string };
      if (!response.ok) {
        pushToast({ tone: 'error', title: failure, message: data.error ?? shared.commandFailed });
        return null;
      }
      const updated = data.event ?? null;
      if (updated) {
        setEvent(updated);
        pushToast({ tone: 'success', message: success(updated) });
      }
      return updated;
    } catch {
      pushToast({ tone: 'error', title: failure, message: shared.offline });
      return null;
    } finally {
      setBusy(false);
    }
  }, [shared.commandFailed, shared.offline]);

  async function advanceStatus() {
    if (!event) return;
    const target = nextStatus[event.status];
    if (!target) return;
    const updated = await send(
      `/api/admin/events/${event.id}/status`,
      { status: target, expectedVersion: event.version, commandId: createCommandId('event-status') },
      eventCopy.statusError,
      (next) => fillTemplate(eventCopy.stageChanged, { stage: tournamentStatus(locale, next.status) }),
    );
    if (updated) setStatusModalOpen(false);
  }

  async function updatePublication(field: PublicationField, next: boolean) {
    if (!event) return;
    const surface = field === 'publicLiveScoringEnabled' ? eventCopy.liveScoresLabel : eventCopy.finalResultsLabel;
    await send(
      `/api/admin/events/${event.id}/tournament-publication`,
      { [field]: next, expectedVersion: event.version },
      eventCopy.visibilityError,
      () => fillTemplate(next ? eventCopy.nowPublic : eventCopy.nowHidden, { surface }),
    );
  }

  const action = event ? statusAction(event.status, eventCopy) : '';
  const target = event ? nextStatus[event.status] : undefined;

  return (
    <AdminShell
      title={event?.title ?? eventCopy.fallbackTitle}
      description={eventCopy.description}
      eyebrow={copy.admin.common.eyebrow}
    >
      {/* Only a failure to load the event stays on the page — it describes the
          screen itself. Command outcomes go to the message layer. */}
      {error ? <div className="mb-4"><InlineNotice kind="error" onDismiss={() => setError('')}>{error}</InlineNotice></div> : null}

      {event ? (
        <div className="space-y-4">
          <EventHeaderBand
            event={event}
            action={action ? (
              <CommandButton tone="primary" busy={busy} onClick={() => setStatusModalOpen(true)}>
                {action}
              </CommandButton>
            ) : undefined}
          />

          <EventAgendaBand event={event} signals={signals} loading={signalsLoading} />
          <EventStageList event={event} signals={signals} />
          <EventPublicationList
            event={event}
            signals={signals}
            busy={busy}
            onToggle={(field, next) => { void updatePublication(field, next); }}
          />
          <EventOrganiserPanel eventId={event.id} />

          <DashboardModal
            open={statusModalOpen}
            onOpenChange={(open) => { if (!busy) setStatusModalOpen(open); }}
            title={action}
            description={eventCopy.confirmDescription}
            size="md"
            footer={
              <ModalFormFooter
                onCancel={() => setStatusModalOpen(false)}
                cancelLabel={copy.common.cancel}
                submitType="button"
                onSubmitClick={() => { void advanceStatus(); }}
                busy={busy}
                submitLabel={busy ? eventCopy.updating : action}
              />
            }
          >
            <p className="text-sm leading-6 text-[var(--dash-text)]">
              {fillTemplate(eventCopy.confirmMoves, {
                from: tournamentStatus(locale, event.status),
                to: target ? tournamentStatus(locale, target) : '',
              })}
            </p>
          </DashboardModal>
        </div>
      ) : error ? null : (
        <SkeletonRows rows={4} label={eventCopy.loading} />
      )}
    </AdminShell>
  );
}
