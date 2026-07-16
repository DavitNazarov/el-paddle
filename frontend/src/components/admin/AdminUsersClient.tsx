'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Ban, Plus, Shield, Trash2, UserRound, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  DashboardField,
  DashboardModal,
  EmptyState,
  FeedbackBanner,
  FilterChip,
  SectionHeading,
  SurfaceCard,
  formControlClassName,
} from '@/components/shared/dashboard/DashboardUI';
import { Reveal } from '@/components/padel/home/motion';
import { apiFetch } from '@/lib/api';
import { useI18n } from '@/components/shared/I18nProvider';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import { useClubOptions } from '@/hooks/useClubOptions';
import { AdminShell } from './AdminShell';
import type { AdminUserDto, UserRoleFilter } from '@/types/admin';
import type { UserRole } from '@/types/auth';

const emptyForm = {
  email: '',
  name: '',
  surname: '',
  role: 'USER' as UserRole,
  password: '',
  clubId: '',
};

export function AdminUsersClient() {
  const { dictionary, t } = useI18n();
  const admin = dictionary.dashboard.admin;
  const copy = admin.usersPage;
  const { clubs } = useClubOptions();
  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [filter, setFilter] = useState<UserRoleFilter>('ALL');
  const [form, setForm] = useState(emptyForm);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<AdminUserDto | null>(null);
  const [disqualifying, setDisqualifying] = useState<AdminUserDto | null>(null);
  const [disqualifyForm, setDisqualifyForm] = useState({ until: '', reason: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const [usersResponse, meResponse] = await Promise.all([
      apiFetch('/api/admin/users', { cache: 'no-store' }),
      apiFetch('/api/auth/me', { cache: 'no-store' }),
    ]);
    const usersData = (await usersResponse.json()) as { users: AdminUserDto[] };
    const meData = (await meResponse.json()) as { user?: { id: string } | null };
    setUsers(usersData.users ?? []);
    setCurrentUserId(meData.user?.id ?? '');
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const counts = useMemo(
    () => ({
      all: users.length,
      players: users.filter((user) => user.role === 'USER').length,
      admins: users.filter((user) => user.role === 'ADMIN').length,
      disqualified: users.filter((user) => user.isDisqualified).length,
    }),
    [users],
  );

  const visible = useMemo(() => {
    if (filter === 'ALL') return users;
    return users.filter((user) => user.role === filter);
  }, [filter, users]);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    const response = await apiFetch('/api/admin/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    });
    const result = (await response.json()) as { error?: string; invited?: boolean };
    setBusy(false);
    if (!response.ok) {
      setError(result.error ?? admin.messages.actionFailed);
      return;
    }
    setMessage(result.invited ? admin.messages.userInvited : admin.messages.userCreated);
    setForm(emptyForm);
    setCreateOpen(false);
    await load();
  }

  async function confirmDelete() {
    if (!deleting) return;
    setError('');
    setMessage('');
    setBusy(true);
    const response = await apiFetch(`/api/admin/users/${deleting.id}`, { method: 'DELETE' });
    const result = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(result.error ?? admin.messages.actionFailed);
      return;
    }
    if (deleting.id === currentUserId) {
      window.location.href = '/login';
      return;
    }
    setMessage(admin.messages.userDeleted);
    setDeleting(null);
    await load();
  }

  async function confirmDisqualify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!disqualifying) return;
    setError('');
    setMessage('');
    setBusy(true);
    const response = await apiFetch(`/api/admin/users/${disqualifying.id}/disqualify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(disqualifyForm),
    });
    const result = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(result.error ?? admin.messages.actionFailed);
      return;
    }
    setMessage(admin.messages.userDisqualified);
    setDisqualifying(null);
    setDisqualifyForm({ until: '', reason: '' });
    await load();
  }

  async function clearDisqualification(user: AdminUserDto) {
    setError('');
    setMessage('');
    setBusy(true);
    const response = await apiFetch(`/api/admin/users/${user.id}/disqualify`, { method: 'DELETE' });
    const result = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(result.error ?? admin.messages.actionFailed);
      return;
    }
    setMessage(admin.messages.userDisqualificationCleared);
    await load();
  }

  function roleLabel(role: UserRole) {
    return role === 'ADMIN' ? copy.roleAdmin : copy.rolePlayer;
  }

  function statusLabel(user: AdminUserDto) {
    if (user.isDisqualified) return copy.statusDisqualified;
    if (user.status === 'ACTIVE') return copy.statusActive;
    if (user.status === 'INVITED') return copy.statusInvited;
    return copy.statusPending;
  }

  return (
    <AdminShell title={copy.title} description={copy.description} eyebrow={copy.eyebrow}>
      {message ? <FeedbackBanner kind="success">{message}</FeedbackBanner> : null}
      {error ? <FeedbackBanner kind="error">{error}</FeedbackBanner> : null}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <FilterChip active={filter === 'ALL'} count={counts.all} onClick={() => setFilter('ALL')}>
            {copy.filterAll}
          </FilterChip>
          <FilterChip active={filter === 'USER'} count={counts.players} onClick={() => setFilter('USER')}>
            {copy.filterPlayers}
          </FilterChip>
          <FilterChip active={filter === 'ADMIN'} count={counts.admins} onClick={() => setFilter('ADMIN')}>
            {copy.filterAdmins}
          </FilterChip>
        </div>
        <Button
          variant="red"
          className="rounded-md"
          onClick={() => {
            setForm(emptyForm);
            setCreateOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          {copy.showCreate}
        </Button>
      </div>

      <SectionHeading title={copy.listTitle} description={copy.listDescription} />
      <div className="mt-4 grid gap-4">
        {loading ? <EmptyState title={copy.loadingTitle} description={copy.loadingDescription} icon={Users} /> : null}
        {!loading && !visible.length ? (
          <EmptyState
            title={copy.emptyTitle}
            description={copy.emptyDescription}
            icon={Users}
            action={
              <Button variant="red" className="rounded-md" onClick={() => setCreateOpen(true)}>
                {copy.showCreate}
              </Button>
            }
          />
        ) : null}

        {visible.map((user, index) => (
          <Reveal key={user.id} delay={Math.min(index * 0.04, 0.2)}>
            <SurfaceCard>
              <div className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-xl font-semibold text-[var(--padel-ivory)]">
                        {user.fullName}
                      </h3>
                      {user.id === currentUserId ? (
                        <Badge className="border-[var(--padel-gold)]/30 bg-[var(--padel-gold)]/15 text-[var(--padel-gold-2)]">
                          {copy.you}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-[rgba(213,201,177,0.55)]">{user.email}</p>
                    {user.club ? (
                      <p className="mt-1 text-sm text-[rgba(213,201,177,0.45)]">{user.club.name}</p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge className="border-[rgba(213,201,177,0.18)] bg-[rgba(213,201,177,0.05)] text-[rgba(213,201,177,0.75)]">
                        {user.role === 'ADMIN' ? <Shield className="mr-1 h-3 w-3" /> : <UserRound className="mr-1 h-3 w-3" />}
                        {roleLabel(user.role)}
                      </Badge>
                      <Badge
                        className={
                          user.isDisqualified
                            ? 'border-[var(--padel-red)]/35 bg-[var(--padel-red)]/15 text-[var(--padel-red)]'
                            : 'border-[rgba(213,201,177,0.18)] bg-[rgba(213,201,177,0.05)] text-[rgba(213,201,177,0.75)]'
                        }
                      >
                        {statusLabel(user)}
                      </Badge>
                    </div>
                    {user.isDisqualified ? (
                      <p className="mt-3 text-sm leading-6 text-[rgba(213,201,177,0.55)]">
                        {copy.disqualifiedUntil.replace(
                          '{date}',
                          new Date(user.disqualifiedUntil!).toLocaleDateString(),
                        )}
                        {user.disqualificationReason
                          ? ` — ${user.disqualificationReason}`
                          : ''}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {user.role === 'USER' ? (
                      user.isDisqualified ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-md border-[rgba(213,201,177,0.18)] bg-transparent text-[var(--padel-ivory)]"
                          disabled={busy}
                          onClick={() => {
                            void clearDisqualification(user);
                          }}
                        >
                          {copy.clearDisqualify}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-md border-[rgba(213,201,177,0.18)] bg-transparent text-[var(--padel-ivory)]"
                          onClick={() => {
                            setDisqualifyForm({ until: '', reason: '' });
                            setDisqualifying(user);
                          }}
                        >
                          <Ban className="h-4 w-4" />
                          {copy.disqualify}
                        </Button>
                      )
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-md border-[var(--padel-red)]/35 bg-transparent text-[var(--padel-red)]"
                      onClick={() => setDeleting(user)}
                    >
                      <Trash2 className="h-4 w-4" />
                      {copy.delete}
                    </Button>
                  </div>
                </div>
              </div>
            </SurfaceCard>
          </Reveal>
        ))}
      </div>

      <DashboardModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={copy.createTitle}
        description={copy.createDescription}
        size="lg"
        footer={
          <ModalFormFooter
            formId="create-user-form"
            onCancel={() => setCreateOpen(false)}
            cancelLabel={t('common.cancel')}
            busy={busy}
            submitLabel={busy ? admin.messages.saving : copy.createSubmit}
          />
        }
      >
        <form id="create-user-form" onSubmit={createUser} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <DashboardField label={copy.fieldName} id="create-user-name">
              <Input
                id="create-user-name"
                required
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className={formControlClassName}
              />
            </DashboardField>
            <DashboardField label={copy.fieldSurname} id="create-user-surname">
              <Input
                id="create-user-surname"
                required
                value={form.surname}
                onChange={(event) => setForm((current) => ({ ...current, surname: event.target.value }))}
                className={formControlClassName}
              />
            </DashboardField>
          </div>
          <DashboardField label={copy.fieldEmail} id="create-user-email">
            <Input
              id="create-user-email"
              type="email"
              required
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              className={formControlClassName}
            />
          </DashboardField>
          <DashboardField label={copy.fieldRole} id="create-user-role">
            <select
              id="create-user-role"
              value={form.role}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  role: event.target.value as UserRole,
                  clubId: event.target.value === 'ADMIN' ? '' : current.clubId,
                }))
              }
              className={formControlClassName}
            >
              <option value="USER">{copy.rolePlayer}</option>
              <option value="ADMIN">{copy.roleAdmin}</option>
            </select>
          </DashboardField>
          {form.role === 'USER' ? (
            <DashboardField label={copy.fieldClub} id="create-user-club">
              <select
                id="create-user-club"
                required
                value={form.clubId}
                onChange={(event) => setForm((current) => ({ ...current, clubId: event.target.value }))}
                className={formControlClassName}
              >
                <option value="">{copy.clubPlaceholder}</option>
                {clubs.map((club) => (
                  <option key={club.id} value={club.id}>
                    {club.name}
                  </option>
                ))}
              </select>
            </DashboardField>
          ) : null}
          <DashboardField label={copy.fieldPassword} id="create-user-password" hint={copy.passwordHint}>
            <Input
              id="create-user-password"
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              className={formControlClassName}
              autoComplete="new-password"
            />
          </DashboardField>
        </form>
      </DashboardModal>

      <DashboardModal
        open={Boolean(disqualifying)}
        onOpenChange={(open) => {
          if (!open) setDisqualifying(null);
        }}
        title={copy.disqualifyTitle}
        description={
          disqualifying
            ? copy.disqualifyDescription.replace('{name}', disqualifying.fullName)
            : copy.disqualifyDescription
        }
        size="md"
        footer={
          <ModalFormFooter
            formId="disqualify-user-form"
            onCancel={() => setDisqualifying(null)}
            cancelLabel={t('common.cancel')}
            busy={busy}
            submitLabel={busy ? admin.messages.saving : copy.disqualifySubmit}
          />
        }
      >
        <form id="disqualify-user-form" onSubmit={confirmDisqualify} className="space-y-4">
          <DashboardField label={copy.fieldUntil} id="disqualify-until">
            <Input
              id="disqualify-until"
              type="date"
              required
              value={disqualifyForm.until}
              onChange={(event) =>
                setDisqualifyForm((current) => ({ ...current, until: event.target.value }))
              }
              className={formControlClassName}
            />
          </DashboardField>
          <DashboardField label={copy.fieldReason} id="disqualify-reason" hint={t('common.optional')}>
            <Textarea
              id="disqualify-reason"
              value={disqualifyForm.reason}
              onChange={(event) =>
                setDisqualifyForm((current) => ({ ...current, reason: event.target.value }))
              }
              className={formControlClassName}
            />
          </DashboardField>
        </form>
      </DashboardModal>

      <DashboardModal
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={copy.deleteTitle}
        description={
          deleting ? copy.deleteDescription.replace('{name}', deleting.fullName) : copy.deleteDescription
        }
        size="md"
        footer={
          <ModalFormFooter
            onCancel={() => setDeleting(null)}
            cancelLabel={t('common.cancel')}
            busy={busy}
            submitType="button"
            onSubmitClick={() => {
              void confirmDelete();
            }}
            submitLabel={busy ? admin.messages.saving : copy.confirmDelete}
          />
        }
      >
        <p className="text-sm leading-6 text-[rgba(213,201,177,0.65)]">{copy.deleteWarning}</p>
      </DashboardModal>
    </AdminShell>
  );
}
