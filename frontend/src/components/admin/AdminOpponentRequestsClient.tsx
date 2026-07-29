'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, createCommandId } from '@/lib/api';
import type { EventDto } from '@/types/admin';
import type { OpponentRequestDto } from '@/types/tournament';
import { AdminShell } from './AdminShell';
import {
  BackLink,
  CommandButton,
  EmptyTournamentState,
  InlineNotice,
  StatusLabel,
  TournamentPanel,
  TournamentSectionHeader,
} from '@/components/tournament/TournamentUI';
import { DashboardField, DashboardModal } from '@/components/shared/dashboard/DashboardUI';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/components/shared/I18nProvider';
import { SkeletonRows } from '@/components/shared/dashboard/Feedback';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import {
  AdminRequestPairing,
  entryName,
  isAwaitingDecision,
  type RequestAction,
} from './AdminRequestPairing';
import styles from './AdminRequests.module.css';

type RequestWindow = {
  categoryId: string;
  opponentRequestVersion: number;
  opponentRequestsOpenedAt: string | null;
  opponentRequestsClosedAt: string | null;
};

/**
 * A window is open once it has been opened and not closed since. The pair of
 * timestamps is the stored form; the screen needs the single boolean — and
 * showing it is what lets an administrator tell the two buttons apart.
 */
function isWindowOpen(window: RequestWindow | undefined) {
  if (!window?.opponentRequestsOpenedAt) return false;
  if (!window.opponentRequestsClosedAt) return true;
  return new Date(window.opponentRequestsClosedAt) < new Date(window.opponentRequestsOpenedAt);
}

