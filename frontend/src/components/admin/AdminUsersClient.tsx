'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Ban, Gavel, Plus, Search, Shield, Trash2, Undo2, UserCog, UserRound, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  DashboardField,
  DashboardModal,
  DataTable,
  EmptyState,
  FeedbackBanner,
  SectionHeading,
  formControlClassName,
} from '@/components/shared/dashboard/DashboardUI';
import { apiFetch } from '@/lib/api';
import { useI18n } from '@/components/shared/I18nProvider';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import { useClubOptions } from '@/hooks/useClubOptions';
import { AdminShell } from './AdminShell';
import type { AdminUserDto } from '@/types/admin';
import type { UserRole } from '@/types/auth';

const emptyForm = { email: '', name: '', surname: '', password: '', clubId: '' };

const roleIcons: Record<UserRole, typeof Users> = {
  ADMIN: Shield,
  ORGANISER: UserCog,
  JUDGE: Gavel,
  USER: UserRound,
};

/**
 * One screen per role. Roles carry different powers and different fields — a
 * player must belong to a club, only a player can be disqualified — so a single
 * list with a role filter made every column mean "sometimes".
 */
export function AdminUsersClient({ role }: { role: UserRole }) {
  const { dictionary, t } = useI18n();
  const admin = dictionary.dashboard.admin;
  const copy = admin.usersPage;
  const roleCopy = copy.roles[role];
  const RoleIcon = roleIcons[role];
  const { clubs } = useClubOptions();
  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
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

  // Only players belong to a club, so the column is dead weight on every other
  // role's screen.
  const showsClub = role === 'USER';

  const roleUsers = useMemo(() => users.filter((user) => user.role === role), [role, users]);

  const visible = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    if (!normalizedSearch) return roleUsers;
    return roleUsers.filter((user) =>
      [user.fullName, user.email, user.club?.name, user.status, user.isDisqualified ? 'disqualified' : '']
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase().includes(normalizedSearch)),
    );
  }, [roleUsers, search]);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    const response = await apiFetch('/api/admin/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...form, role }),
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

  function statusLabel(user: AdminUserDto) {
    if (user.isDisqualified) return copy.statusDisqualified;
    if (user.status === 'ACTIVE') return copy.statusActive;
    if (user.status === 'INVITED') return copy.statusInvited;
    return copy.statusPending;
  }

  return (
    <AdminShell title={roleCopy.title} description={roleCopy.description} eyebrow={copy.eyebrow}>
      {message ? <FeedbackBanner kind="success">{message}</FeedbackBanner> : null}
      {error ? <FeedbackBanner kind="error">{error}</FeedbackBanner> : null}

      <SectionHeading
        title={roleCopy.listTitle}
        description={roleCopy.listDescription}
        actions={
          <Button
            variant="red"
            className="min-h-11 rounded-md"
            onClick={() => {
              setForm(emptyForm);
              setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            {roleCopy.showCreate}
          </Button>
        }
      />

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--dash-muted)]">
          {t('common.total').replace('{count}', String(roleUsers.length))}
        </p>
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dash-faint)]" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={copy.searchPlaceholder}
            aria-label={copy.searchPlaceholder}
            className="h-11 rounded-md border-[var(--dash-border)] bg-white pl-9 text-[var(--dash-text)] placeholder:text-[var(--dash-faint)] focus-visible:border-[var(--dash-primary)] focus-visible:ring-[var(--padel-focus-ring)]"
          />
        </div>
      </div>
      <div className="mt-4 grid gap-4">
        {loading ? <EmptyState title={copy.loadingTitle} description={copy.loadingDescription} icon={RoleIcon} /> : null}
        {!loading && !visible.length ? (
          <EmptyState
            title={roleCopy.emptyTitle}
            description={roleCopy.emptyDescription}
            icon={RoleIcon}
            action={
              <Button variant="red" className="min-h-11 rounded-md" onClick={() => setCreateOpen(true)}>
                {roleCopy.showCreate}
              </Button>
            }
          />
        ) : null}

        {!loading && visible.length ? (
          <DataTable
            rows={visible}
            rowKey={(user) => user.id}
            actionsHeader={copy.columnActions}
            columns={[
              {
                key: 'user',
                header: copy.columnUser,
                width: showsClub ? 'w-[38%]' : 'w-[62%]',
                cell: (user) => (
                  <>
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
                  </>
                ),
              },
              ...(showsClub
                ? [
                    {
                      key: 'club',
                      header: copy.columnClub,
                      width: 'w-[24%]',
                      cell: (user: AdminUserDto) => (
                        <span className="block truncate text-sm text-[var(--dash-muted)]" title={user.club?.name}>
                          {user.club?.name ?? '—'}
                        </span>
                      ),
                    },
                  ]
                : []),
              {
                key: 'status',
                header: copy.columnStatus,
                width: 'w-[18%]',
                cell: (user) => (
                  <>
                    <Badge className={user.isDisqualified ? 'border-[rgba(194,65,59,0.25)] bg-[var(--dash-coral-soft)] text-[var(--dash-coral)]' : 'border-[var(--dash-border)] bg-[#fdf9f7] text-[var(--dash-muted)]'}>
                      {statusLabel(user)}
                    </Badge>
                    {user.isDisqualified ? (
                      <p className="mt-2 text-xs leading-5 text-[var(--dash-muted)]">
                        {copy.disqualifiedUntil.replace('{date}', new Date(user.disqualifiedUntil!).toLocaleDateString())}
                        {user.disqualificationReason ? ` — ${user.disqualificationReason}` : ''}
                      </p>
                    ) : null}
                  </>
                ),
              },
            ]}
            renderActions={(user) => (
              <>
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
              </>
            )}
          />
        ) : null}
      </div>

      <DashboardModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={roleCopy.createTitle}
        description={roleCopy.createDescription}
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
          {showsClub ? (
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
