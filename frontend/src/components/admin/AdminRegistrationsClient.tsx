'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import {
  DashboardField,
  DashboardModal,
  FilterChip,
  formControlClassName,
} from '@/components/shared/dashboard/DashboardUI';
import { SkeletonRows } from '@/components/shared/dashboard/Feedback';
import { pushToast } from '@/components/shared/Toasts';
import { API_BASE_URL, apiFetch, createCommandId } from '@/lib/api';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import { AdminShell } from './AdminShell';
import { AdminRegistrationCard, isAwaitingReview, teamName } from './AdminRegistrationCard';
import {
  BackLink,
  CommandButton,
  EmptyTournamentState,
  InlineNotice,
} from '@/components/tournament/TournamentUI';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import type { EventDto, RegistrationDto, RegistrationFilter } from '@/types/admin';
import styles from './AdminReview.module.css';

/**
 * The entry queue.
 *
 * One job: decide on the teams that entered. The screen used to open with three
 * banners, an organiser panel, a publication panel, a progress meter and only
 * then the entries — five things above the work. Now the header states the two
 * facts a reviewer needs (how much is left, and whether the list is public), the
 * filters carry the counts, and everything below is the queue itself.
 */
export function AdminRegistrationsClient({ eventId }: { eventId: string }) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale];
  const review = copy.admin.review;
  const shared = copy.admin.common;

  const [registrations, setRegistrations] = useState<RegistrationDto[]>([]);
  const [event, setEvent] = useState<EventDto | null>(null);
  const [filter, setFilter] = useState<RegistrationFilter>('PENDING');
  const [declineTarget, setDeclineTarget] = useState<RegistrationDto | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [rosterTarget, setRosterTarget] = useState<boolean | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const isCompleted = event?.status === 'COMPLETED';

  const counts = useMemo(
    () => ({
      pending: registrations.filter((item) => item.status === 'PENDING').length,
      approved: registrations.filter((item) => item.status === 'APPROVED').length,
      declined: registrations.filter((item) => item.status === 'DECLINED').length,
    }),
    [registrations],
  );

  const awaiting = useMemo(() => registrations.filter(isAwaitingReview).length, [registrations]);
  const filtered = useMemo(
    () => (filter === 'ALL' ? registrations : registrations.filter((item) => item.status === filter)),
    [filter, registrations],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [response, eventResponse] = await Promise.all([
        apiFetch(`/api/admin/events/${eventId}/registrations`, { cache: 'no-store' }),
        apiFetch(`/api/events/${eventId}`, { cache: 'no-store' }),
      ]);
      const data = await response.json().catch(() => ({})) as { registrations?: RegistrationDto[]; error?: string };
      const eventData = await eventResponse.json().catch(() => ({})) as { event?: EventDto; error?: string };
      if (!response.ok || !eventResponse.ok) {
        setError(data.error ?? eventData.error ?? review.loadError);
        return;
      }
      setRegistrations(data.registrations ?? []);
      setEvent(eventData.event ?? null);
      setError('');
    } catch {
      setError(review.loadError);
    } finally {
      setLoading(false);
    }
  }, [eventId, review.loadError]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  // Once the queue is empty the filter would show an empty screen over a full
  // list, so it falls back to everything rather than looking broken.
  useEffect(() => {
    if (filter === 'PENDING' && counts.pending === 0 && registrations.length > 0) {
      const timer = window.setTimeout(() => setFilter('ALL'), 0);
      return () => window.clearTimeout(timer);
    }
  }, [counts.pending, filter, registrations.length]);

  /**
   * Decisions are reported over the screen, not on it: the decline reason is
   * typed in a dialog, and an approval is sent from a row that may be far down a
   * long queue. Both name the team, so an outcome is checkable at a glance.
   */
  const send = useCallback(async (
    key: string,
    path: string,
    body: unknown,
    failure: string,
    success: string,
  ) => {
    setBusy(key);
    try {
      const response = await apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) });
      const data = await response.json().catch(() => ({})) as { event?: EventDto; error?: string };
      if (!response.ok) {
        pushToast({ tone: 'error', title: failure, message: data.error ?? shared.commandFailed });
        return null;
      }
      pushToast({ tone: 'success', message: success });
      return data;
    } catch {
      pushToast({ tone: 'error', title: failure, message: shared.offline });
      return null;
    } finally {
      setBusy(null);
    }
  }, [shared.commandFailed, shared.offline]);

  async function decide(registration: RegistrationDto, status: RegistrationDto['status'], reason = '') {
    if (status === 'DECLINED' && !reason.trim()) {
      setDeclineTarget(registration);
      setDeclineReason('');
      return;
    }
    const team = teamName(registration, review.pairSeparator);
    const wording = status === 'APPROVED' ? review.approved : status === 'DECLINED' ? review.declined : review.returned;
    const result = await send(
      registration.id,
      `/api/admin/events/${eventId}/registrations/${registration.id}/status`,
      {
        status,
        publicReason: reason.trim(),
        expectedVersion: registration.version,
        commandId: createCommandId('registration-status'),
      },
      review.decisionError,
      fillTemplate(wording, { team }),
    );
    if (!result) return;
    setDeclineTarget(null);
    setDeclineReason('');
    await load();
  }

  /**
   * Approving the queue in one command.
   *
   * The repetitive case is real: a 32-team event is 32 identical approvals, each
   * its own round trip and its own version check. The server decides them one at
   * a time and reports which ones it could not, so a single refusal in the
   * middle does not silently undo the ones before it — and the toast says how
   * many landed rather than claiming they all did.
   */
  async function approveAllPending() {
    const pending = registrations.filter((registration) => registration.status === 'PENDING');
    if (!pending.length) return;
    setBusy('bulk');
    try {
      const response = await apiFetch(`/api/admin/events/${eventId}/registrations/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          registrationIds: pending.map((registration) => registration.id),
          status: 'APPROVED',
          commandId: createCommandId('registration-status-batch'),
        }),
      });
      const data = await response.json().catch(() => ({})) as { applied?: number; total?: number; error?: string };
      if (!response.ok) {
        pushToast({ tone: 'error', title: review.decisionError, message: data.error ?? shared.commandFailed });
        return;
      }
      const applied = data.applied ?? 0;
      const total = data.total ?? pending.length;
      pushToast({
        tone: applied === total ? 'success' : 'error',
        message: applied === total
          ? fillTemplate(review.bulkApproved, { count: applied })
          : fillTemplate(review.bulkPartial, { applied, total }),
      });
      setBulkOpen(false);
      await load();
    } catch {
      pushToast({ tone: 'error', title: review.decisionError, message: shared.offline });
    } finally {
      setBusy(null);
    }
  }

  /** The entry list as a file — the desk copy an organiser checks players in from. */
  function exportEntries() {
    window.open(`${API_BASE_URL}/api/admin/events/${eventId}/registrations?format=csv`, '_blank', 'noopener');
  }

  async function setRosterPublished(published: boolean) {
    if (!event) return;
    const result = await send(
      'roster',
      `/api/admin/events/${eventId}/registration-roster-publication`,
      {
        published,
        expectedVersion: event.version,
        commandId: createCommandId('registration-roster-publication'),
      },
      review.rosterError,
      published ? review.rosterPublished : review.rosterHidden,
    );
    if (!result) return;
    setEvent(result.event ?? event);
    setRosterTarget(null);
  }

  const rosterPublic = Boolean(event?.registrationRosterPublishedAt);
  const canPublishRoster = rosterPublic || counts.approved > 0;

  return (
    <AdminShell
      title={review.title}
      description={event
        ? `${event.title} · ${formatDate(event.date, { dateStyle: 'medium', timeStyle: 'short' })}`
        : review.description}
      eyebrow={shared.eyebrow}
    >
      <div className="mb-4">
        <BackLink href={`/admin/events/${eventId}`}>{shared.eventWorkspace}</BackLink>
      </div>

      {/* Only a failure to load stays on the page. Decisions go to the message layer. */}
      {error ? <div className="mb-4"><InlineNotice kind="error" onDismiss={() => setError('')}>{error}</InlineNotice></div> : null}
      {isCompleted ? <div className="mb-4"><InlineNotice kind="info">{review.readOnly}</InlineNotice></div> : null}

      <section className={styles.header}>
        <div className={styles.headerText}>
          <p className={styles.headerState}>
            {awaiting === 0
              ? review.queueClear
              : fillTemplate(review.decided, { done: registrations.length - awaiting, total: registrations.length })}
          </p>
          <p className={styles.headerHint}>{rosterPublic ? review.rosterPublic : review.rosterPrivate}</p>
        </div>
        <div className={styles.headerActions}>
          <CommandButton disabled={!registrations.length} onClick={exportEntries}>
            {review.exportEntries}
          </CommandButton>
          {isCompleted ? null : (
            <>
              {/* Only offered while there is a queue to clear — a bulk command
                  with nothing to act on is a button that does nothing. */}
              {counts.pending > 0 ? (
                <CommandButton busy={busy === 'bulk'} onClick={() => setBulkOpen(true)}>
                  {fillTemplate(review.approveAll, { count: counts.pending })}
                </CommandButton>
              ) : null}
              <CommandButton
                tone={rosterPublic ? 'default' : 'primary'}
                busy={busy === 'roster'}
                disabled={!canPublishRoster}
                onClick={() => setRosterTarget(!rosterPublic)}
              >
                {rosterPublic ? review.hideRoster : review.publishRoster}
              </CommandButton>
            </>
          )}
        </div>
      </section>

      {!rosterPublic && counts.approved === 0 && registrations.length > 0 ? (
        <p className={styles.headerNote}>{review.rosterNeedsApproval}</p>
      ) : null}

      <div className={styles.filters}>
        <FilterChip active={filter === 'ALL'} count={registrations.length} onClick={() => setFilter('ALL')}>
          {review.filterAll}
        </FilterChip>
        <FilterChip active={filter === 'PENDING'} count={counts.pending} onClick={() => setFilter('PENDING')}>
          {review.filterPending}
        </FilterChip>
        <FilterChip active={filter === 'APPROVED'} count={counts.approved} onClick={() => setFilter('APPROVED')}>
          {review.filterApproved}
        </FilterChip>
        <FilterChip active={filter === 'DECLINED'} count={counts.declined} onClick={() => setFilter('DECLINED')}>
          {review.filterDeclined}
        </FilterChip>
      </div>

      {loading && !registrations.length ? (
        <SkeletonRows rows={4} label={review.loading} />
      ) : !registrations.length ? (
        <EmptyTournamentState title={review.emptyTitle} detail={review.emptyDetail} />
      ) : !filtered.length ? (
        <EmptyTournamentState
          title={review.emptyFilterTitle}
          detail={review.emptyFilterDetail}
          action={<CommandButton onClick={() => setFilter('ALL')}>{review.showAll}</CommandButton>}
        />
      ) : (
        <ul className={styles.queue}>
          {filtered.map((registration) => (
            <AdminRegistrationCard
              key={registration.id}
              registration={registration}
              readOnly={isCompleted}
              busy={busy === registration.id}
              onReview={(status) => { void decide(registration, status); }}
            />
          ))}
        </ul>
      )}

      <DashboardModal
        open={bulkOpen}
        onOpenChange={(open) => { if (!open && busy !== 'bulk') setBulkOpen(false); }}
        title={fillTemplate(review.approveAllTitle, { count: counts.pending })}
        size="md"
        footer={
          <ModalFormFooter
            onCancel={() => setBulkOpen(false)}
            cancelLabel={copy.common.cancel}
            submitType="button"
            onSubmitClick={() => { void approveAllPending(); }}
            busy={busy === 'bulk'}
            submitLabel={fillTemplate(review.approveAll, { count: counts.pending })}
            submitVariant="red"
          />
        }
      >
        <p className={styles.dialogBody}>{review.approveAllBody}</p>
      </DashboardModal>

      <DashboardModal
        open={rosterTarget !== null}
        onOpenChange={(open) => { if (!open && busy !== 'roster') setRosterTarget(null); }}
        title={rosterTarget ? review.rosterPublishTitle : review.rosterHideTitle}
        size="md"
        footer={
          <ModalFormFooter
            onCancel={() => setRosterTarget(null)}
            cancelLabel={copy.common.cancel}
            submitType="button"
            onSubmitClick={() => { if (rosterTarget !== null) void setRosterPublished(rosterTarget); }}
            busy={busy === 'roster'}
            submitLabel={rosterTarget ? review.publishRoster : review.hideRoster}
            submitVariant={rosterTarget ? 'red' : 'outline'}
          />
        }
      >
        <p className={styles.dialogBody}>
          {rosterTarget
            ? fillTemplate(review.rosterPublishBody, { count: counts.approved })
            : review.rosterHideBody}
        </p>
      </DashboardModal>

      <DashboardModal
        open={Boolean(declineTarget)}
        onOpenChange={(open) => { if (!open) { setDeclineTarget(null); setDeclineReason(''); } }}
        title={review.declineTitle}
        description={declineTarget ? teamName(declineTarget, review.pairSeparator) : undefined}
        size="md"
        footer={
          <ModalFormFooter
            onCancel={() => { setDeclineTarget(null); setDeclineReason(''); }}
            cancelLabel={copy.common.cancel}
            submitType="button"
            onSubmitClick={() => { if (declineTarget) void decide(declineTarget, 'DECLINED', declineReason); }}
            busy={Boolean(declineTarget && busy === declineTarget.id)}
            disabled={isCompleted || !declineReason.trim()}
            submitLabel={review.declineSubmit}
            submitVariant="destructive"
          />
        }
      >
        <DashboardField label={review.declineReason} id="decline-reason" hint={review.declineDescription}>
          <Textarea
            id="decline-reason"
            autoFocus
            rows={4}
            value={declineReason}
            onChange={(fieldEvent) => setDeclineReason(fieldEvent.target.value)}
            placeholder={review.declineReasonPlaceholder}
            className={formControlClassName}
          />
        </DashboardField>
      </DashboardModal>
    </AdminShell>
  );
}
