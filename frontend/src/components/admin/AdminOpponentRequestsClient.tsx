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
} from '@/components/tournament/TournamentUI';
import { DashboardField, DashboardModal } from '@/components/shared/dashboard/DashboardUI';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/components/shared/I18nProvider';
import { SkeletonRows } from '@/components/shared/dashboard/Feedback';
import { pushToast } from '@/components/shared/Toasts';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import {
  AdminRequestPairing,
  canReleasePairing,
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

/**
 * The pairing queue.
 *
 * Two things happen here and they are not equal: opening a category's window is
 * a setting changed once, and deciding on a pairing is the work. So the windows
 * are a compact strip at the top and the decisions are the page. Settled
 * requests are kept — they are the record of why a pairing exists — but folded
 * away, because nothing in them is waiting.
 */
export function AdminOpponentRequestsClient({ eventId }: { eventId: string }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const requestCopy = copy.admin.requests;
  const shared = copy.admin.common;

  const [event, setEvent] = useState<EventDto | null>(null);
  const [requests, setRequests] = useState<OpponentRequestDto[]>([]);
  const [windows, setWindows] = useState<RequestWindow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState<{ request: OpponentRequestDto; action: RequestAction } | null>(null);
  const [reason, setReason] = useState('');
  const isCompleted = event?.status === 'COMPLETED';

  const load = useCallback(async () => {
    try {
      const [eventResponse, requestResponse] = await Promise.all([
        apiFetch(`/api/events/${eventId}`, { cache: 'no-store' }),
        apiFetch(`/api/admin/events/${eventId}/opponent-requests`, { cache: 'no-store' }),
      ]);
      const eventData = await eventResponse.json().catch(() => ({})) as { event?: EventDto; error?: string };
      const requestData = await requestResponse.json().catch(() => ({})) as {
        requests?: OpponentRequestDto[];
        windows?: RequestWindow[];
        error?: string;
      };
      if (!eventResponse.ok || !requestResponse.ok) {
        setError(eventData.error ?? requestData.error ?? requestCopy.loadError);
        return;
      }
      setEvent(eventData.event ?? null);
      setRequests(requestData.requests ?? []);
      setWindows(requestData.windows ?? []);
      setError('');
    } catch {
      setError(requestCopy.loadError);
    } finally {
      setLoading(false);
    }
  }, [eventId, requestCopy.loadError]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  /**
   * Both commands report over the screen. A decision is confirmed in a dialog,
   * and a window is toggled from a strip that scrolls out of view behind a long
   * queue — neither reader is looking at the top of the page afterwards.
   */
  const send = useCallback(async (key: string, path: string, body: unknown, failure: string, success: string) => {
    setBusy(key);
    try {
      const response = await apiFetch(path, { method: 'POST', body: JSON.stringify(body) });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        pushToast({ tone: 'error', title: failure, message: data.error ?? shared.commandFailed });
        return false;
      }
      pushToast({ tone: 'success', message: success });
      return true;
    } catch {
      pushToast({ tone: 'error', title: failure, message: shared.offline });
      return false;
    } finally {
      setBusy('');
    }
  }, [shared.commandFailed, shared.offline]);

  async function setWindow(categoryId: string, categoryName: string, open: boolean) {
    const version = windows.find((item) => item.categoryId === categoryId)?.opponentRequestVersion ?? 0;
    const ok = await send(
      `window-${categoryId}`,
      `/api/admin/events/${eventId}/categories/${categoryId}/opponent-requests/${open ? 'open' : 'close'}`,
      { expectedVersion: version, commandId: createCommandId('request-window') },
      requestCopy.windowError,
      fillTemplate(open ? requestCopy.windowOpened : requestCopy.windowClosed2, { category: categoryName }),
    );
    if (ok) await load();
  }

  async function decide() {
    if (!decision) return;
    const { request, action } = decision;
    const trimmed = reason.trim();
    if (action !== 'approve' && !trimmed) return;
    const a = entryName(request, 'requestingEntry');
    const b = entryName(request, 'targetEntry');
    const releasing = action === 'reject' && canReleasePairing(request);
    const wording = action === 'approve'
      ? requestCopy.approved
      : action === 'override-refusal'
        ? requestCopy.overridden
        : releasing
          ? requestCopy.released
          : requestCopy.rejected;

    const ok = await send(
      `${action}-${request.id}`,
      `/api/admin/events/${eventId}/opponent-requests/${request.id}/${action}`,
      { reason: trimmed, expectedVersion: request.version, commandId: createCommandId(`request-${action}`) },
      requestCopy.updateError,
      fillTemplate(wording, { a, b }),
    );
    if (!ok) return;
    setDecision(null);
    setReason('');
    await load();
  }

  const releasing = Boolean(decision && decision.action === 'reject' && canReleasePairing(decision.request));
  const awaiting = requests.filter(isAwaitingDecision);
  const settled = requests.filter((request) => !isAwaitingDecision(request));
  const categories = event?.categories ?? [];
  // Windows only exist once the field is fixed; before that the server refuses.
  const windowsAvailable = event ? event.status !== 'REGISTRATION_OPEN' : false;

  const dialogTitle = decision?.action === 'approve'
    ? requestCopy.approveTitle
    : decision?.action === 'override-refusal'
      ? requestCopy.overrideTitle
      : releasing
        ? requestCopy.releaseTitle
        : requestCopy.rejectTitle;

  const dialogBody = decision?.action === 'approve'
    ? requestCopy.approveBody
    : decision?.action === 'override-refusal'
      ? requestCopy.overrideBody
      : releasing
        ? requestCopy.releaseBody
        : null;

  return (
    <AdminShell title={requestCopy.title} description={requestCopy.description} eyebrow={shared.eyebrow}>
      <div className="mb-4"><BackLink href={`/admin/events/${eventId}`}>{shared.eventWorkspace}</BackLink></div>

      {error ? <div className="mb-4"><InlineNotice kind="error" onDismiss={() => setError('')}>{error}</InlineNotice></div> : null}
      {isCompleted ? <div className="mb-4"><InlineNotice kind="info">{requestCopy.readOnly}</InlineNotice></div> : null}

      <section className={styles.header}>
        <p className={styles.headerState}>
          {awaiting.length === 0
            ? requestCopy.queueClear
            : awaiting.length === 1
              ? requestCopy.queueWaitingOne
              : fillTemplate(requestCopy.queueWaiting, { count: awaiting.length })}
        </p>

        <div className={styles.windows}>
          <div className={styles.windowsHead}>
            <h2 className={styles.windowsTitle}>{requestCopy.windows}</h2>
            <p className={styles.windowsHint}>
              {windowsAvailable ? requestCopy.windowsHint : requestCopy.windowsBeforeClose}
            </p>
          </div>
          {categories.length ? (
            <ul className={styles.windowList}>
              {categories.map((category) => {
                const open = isWindowOpen(windows.find((item) => item.categoryId === category.id));
                return (
                  <li key={category.id} className={styles.windowRow}>
                    <span className={styles.windowState} data-open={open}>
                      <span className={styles.windowDot} aria-hidden="true" />
                      {open ? requestCopy.windowOpen : requestCopy.windowClosed}
                    </span>
                    <span className={styles.windowName}>{category.name}</span>
                    <CommandButton
                      className={styles.windowAction}
                      tone={open ? 'default' : 'primary'}
                      busy={busy === `window-${category.id}`}
                      disabled={isCompleted || !windowsAvailable}
                      onClick={() => { void setWindow(category.id, category.name, !open); }}
                    >
                      {open ? requestCopy.close : requestCopy.open}
                    </CommandButton>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={styles.windowsEmpty}>{requestCopy.noCategories}</p>
          )}
        </div>
      </section>

      {loading && !requests.length ? (
        <SkeletonRows rows={3} label={requestCopy.loading} />
      ) : awaiting.length ? (
        <section className={styles.queuePanel} aria-labelledby="requests-awaiting">
          <h2 id="requests-awaiting" className={styles.queueTitle}>{requestCopy.awaiting}</h2>
          <ul className={styles.queue}>
            {awaiting.map((request) => (
              <AdminRequestPairing
                key={request.id}
                request={request}
                readOnly={isCompleted}
                busyAction={busy}
                onDecide={(action) => { setDecision({ request, action }); setReason(''); }}
              />
            ))}
          </ul>
        </section>
      ) : (
        <EmptyTournamentState
          title={requests.length ? requestCopy.noAwaiting : requestCopy.noRequests}
          detail={requests.length ? requestCopy.noAwaitingDetail : requestCopy.noRequestsDetail}
        />
      )}

      {settled.length ? (
        <details className={styles.settled}>
          <summary className={styles.settledSummary}>
            {requestCopy.settled}
            <span className={styles.settledCount}>{fillTemplate(requestCopy.settledCount, { count: settled.length })}</span>
          </summary>
          <ul className={styles.queue}>
            {settled.map((request) => (
              <AdminRequestPairing
                key={request.id}
                request={request}
                readOnly={isCompleted}
                busyAction={busy}
                onDecide={(action) => { setDecision({ request, action }); setReason(''); }}
              />
            ))}
          </ul>
        </details>
      ) : null}

      <DashboardModal
        open={Boolean(decision)}
        onOpenChange={(open) => { if (!open && !busy) { setDecision(null); setReason(''); } }}
        title={dialogTitle}
        description={decision
          ? `${entryName(decision.request, 'requestingEntry')} → ${entryName(decision.request, 'targetEntry')}`
          : undefined}
        size="md"
        footer={
          <ModalFormFooter
            onCancel={() => { setDecision(null); setReason(''); }}
            cancelLabel={copy.common.cancel}
            submitType="button"
            onSubmitClick={() => { void decide(); }}
            busy={Boolean(decision && busy === `${decision.action}-${decision.request.id}`)}
            disabled={Boolean(decision && decision.action !== 'approve' && !reason.trim())}
            submitLabel={decision?.action === 'approve'
              ? requestCopy.approve
              : decision?.action === 'override-refusal'
                ? requestCopy.override
                : releasing
                  ? requestCopy.release
                  : requestCopy.reject}
            submitVariant={decision?.action === 'approve' ? 'red' : 'destructive'}
          />
        }
      >
        {dialogBody ? <p className={styles.dialogBody}>{dialogBody}</p> : null}
        {decision && decision.action !== 'approve' ? (
          <DashboardField id="decision-reason" label={requestCopy.publicReason} hint={requestCopy.publicReasonHint}>
            <Textarea
              id="decision-reason"
              autoFocus
              rows={4}
              value={reason}
              onChange={(fieldEvent) => setReason(fieldEvent.target.value)}
            />
          </DashboardField>
        ) : null}
      </DashboardModal>
    </AdminShell>
  );
}
