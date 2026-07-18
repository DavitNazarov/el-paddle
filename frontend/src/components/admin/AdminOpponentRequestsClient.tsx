'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, createCommandId } from '@/lib/api';
import type { EventDto } from '@/types/admin';
import type { OpponentRequestDto } from '@/types/tournament';
import { AdminShell } from './AdminShell';
import { BackLink, CommandButton, EmptyTournamentState, InlineNotice, ResponsiveDataList, StatusLabel, TournamentPanel, TournamentSectionHeader } from '@/components/tournament/TournamentUI';
import { DashboardField, DashboardModal } from '@/components/shared/dashboard/DashboardUI';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy, tournamentStatus } from '@/lib/i18n/tournament';

function entryName(request: OpponentRequestDto, side: 'requestingEntry' | 'targetEntry') {
  const entry = request[side];
  return `${entry.owner.fullName} / ${entry.teammate.fullName}`;
}

export function AdminOpponentRequestsClient({ eventId }: { eventId: string }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const [event, setEvent] = useState<EventDto | null>(null);
  const [requests, setRequests] = useState<OpponentRequestDto[]>([]);
  const [windows, setWindows] = useState<Array<{ categoryId: string; opponentRequestVersion: number; opponentRequestsOpenedAt: string | null; opponentRequestsClosedAt: string | null }>>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [decision, setDecision] = useState<{ request: OpponentRequestDto; action: 'approve' | 'reject' | 'override-refusal' } | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const isCompleted = event?.status === 'COMPLETED';

  const load = useCallback(async () => {
    const [eventResponse, requestResponse] = await Promise.all([apiFetch(`/api/events/${eventId}`, { cache: 'no-store' }), apiFetch(`/api/admin/events/${eventId}/opponent-requests`, { cache: 'no-store' })]);
    const eventData = await eventResponse.json() as { event?: EventDto; error?: string };
    const requestData = await requestResponse.json() as { requests?: OpponentRequestDto[]; windows?: Array<{ categoryId: string; opponentRequestVersion: number; opponentRequestsOpenedAt: string | null; opponentRequestsClosedAt: string | null }>; error?: string };
    if (!eventResponse.ok || !requestResponse.ok) setError(eventData.error ?? requestData.error ?? copy.admin.requests.loadError);
    else { setEvent(eventData.event ?? null); setRequests(requestData.requests ?? []); setWindows(requestData.windows ?? []); }
  }, [copy.admin.requests.loadError, eventId]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  async function setWindow(categoryId: string, open: boolean) {
    setBusy(`window-${categoryId}`); setError('');
    const version = windows.find((item) => item.categoryId === categoryId)?.opponentRequestVersion ?? 0;
    const response = await apiFetch(`/api/admin/events/${eventId}/categories/${categoryId}/opponent-requests/${open ? 'open' : 'close'}`, { method: 'POST', body: JSON.stringify({ expectedVersion: version, commandId: createCommandId('request-window') }) });
    const data = await response.json() as { error?: string };
    setBusy('');
    if (!response.ok) setError(data.error ?? copy.admin.requests.windowError); else void load();
  }

  function openDecision(request: OpponentRequestDto, action: 'approve' | 'reject' | 'override-refusal') {
    setDecision({ request, action });
    setDecisionReason('');
  }

  async function decide() {
    if (!decision) return;
    const { request, action } = decision;
    const reason = decisionReason.trim();
    if (action !== 'approve' && !reason) return;
    setBusy(`${action}-${request.id}`); setError('');
    const response = await apiFetch(`/api/admin/events/${eventId}/opponent-requests/${request.id}/${action}`, { method: 'POST', body: JSON.stringify({ reason, expectedVersion: request.version, commandId: createCommandId(`request-${action}`) }) });
    const data = await response.json() as { error?: string };
    setBusy('');
    if (!response.ok) setError(data.error ?? copy.admin.requests.updateError);
    else { setDecision(null); setDecisionReason(''); void load(); }
  }

  const rows = requests.map((request) => ({
    id: request.id,
    cells: [
      <span key="from" className="font-medium">{entryName(request, 'requestingEntry')}</span>,
      <span key="to">{entryName(request, 'targetEntry')}</span>,
      <StatusLabel key="status" icon={request.status.includes('REFUSED') ? 'warning' : request.status.includes('APPROVED') || request.status.includes('APPLIED') ? 'check' : 'dot'}>{tournamentStatus(locale, request.status)}</StatusLabel>,
      <span key="reason" className="max-w-xs whitespace-normal">{request.responseReason || request.adminPublicReason || '—'}</span>,
      <div key="actions" className="flex min-w-52 flex-wrap gap-2">
        {request.status === 'ACCEPTED_BY_OPPONENT' ? <CommandButton size="sm" busy={busy === `approve-${request.id}`} disabled={isCompleted} onClick={() => openDecision(request, 'approve')}>{copy.admin.requests.approve}</CommandButton> : null}
        {request.status === 'REFUSED_BY_OPPONENT' ? <CommandButton size="sm" busy={busy === `override-refusal-${request.id}`} disabled={isCompleted} onClick={() => openDecision(request, 'override-refusal')}>{copy.admin.requests.override}</CommandButton> : null}
        {['ACCEPTED_BY_OPPONENT', 'REFUSED_BY_OPPONENT', 'CONFLICTED'].includes(request.status) ? <CommandButton size="sm" busy={busy === `reject-${request.id}`} disabled={isCompleted} onClick={() => openDecision(request, 'reject')}>{copy.admin.requests.reject}</CommandButton> : null}
      </div>,
    ],
  }));

  return (
    <AdminShell title={copy.admin.requests.title} description={copy.admin.requests.description} eyebrow={copy.admin.common.eyebrow}>
      <div className="mb-4"><BackLink href={`/admin/events/${eventId}`}>{copy.admin.common.eventWorkspace}</BackLink></div>
      {error ? <div className="mb-4"><InlineNotice kind="error">{error}</InlineNotice></div> : null}
      {event?.categories.map((category) => (
        <TournamentPanel key={category.id} className="mb-4">
          <TournamentSectionHeader title={category.name} description={isCompleted ? copy.admin.requests.readOnly : copy.admin.requests.categoryDescription} actions={<><CommandButton busy={busy === `window-${category.id}`} disabled={isCompleted} onClick={() => setWindow(category.id, true)}>{copy.admin.requests.open}</CommandButton><CommandButton busy={busy === `window-${category.id}`} disabled={isCompleted} onClick={() => setWindow(category.id, false)}>{copy.admin.requests.close}</CommandButton></>} />
        </TournamentPanel>
      ))}
      <TournamentPanel>
        <TournamentSectionHeader title={copy.admin.requests.review} description={fillTemplate(copy.admin.requests.count, { count: requests.length })} />
        {requests.length ? <ResponsiveDataList headers={[copy.admin.requests.requesting, copy.admin.requests.target, copy.common.status, copy.admin.requests.reason, copy.common.actions]} rows={rows} /> : <EmptyTournamentState title={copy.admin.requests.noRequests} detail={copy.admin.requests.noRequestsDetail} />}
      </TournamentPanel>
      <DashboardModal
        open={Boolean(decision)}
        onOpenChange={(open) => { if (!open && !busy) setDecision(null); }}
        title={decision?.action === 'approve' ? copy.admin.requests.approveTitle : decision?.action === 'reject' ? copy.admin.requests.rejectTitle : copy.admin.requests.overrideTitle}
        description={decision ? `${entryName(decision.request, 'requestingEntry')} → ${entryName(decision.request, 'targetEntry')}` : undefined}
        size="md"
        footer={
          <ModalFormFooter
            onCancel={() => setDecision(null)}
            cancelLabel={copy.common.cancel}
            submitType="button"
            onSubmitClick={() => { void decide(); }}
            busy={Boolean(decision && busy === `${decision.action}-${decision.request.id}`)}
            disabled={Boolean(decision && decision.action !== 'approve' && !decisionReason.trim())}
            submitLabel={decision?.action === 'approve' ? copy.admin.requests.approveRequest : decision?.action === 'reject' ? copy.admin.requests.rejectRequest : copy.admin.requests.override}
            submitVariant={decision?.action === 'approve' ? 'red' : 'destructive'}
          />
        }
      >
        {decision?.action === 'approve' ? (
          <p className="text-sm leading-6 text-[rgba(88,16,16,0.72)]">{copy.admin.requests.pairingNote}</p>
        ) : (
          <DashboardField id="decision-reason" label={copy.admin.requests.publicReason} hint={copy.admin.requests.publicReasonHint}>
            <Textarea id="decision-reason" value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} rows={4} />
          </DashboardField>
        )}
      </DashboardModal>
    </AdminShell>
  );
}