export function AdminOpponentRequestsClient({ eventId }: { eventId: string }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const requestCopy = copy.admin.requests;
  const [event, setEvent] = useState<EventDto | null>(null);
  const [requests, setRequests] = useState<OpponentRequestDto[]>([]);
  const [windows, setWindows] = useState<RequestWindow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState<{ request: OpponentRequestDto; action: RequestAction } | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const isCompleted = event?.status === 'COMPLETED';

  const load = useCallback(async () => {
    const [eventResponse, requestResponse] = await Promise.all([
      apiFetch(`/api/events/${eventId}`, { cache: 'no-store' }),
      apiFetch(`/api/admin/events/${eventId}/opponent-requests`, { cache: 'no-store' }),
    ]);
    const eventData = await eventResponse.json() as { event?: EventDto; error?: string };
    const requestData = await requestResponse.json() as {
      requests?: OpponentRequestDto[];
      windows?: RequestWindow[];
      error?: string;
    };
    if (!eventResponse.ok || !requestResponse.ok) {
      setError(eventData.error ?? requestData.error ?? requestCopy.loadError);
    } else {
      setEvent(eventData.event ?? null);
      setRequests(requestData.requests ?? []);
      setWindows(requestData.windows ?? []);
    }
    setLoading(false);
  }, [requestCopy.loadError, eventId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function setWindow(categoryId: string, open: boolean) {
    setBusy(`window-${categoryId}`);
    setError('');
    const version = windows.find((item) => item.categoryId === categoryId)?.opponentRequestVersion ?? 0;
    const response = await apiFetch(
      `/api/admin/events/${eventId}/categories/${categoryId}/opponent-requests/${open ? 'open' : 'close'}`,
      { method: 'POST', body: JSON.stringify({ expectedVersion: version, commandId: createCommandId('request-window') }) },
    );
    const data = await response.json() as { error?: string };
    setBusy('');
    if (!response.ok) setError(data.error ?? requestCopy.windowError);
    else void load();
  }

  async function decide() {
    if (!decision) return;
    const { request, action } = decision;
    const reason = decisionReason.trim();
    if (action !== 'approve' && !reason) return;
    setBusy(`${action}-${request.id}`);
    setError('');
    const response = await apiFetch(`/api/admin/events/${eventId}/opponent-requests/${request.id}/${action}`, {
      method: 'POST',
      body: JSON.stringify({ reason, expectedVersion: request.version, commandId: createCommandId(`request-${action}`) }),
    });
    const data = await response.json() as { error?: string };
    setBusy('');
    if (!response.ok) setError(data.error ?? requestCopy.updateError);
    else {
      setDecision(null);
      setDecisionReason('');
      void load();
    }
  }

  const awaiting = requests.filter(isAwaitingDecision);
  const settled = requests.filter((request) => !isAwaitingDecision(request));

  function renderPairings(list: OpponentRequestDto[]) {
    return (
      <ul>
        {list.map((request) => (
          <AdminRequestPairing
            key={request.id}
            request={request}
            readOnly={isCompleted}
            busyAction={busy}
            onDecide={(action) => {
              setDecision({ request, action });
              setDecisionReason('');
            }}
          />
        ))}
      </ul>
    );
  }

  return (
    <AdminShell title={requestCopy.title} description={requestCopy.description} eyebrow={copy.admin.common.eyebrow}>
      <div className="mb-4"><BackLink href={`/admin/events/${eventId}`}>{copy.admin.common.eventWorkspace}</BackLink></div>
      {error ? <div className="mb-4"><InlineNotice kind="error">{error}</InlineNotice></div> : null}

      <div className="space-y-5">
        {/* Each category's window is a state with one control, not two buttons
            that give no clue which of them is currently in force. */}
        <TournamentPanel labelledBy="request-windows">
          <TournamentSectionHeader
            id="request-windows"
            title={requestCopy.windows}
            description={isCompleted ? requestCopy.readOnly : requestCopy.categoryDescription}
          />
          {event?.categories.length ? (
            <ul>
              {event.categories.map((category) => {
                const open = isWindowOpen(windows.find((item) => item.categoryId === category.id));
                return (
                  <li key={category.id} className={styles.windowRow}>
                    <div className={styles.windowText}>
                      <p className={styles.windowName}>{category.name}</p>
                      <p className={styles.windowHint}>
                        {open ? requestCopy.windowOpenHint : requestCopy.windowClosedHint}
                      </p>
                    </div>
                    <div className={styles.windowActions}>
                      <StatusLabel icon={open ? 'check' : 'dot'}>
                        {open ? requestCopy.windowOpen : requestCopy.windowClosed}
                      </StatusLabel>
                      <CommandButton
                        tone={open ? 'default' : 'primary'}
                        busy={busy === `window-${category.id}`}
                        disabled={isCompleted}
                        onClick={() => setWindow(category.id, !open)}
                      >
                        {open ? requestCopy.close : requestCopy.open}
                      </CommandButton>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyTournamentState title={loading ? copy.common.loading : requestCopy.noRequests} />
          )}
        </TournamentPanel>

        <TournamentPanel labelledBy="requests-awaiting">
          <TournamentSectionHeader
            id="requests-awaiting"
            title={requestCopy.awaiting}
            description={requestCopy.awaitingDescription}
            actions={awaiting.length ? (
              <StatusLabel icon="warning">{fillTemplate(requestCopy.count, { count: awaiting.length })}</StatusLabel>
            ) : undefined}
          />
          {awaiting.length ? renderPairings(awaiting) : loading ? (
            <SkeletonRows rows={2} label={copy.common.loading} />
          ) : (
            <EmptyTournamentState title={requestCopy.noAwaiting} detail={requestCopy.noAwaitingDetail} />
          )}
        </TournamentPanel>

        {settled.length ? (
          <TournamentPanel labelledBy="requests-settled">
            <TournamentSectionHeader
              id="requests-settled"
              title={requestCopy.settled}
              description={requestCopy.settledDescription}
              actions={<StatusLabel>{fillTemplate(requestCopy.count, { count: settled.length })}</StatusLabel>}
            />
            {renderPairings(settled)}
          </TournamentPanel>
        ) : null}
      </div>

      <DashboardModal
        open={Boolean(decision)}
        onOpenChange={(open) => { if (!open && !busy) setDecision(null); }}
        title={decision?.action === 'approve'
          ? requestCopy.approveTitle
          : decision?.action === 'reject' ? requestCopy.rejectTitle : requestCopy.overrideTitle}
        description={decision
          ? `${entryName(decision.request, 'requestingEntry')} → ${entryName(decision.request, 'targetEntry')}`
          : undefined}
        size="md"
        footer={
          <ModalFormFooter
            onCancel={() => setDecision(null)}
            cancelLabel={copy.common.cancel}
            submitType="button"
            onSubmitClick={() => { void decide(); }}
            busy={Boolean(decision && busy === `${decision.action}-${decision.request.id}`)}
            disabled={Boolean(decision && decision.action !== 'approve' && !decisionReason.trim())}
            submitLabel={decision?.action === 'approve'
              ? requestCopy.approveRequest
              : decision?.action === 'reject' ? requestCopy.rejectRequest : requestCopy.override}
            submitVariant={decision?.action === 'approve' ? 'red' : 'destructive'}
          />
        }
      >
        {decision?.action === 'approve' ? (
          <p className="text-sm leading-6 text-[rgba(88,16,16,0.72)]">{requestCopy.pairingNote}</p>
        ) : (
          <DashboardField id="decision-reason" label={requestCopy.publicReason} hint={requestCopy.publicReasonHint}>
            <Textarea id="decision-reason" value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} rows={4} />
          </DashboardField>
        )}
      </DashboardModal>
    </AdminShell>
  );
}
