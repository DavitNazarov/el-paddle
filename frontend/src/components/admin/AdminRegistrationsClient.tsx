'use client';

import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, UserCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
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
} from '@/components/shared/dashboard/DashboardUI';
import { apiFetch } from '@/lib/api';
import { useI18n } from '@/components/shared/I18nProvider';
import { AdminShell } from './AdminShell';
import type { RegistrationDto, RegistrationFilter } from '@/types/admin';

export function AdminRegistrationsClient() {
  const { dictionary, t, formatDate } = useI18n();
  const admin = dictionary.dashboard.admin;
  const copy = admin.registrationsPage;
  const [registrations, setRegistrations] = useState<RegistrationDto[]>([]);
  const [filter, setFilter] = useState<RegistrationFilter>('PENDING');
  const [declineTarget, setDeclineTarget] = useState<RegistrationDto | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

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

  async function load() {
    setLoading(true);
    const response = await apiFetch('/api/admin/registrations', { cache: 'no-store' });
    const data = (await response.json()) as { registrations: RegistrationDto[] };
    setRegistrations(data.registrations ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

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
    const response = await apiFetch(`/api/admin/registrations/${registration.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status, declineReason: reason.trim() }),
    });
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

  return (
    <AdminShell title={copy.title} description={copy.description} eyebrow={copy.eyebrow}>
      {message ? <FeedbackBanner kind="success">{message}</FeedbackBanner> : null}
      {error ? <FeedbackBanner kind="error">{error}</FeedbackBanner> : null}

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
            <Button variant="outline" className={softButtonClassName} onClick={() => setFilter('ALL')}>
              {admin.registrations.filterAll}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4">
          {filtered.map((registration) => {
            const actionBusy = busy === registration.id;
            return (
              <SurfaceCard key={registration.id}>
                <CardContent className="grid gap-4 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <RegistrationStatusBadge status={registration.status} />
                        <Badge variant="outline" className="border-[rgba(19,2,2,0.12)]">
                          {registration.category.name}
                        </Badge>
                      </div>
                      <h3 className="mt-3 text-xl font-semibold text-[var(--padel-ink)]">{registration.event.title}</h3>
                      <p className="mt-1 text-sm text-[rgba(19,2,2,0.58)]">
                        {formatDate(registration.event.date, { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
                      <Button
                        variant="red"
                        disabled={actionBusy || registration.status === 'APPROVED'}
                        onClick={() => setRegistrationStatus(registration, 'APPROVED')}
                      >
                        <UserCheck className="h-4 w-4" />
                        {admin.registrations.approve}
                      </Button>
                      <Button
                        variant="destructive"
                        disabled={actionBusy || registration.status === 'DECLINED'}
                        onClick={() => setRegistrationStatus(registration, 'DECLINED')}
                      >
                        {admin.registrations.decline}
                      </Button>
                      <Button
                        variant="outline"
                        className={softButtonClassName}
                        disabled={actionBusy || registration.status === 'PENDING'}
                        onClick={() => setRegistrationStatus(registration, 'PENDING')}
                      >
                        {admin.registrations.pending}
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-lg bg-[#faf6ee] p-4 md:grid-cols-2">
                    <TeamBlock title={copy.playerOne} name={registration.owner.fullName} email={registration.owner.email} phone={registration.ownerPhone} />
                    <TeamBlock
                      title={copy.playerTwo}
                      name={registration.teammate.fullName}
                      email={registration.teammate.email}
                      phone={registration.teammatePhone || admin.registrations.noTeammatePhone}
                    />
                  </div>

                  {registration.declineReason ? (
                    <p className="rounded-md bg-[var(--padel-red)]/8 px-3 py-2 text-sm text-[var(--padel-red)]">
                      {t('dashboard.admin.registrations.reason', { reason: registration.declineReason })}
                    </p>
                  ) : null}
                </CardContent>
              </SurfaceCard>
            );
          })}
        </div>
      )}

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
              className={softButtonClassName}
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
              disabled={!declineTarget || !declineReason.trim() || busy === declineTarget.id}
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
}: {
  title: string;
  name: string;
  email: string;
  phone: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[rgba(19,2,2,0.5)]">{title}</p>
      <p className="mt-2 font-semibold text-[var(--padel-ink)]">{name}</p>
      <p className="mt-1 truncate text-sm text-[rgba(19,2,2,0.58)]">{email}</p>
      <p className="mt-0.5 text-sm text-[rgba(19,2,2,0.58)]">{phone}</p>
    </div>
  );
}
