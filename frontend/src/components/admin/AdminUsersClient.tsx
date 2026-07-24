'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Ban, Plus, Search, Shield, Trash2, Undo2, UserRound, Users } from 'lucide-react';
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
  const [search, setSearch] = useState('');
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
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return users.filter((user) => {
      const matchesRole = filter === 'ALL' || user.role === filter;
      const matchesSearch =
        !normalizedSearch ||
        [user.fullName, user.email, user.club?.name, user.role, user.status, user.isDisqualified ? 'disqualified' : '']
          .filter(Boolean)
          .some((value) => value?.toLocaleLowerCase().includes(normalizedSearch));
      return matchesRole && matchesSearch;
    });
  }, [filter, search, users]);

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
    return role === 'ADMIN' ? copy.roleAdmin : role === 'JUDGE' ? 'Judge' : copy.rolePlayer;
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

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading title={copy.listTitle} description={copy.listDescription} />
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgba(213,201,177,0.45)]" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={copy.searchPlaceholder}
            aria-label={copy.searchPlaceholder}
            className="h-10 rounded-md border-[var(--dash-border)] bg-white pl-9 text-[var(--dash-text)] placeholder:text-[var(--dash-faint)] focus-visible:border-[var(--dash-primary)] focus-visible:ring-[var(--padel-focus-ring)]"
          />
        </div>
      </div>
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

        {!loading && visible.length ? (
          <SurfaceCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] table-fixed border-collapse text-left">
                <colgroup>
                  <col className="w-[30%]" />
                  <col className="w-[19%]" />
                  <col className="w-[13%]" />
                  <col className="w-[14%]" />
                  <col className="w-[132px] 2xl:w-[340px]" />
                </colgroup>
                <thead className="bg-[#fdf9f7] text-xs uppercase tracking-[0.14em] text-[var(--dash-faint)]">
                  <tr>
                    <th scope="col" className="px-5 py-4 font-medium">{copy.columnUser}</th>
                    <th scope="col" className="px-5 py-4 font-medium">{copy.columnClub}</th>
                    <th scope="col" className="px-5 py-4 font-medium">{copy.columnRole}</th>
                    <th scope="col" className="px-5 py-4 font-medium">{copy.columnStatus}</th>
                    <th scope="col" className="sticky right-0 z-10 border-l border-[var(--dash-border)] bg-[#fdf9f7] px-5 py-4 text-right font-medium shadow-[-8px_0_14px_-10px_rgba(43,26,24,0.08)]">
                      {copy.columnActions}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--dash-border)]">
                  {visible.map((user) => (
                    <tr key={user.id} className="group bg-white transition-colors hover:bg-[#fdf9f7]">
                      <td className="px-5 py-4 align-middle">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="truncate font-medium text-[var(--dash-text)]" title={user.fullName}>
                            {user.fullName}
                          </span>
                          {user.id === currentUserId ? (
                            <Badge className="shrink-0 border-[rgba(61,103,150,0.25)] bg-[var(--dash-info-soft)] text-[var(--dash-info)]">
                              {copy.you}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 truncate text-sm text-[var(--dash-muted)]" title={user.email}>{user.email}</p>
                      </td>
                      <td className="px-5 py-4 align-middle text-sm text-[var(--dash-muted)]">
                        <span className="block truncate" title={user.club?.name}>{user.club?.name ?? '—'}</span>
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <Badge className="border-[var(--dash-border)] bg-[#fdf9f7] text-[var(--dash-muted)]">
                          {user.role === 'ADMIN' ? <Shield className="mr-1 h-3 w-3" /> : <UserRound className="mr-1 h-3 w-3" />}
                          {roleLabel(user.role)}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <Badge className={user.isDisqualified ? 'border-[rgba(194,65,59,0.25)] bg-[var(--dash-coral-soft)] text-[var(--dash-coral)]' : 'border-[var(--dash-border)] bg-[#fdf9f7] text-[var(--dash-muted)]'}>
                          {statusLabel(user)}
                        </Badge>
                        {user.isDisqualified ? (
                          <p className="mt-2 text-xs leading-5 text-[var(--dash-muted)]">
                            {copy.disqualifiedUntil.replace('{date}', new Date(user.disqualifiedUntil!).toLocaleDateString())}
                            {user.disqualificationReason ? ` — ${user.disqualificationReason}` : ''}
                          </p>
                        ) : null}
                      </td>
                      <td className="sticky right-0 z-10 border-l border-[var(--dash-border)] bg-white px-5 py-4 align-middle shadow-[-8px_0_14px_-10px_rgba(43,26,24,0.08)] transition-colors group-hover:bg-[#fdf9f7]">
                        <div className="flex items-center justify-end gap-2">
                          {user.role === 'USER' ? (
                            user.isDisqualified ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-md border-[var(--dash-border)] bg-white text-[var(--dash-text)] hover:border-[var(--dash-border-strong)] hover:bg-[#fdf9f7]"
                                aria-label={copy.clearDisqualify}
                                title={copy.clearDisqualify}
                                disabled={busy}
                                onClick={() => {
                                  void clearDisqualification(user);
                                }}
                              >
                                <Undo2 className="h-4 w-4" />
                                <span className="hidden 2xl:inline">{copy.clearDisqualify}</span>
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-md border-[var(--dash-border)] bg-white text-[var(--dash-text)] hover:border-[var(--dash-border-strong)] hover:bg-[#fdf9f7]"
                                aria-label={copy.disqualify}
                                title={copy.disqualify}
                                onClick={() => {
                                  setDisqualifyForm({ until: '', reason: '' });
                                  setDisqualifying(user);
                                }}
                              >
                                <Ban className="h-4 w-4" />
                                <span className="hidden 2xl:inline">{copy.disqualify}</span>
                              </Button>
                            )
                          ) : null}
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-md border-[rgba(194,65,59,0.28)] bg-white text-[var(--dash-coral)] hover:bg-[var(--dash-coral-soft)]"
                            aria-label={copy.delete}
                            title={copy.delete}
                            onClick={() => setDeleting(user)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="hidden 2xl:inline">{copy.delete}</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SurfaceCard>
        ) : null}
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
              <option value="JUDGE">Judge</option>
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
        <p className="text-sm leading-6 text-[#6d5f5c]">{copy.deleteWarning}</p>
      </DashboardModal>
    </AdminShell>
  );
}
