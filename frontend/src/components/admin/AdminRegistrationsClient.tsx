'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Building2, ClipboardList, Mail, Phone, UserCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DashboardField,
  DashboardModal,
  EmptyState,
  FeedbackBanner,
  FilterChip,
  RegistrationStatusBadge,
  SurfaceCard,
  formControlClassName,
  softButtonClassName,
  modalSoftButtonClassName,
} from '@/components/shared/dashboard/DashboardUI';
import { Reveal } from '@/components/padel/home/motion';
import { apiFetch, createCommandId } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/shared/I18nProvider';
import { AdminShell } from './AdminShell';
import { CommandButton, StatusLabel, TournamentPanel, TournamentSectionHeader } from '@/components/tournament/TournamentUI';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import type { EventDto, RegistrationDto, RegistrationFilter } from '@/types/admin';

const reviewTransitions: Partial<Record<RegistrationDto['status'], RegistrationDto['status'][]>> = {
  PENDING: ['APPROVED', 'DECLINED'],
  APPROVED: ['DECLINED'],
  NEEDS_CHANGES: ['PENDING', 'APPROVED', 'DECLINED'],
  WAITLISTED: ['APPROVED', 'DECLINED'],
};

function canReviewAs(registration: RegistrationDto, status: RegistrationDto['status']) {
  return reviewTransitions[registration.status]?.includes(status) ?? false;
}

export function AdminRegistrationsClient({ eventId }: { eventId: string }) {
  const { dictionary, t, formatDate } = useI18n();
  const admin = dictionary.dashboard.admin;
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
      {isCompleted ? <FeedbackBanner kind="success">This completed event is read-only. Reopen it to change registrations.</FeedbackBanner> : null}

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
        <EmptyState title={admin.registrations.loading} icon={ClipboardList} />
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
          {filtered.map((registration, index) => {
            const actionBusy = busy === registration.id;
            return (
              <Reveal key={registration.id} delay={Math.min(index * 0.04, 0.2)}>
                <SurfaceCard>
                  <div className="grid gap-4 p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <RegistrationStatusBadge status={registration.status} />
                        <Badge className="border-[rgba(213,201,177,0.18)] bg-transparent text-[rgba(213,201,177,0.7)]">
                          {registration.category.name}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        <Button
                          variant="red"
                          className="rounded-md"
                          disabled={isCompleted || actionBusy || !canReviewAs(registration, 'APPROVED')}
                          onClick={() => setRegistrationStatus(registration, 'APPROVED')}
                        >
                          <UserCheck className="h-4 w-4" />
                          {admin.registrations.approve}
                        </Button>
                        <Button
                          variant="destructive"
                          className="rounded-md"
                          disabled={isCompleted || actionBusy || !canReviewAs(registration, 'DECLINED')}
                          onClick={() => setRegistrationStatus(registration, 'DECLINED')}
                        >
                          {admin.registrations.decline}
                        </Button>
                        <Button
                          variant="outline"
                          className={cn(softButtonClassName, 'rounded-md')}
                          disabled={isCompleted || actionBusy || !canReviewAs(registration, 'PENDING')}
                          onClick={() => setRegistrationStatus(registration, 'PENDING')}
                        >
                          {admin.registrations.pending}
                        </Button>
                      </div>
                    </div>

                    <div className="grid divide-y divide-[rgba(213,201,177,0.1)] overflow-hidden rounded-xl border border-[rgba(213,201,177,0.1)] bg-[rgba(213,201,177,0.04)] md:grid-cols-2 md:divide-x md:divide-y-0">
                      <TeamBlock title={copy.playerOne} name={registration.owner.fullName} email={registration.owner.email} phone={registration.ownerPhone} club={registration.owner.club?.name ?? copy.noClub} />
                      <TeamBlock
                        title={copy.playerTwo}
                        name={registration.teammate.fullName}
                        email={registration.teammate.email}
                        phone={registration.teammatePhone || admin.registrations.noTeammatePhone}
                        club={registration.teammate.club?.name ?? copy.noClub}
                      />
                    </div>

                    {registration.declineReason ? (
                      <p className="rounded-xl border border-[var(--padel-ember)]/30 bg-[var(--padel-ember)]/10 px-3 py-2 text-sm text-[var(--padel-gold-2)]">
                        {t('dashboard.admin.registrations.reason', { reason: registration.declineReason })}
                      </p>
                    ) : null}
                  </div>
                </SurfaceCard>
              </Reveal>
            );
          })}
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
          {counts.approved} {counts.approved === 1 ? 'approved team' : 'approved teams'}
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

function TeamBlock({
  title,
  name,
  email,
  phone,
  club,
}: {
  title: string;
  name: string;
  email: string;
  phone: string;
  club: string;
}) {
  return (
    <div className="min-w-0 p-4 sm:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--padel-gold)]">{title}</p>
      <p className="mt-2 text-lg font-semibold leading-tight text-[var(--padel-ivory)]">{name}</p>
      <div className="mt-3 grid gap-1.5 text-sm text-[rgba(213,201,177,0.62)]">
        <p className="flex min-w-0 items-center gap-2">
          <Mail aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[rgba(213,201,177,0.42)]" />
          <span className="truncate">{email}</span>
        </p>
        <p className="flex min-w-0 items-center gap-2">
          <Phone aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[rgba(213,201,177,0.42)]" />
          <span className="truncate">{phone}</span>
        </p>
        <p className="flex min-w-0 items-center gap-2 font-medium text-[var(--padel-gold)]">
          <Building2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{club}</span>
        </p>
      </div>
    </div>
  );
}
