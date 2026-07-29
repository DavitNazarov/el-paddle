'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DashboardField,
  DashboardModal,
  EmptyState,
  FeedbackBanner,
  FilterChip,
  formControlClassName,
  softButtonClassName,
  modalSoftButtonClassName,
} from '@/components/shared/dashboard/DashboardUI';
import { Reveal } from '@/components/padel/home/motion';
import { QueueMeter } from '@/components/shared/dashboard/DashboardSignals';
import { SkeletonCards } from '@/components/shared/dashboard/Feedback';
import { apiFetch, createCommandId } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import { AdminShell } from './AdminShell';
import { AdminRegistrationCard, isAwaitingReview } from './AdminRegistrationCard';
import { EventOrganiserPanel } from './EventOrganiserPanel';
import { CommandButton, StatusLabel, TournamentPanel, TournamentSectionHeader } from '@/components/tournament/TournamentUI';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import type { EventDto, RegistrationDto, RegistrationFilter } from '@/types/admin';

export function AdminRegistrationsClient({ eventId }: { eventId: string }) {
  const { dictionary, locale, formatDate } = useI18n();
  const admin = dictionary.dashboard.admin;
  const review = tournamentCopy[locale].admin.review;
  const copy = admin.registrationsPage;
  const [registrations, setRegistrations] = useState<RegistrationDto[]>([]);
  const [event, setEvent] = useState<EventDto | null>(null);
  const [filter, setFilter] = useState<RegistrationFilter>('PENDING');
  const [declineTarget, setDeclineTarget] = useState<RegistrationDto | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [rosterPublicationTarget, setRosterPublicationTarget] = useState<boolean | null>(null);
  const isCompleted = event?.status === 'COMPLETED';

  const counts = useMemo(
    () => ({
      pending: registrations.filter((item) => item.status === 'PENDING').length,
      approved: registrations.filter((item) => item.status === 'APPROVED').length,
      declined: registrations.filter((item) => item.status === 'DECLINED').length,
    }),
    [registrations],
  );

  const awaitingCount = useMemo(() => registrations.filter(isAwaitingReview).length, [registrations]);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return registrations;
    return registrations.filter((item) => item.status === filter);
  }, [filter, registrations]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [response, eventResponse] = await Promise.all([
      apiFetch(`/api/admin/events/${eventId}/registrations`, { cache: 'no-store' }),
      apiFetch(`/api/events/${eventId}`, { cache: 'no-store' }),
    ]);
    const data = (await response.json()) as { registrations: RegistrationDto[] };
    const eventData = await eventResponse.json() as { event?: EventDto; error?: string };
    if (!response.ok || !eventResponse.ok) {
      setError(eventData?.error ?? admin.messages.actionFailed);
      setRegistrations([]);
      setLoading(false);
      return;
    }
    setRegistrations(data.registrations ?? []);
    setEvent(eventData.event ?? null);
    setLoading(false);
  }, [admin.messages.actionFailed, eventId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (filter === 'PENDING' && counts.pending === 0 && registrations.length > 0) {
      const timer = window.setTimeout(() => setFilter('ALL'), 0);
      return () => window.clearTimeout(timer);
    }
  }, [counts.pending, filter, registrations.length]);

  async function setRegistrationStatus(
    registration: RegistrationDto,
    status: RegistrationDto['status'],
    reason = '',
  ) {
    if (status === 'DECLINED' && !reason.trim()) {
      setDeclineTarget(registration);
      setDeclineReason('');
      return;
    }

    setError('');
    setMessage('');
    setBusy(registration.id);
    const response = await apiFetch(
      `/api/admin/events/${eventId}/registrations/${registration.id}/status`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          status,
          publicReason: reason.trim(),
          expectedVersion: registration.version,
          commandId: createCommandId('registration-status'),
        }),
      },
    );
    const result = (await response.json()) as { error?: string };
    setBusy(null);
    if (!response.ok) {
      setError(result.error ?? admin.messages.registrationUpdateFailed);
      return;
    }
    setDeclineTarget(null);
    setDeclineReason('');
    setMessage(admin.messages.registrationUpdated);
    await load();
  }

  async function updateRosterPublication(published: boolean) {
    if (!event) return;
    setError('');
    setMessage('');
    setBusy('roster-publication');
    const response = await apiFetch(`/api/admin/events/${eventId}/registration-roster-publication`, {
      method: 'PATCH',
      body: JSON.stringify({
        published,
        expectedVersion: event.version,
        commandId: createCommandId('registration-roster-publication'),
      }),
    });
    const result = await response.json() as { event?: EventDto; error?: string };
    setBusy(null);
    if (!response.ok) {
      setError(result.error ?? copy.rosterUpdateFailed);
      return;
    }
    setEvent(result.event ?? event);
    setRosterPublicationTarget(null);
    setMessage(published ? copy.rosterPublishedMessage : copy.rosterUnpublishedMessage);
  }

  return (
    <AdminShell
      title={event ? `${copy.title} — ${event.title}` : copy.title}
      description={event ? `${formatDate(event.date, { dateStyle: 'medium', timeStyle: 'short' })} · ${event.location}` : copy.description}
      eyebrow={copy.eyebrow}
    >
      <Button asChild variant="outline" className={cn(softButtonClassName, 'mb-6 rounded-md')}>
        <Link href="/admin/registrations">
          <ArrowLeft className="h-4 w-4" />
          {copy.allRegistrations}
        </Link>
      </Button>
      {message ? <FeedbackBanner kind="success">{message}</FeedbackBanner> : null}
      {error ? <FeedbackBanner kind="error">{error}</FeedbackBanner> : null}
      {isCompleted ? <FeedbackBanner kind="success">{review.readOnly}</FeedbackBanner> : null}

      {/* Approving the entries is the point at which an event is ready to hand over. */}
      {eventId ? (
        <div className="mb-6">
          <EventOrganiserPanel eventId={eventId} />
        </div>
      ) : null}

      {event ? (
        <TournamentPanel className="mb-6">
          <TournamentSectionHeader
            title={copy.rosterTitle}
            description={copy.rosterDescription}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <StatusLabel icon={event.registrationRosterPublishedAt ? 'check' : 'dot'}>
                  {event.registrationRosterPublishedAt ? copy.rosterPublished : copy.rosterPrivate}
                </StatusLabel>
                <CommandButton
                  tone={event.registrationRosterPublishedAt ? 'default' : 'primary'}
                  busy={busy === 'roster-publication'}
                  disabled={!event.registrationRosterPublishedAt && counts.approved === 0}
                  onClick={() => setRosterPublicationTarget(!event.registrationRosterPublishedAt)}
                >
                  {event.registrationRosterPublishedAt ? copy.unpublishRoster : copy.publishRoster}
                </CommandButton>
              </div>
            }
          />
          {!event.registrationRosterPublishedAt && counts.approved === 0 ? (
            <p className="px-5 py-4 text-sm leading-6 text-[rgba(213,201,177,0.65)]">{copy.noApprovedRoster}</p>
          ) : null}
        </TournamentPanel>
      ) : null}

      {/* A reviewer wants to know how much of the queue is left, not just how
          many entries exist. The meter counts entries that have a decision. */}
      {registrations.length ? (
        <div className="mb-6 rounded-xl border border-[var(--dash-border)] bg-white px-5 py-4">
          <QueueMeter
            label={review.progress}
            done={registrations.length - awaitingCount}
            total={registrations.length}
            valueLabel={awaitingCount === 0
              ? review.queueClear
              : fillTemplate(review.decided, { done: registrations.length - awaitingCount, total: registrations.length })}
          />
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-2">
        <FilterChip active={filter === 'ALL'} count={registrations.length} onClick={() => setFilter('ALL')}>
          {admin.registrations.filterAll}
        </FilterChip>
        <FilterChip active={filter === 'PENDING'} count={counts.pending} onClick={() => setFilter('PENDING')}>
          {admin.registrations.filterPending}
        </FilterChip>
        <FilterChip active={filter === 'APPROVED'} count={counts.approved} onClick={() => setFilter('APPROVED')}>
          {admin.registrations.filterApproved}
        </FilterChip>
        <FilterChip active={filter === 'DECLINED'} count={counts.declined} onClick={() => setFilter('DECLINED')}>
          {admin.registrations.filterDeclined}
        </FilterChip>
      </div>

      {loading ? (
        <SkeletonCards count={3} columns={2} label={admin.registrations.loading} />
      ) : !registrations.length ? (
        <EmptyState title={admin.registrations.emptyTitle} description={admin.registrations.emptyDescription} icon={ClipboardList} />
      ) : !filtered.length ? (
        <EmptyState
          title={admin.registrations.emptyFilterTitle}
          description={admin.registrations.emptyFilterDescription}
          icon={ClipboardList}
          action={
            <Button variant="outline" className={cn(softButtonClassName, 'rounded-md')} onClick={() => setFilter('ALL')}>
              {admin.registrations.filterAll}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4">
          {filtered.map((registration, index) => (
            <Reveal key={registration.id} delay={Math.min(index * 0.04, 0.2)}>
              <AdminRegistrationCard
                registration={registration}
                readOnly={isCompleted}
                busy={busy === registration.id}
                onReview={(status) => { void setRegistrationStatus(registration, status); }}
              />
            </Reveal>
          ))}
        </div>
      )}

      <DashboardModal
        open={rosterPublicationTarget !== null}
        onOpenChange={(open) => { if (!open && busy !== 'roster-publication') setRosterPublicationTarget(null); }}
        title={rosterPublicationTarget ? copy.publishRosterTitle : copy.unpublishRosterTitle}
        description={rosterPublicationTarget ? copy.publishRosterDescription : copy.unpublishRosterDescription}
        size="md"
        footer={
          <ModalFormFooter
            onCancel={() => setRosterPublicationTarget(null)}
            cancelLabel={admin.messages.declineCancel}
            submitType="button"
            onSubmitClick={() => { if (rosterPublicationTarget !== null) void updateRosterPublication(rosterPublicationTarget); }}
            busy={busy === 'roster-publication'}
            submitLabel={busy === 'roster-publication' ? admin.messages.saving : rosterPublicationTarget ? copy.publishRoster : copy.unpublishRoster}
            submitVariant={rosterPublicationTarget ? 'red' : 'outline'}
          />
        }
      >
        <p className="rounded-lg border border-[rgba(88,16,16,0.12)] bg-white/55 p-4 text-sm leading-6 text-[rgba(88,16,16,0.72)]">
          {fillTemplate(review.approvedTeams, { count: counts.approved })}
        </p>
      </DashboardModal>

      <DashboardModal
        open={Boolean(declineTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeclineTarget(null);
            setDeclineReason('');
          }
        }}
        title={copy.declineTitle}
        description={
          declineTarget
            ? `${copy.declineDescription} · ${declineTarget.event.title}`
            : copy.declineDescription
        }
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              className={modalSoftButtonClassName}
              onClick={() => {
                setDeclineTarget(null);
                setDeclineReason('');
              }}
            >
              {admin.messages.declineCancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isCompleted || !declineTarget || !declineReason.trim() || busy === declineTarget.id}
              onClick={() => {
                if (!declineTarget) return;
                void setRegistrationStatus(declineTarget, 'DECLINED', declineReason);
              }}
            >
              {busy === declineTarget?.id ? admin.messages.saving : admin.messages.declineConfirm}
            </Button>
          </>
        }
      >
        <DashboardField label={admin.messages.declineReason} id="decline-reason">
          <Textarea
            id="decline-reason"
            autoFocus
            value={declineReason}
            onChange={(event) => setDeclineReason(event.target.value)}
            placeholder={admin.messages.declineReasonPlaceholder}
            className={formControlClassName}
          />
        </DashboardField>
      </DashboardModal>
    </AdminShell>
  );
}
