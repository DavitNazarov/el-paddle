'use client';

import { useEffect, useMemo, useState } from 'react';
import { Ban, Gavel, Plus, Shield, Trash2, Undo2, UserCog, UserRound, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  DashboardField,
  FeedbackBanner,
  SectionHeading,
  formControlClassName,
  softButtonClassName,
} from '@/components/shared/dashboard/DashboardUI';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import { useClubOptions } from '@/hooks/useClubOptions';
import { AdminShell } from './AdminShell';
import { DirectoryTable, rowActionClassName } from './directory/DirectoryTable';
import { DirectoryToolbar } from './directory/DirectoryToolbar';
import { ConfirmModal, EditorModal } from './directory/DirectoryModals';
import {
  ALL_FACET,
  USER_FACET_VALUES,
  emptyQuery,
  facetOptions,
  filterRows,
  userReader,
  type DirectoryQuery,
} from './directory/directoryModel';
import styles from './directory/Directory.module.css';
import type { AdminUserDto } from '@/types/admin';
import type { UserRole } from '@/types/auth';

const emptyForm = { email: '', name: '', surname: '', password: '', clubId: '' };
const emptyDisqualify = { until: '', reason: '' };

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
  const { dictionary, locale, t } = useI18n();
  const admin = dictionary.dashboard.admin;
  const copy = admin.usersPage;
  const roleCopy = copy.roles[role];
  const RoleIcon = roleIcons[role];
  const dir = tournamentCopy[locale].admin.directory;
  const { clubs } = useClubOptions();

  const [users, setUsers] = useState<AdminUserDto[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [query, setQuery] = useState<DirectoryQuery>(emptyQuery);
  const [form, setForm] = useState(emptyForm);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<AdminUserDto | null>(null);
  const [disqualifying, setDisqualifying] = useState<AdminUserDto | null>(null);
  const [disqualifyForm, setDisqualifyForm] = useState(emptyDisqualify);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
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
  const visible = useMemo(() => filterRows(roleUsers, query, userReader), [roleUsers, query]);
  const facets = useMemo(
    () =>
      facetOptions(roleUsers, query, userReader, USER_FACET_VALUES, (value) => {
        if (value === ALL_FACET) return dir.all;
        if (value === 'ACTIVE') return copy.statusActive;
        if (value === 'INVITED') return copy.statusInvited;
        return copy.statusDisqualified;
      }),
    [copy, dir, query, roleUsers],
  );

  /** One writer for every command on this screen: route, body and message differ, nothing else. */
  async function send(path: string, method: string, body: unknown, success: string) {
    setError('');
    setFormError('');
    setMessage('');
    setBusy(true);
    const response = await apiFetch(path, {
      method,
      ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string; invited?: boolean };
    setBusy(false);
    if (!response.ok) return { failure: result.error ?? admin.messages.actionFailed };
    setMessage(success);
    await load();
    return { invited: result.invited };
  }

  async function createUser() {
    const result = await send('/api/admin/users', 'POST', { ...form, role }, admin.messages.userCreated);
    if (result.failure) return setFormError(result.failure);
    if (result.invited) setMessage(admin.messages.userInvited);
    setForm(emptyForm);
    setCreateOpen(false);
  }

  async function confirmDelete() {
    if (!deleting) return;
    const removingSelf = deleting.id === currentUserId;
    const result = await send(`/api/admin/users/${deleting.id}`, 'DELETE', undefined, admin.messages.userDeleted);
    if (result.failure) return setFormError(result.failure);
    // Deleting your own account ends the session, so leave rather than re-render.
    if (removingSelf) {
      window.location.href = '/login';
      return;
    }
    setDeleting(null);
  }

  async function confirmDisqualify() {
    if (!disqualifying) return;
    const result = await send(
      `/api/admin/users/${disqualifying.id}/disqualify`,
      'POST',
      disqualifyForm,
      admin.messages.userDisqualified,
    );
    if (result.failure) return setFormError(result.failure);
    setDisqualifying(null);
    setDisqualifyForm(emptyDisqualify);
  }

  async function clearDisqualification(user: AdminUserDto) {
    const result = await send(
      `/api/admin/users/${user.id}/disqualify`,
      'DELETE',
      undefined,
      admin.messages.userDisqualificationCleared,
    );
    if (result.failure) setError(result.failure);
  }

  function statusLabel(user: AdminUserDto) {
    if (user.isDisqualified) return copy.statusDisqualified;
    if (user.status === 'ACTIVE') return copy.statusActive;
    if (user.status === 'INVITED') return copy.statusInvited;
    return copy.statusPending;
  }

  const createButton = (
    <Button
      variant="red"
      className="min-h-11 rounded-md"
      onClick={() => {
        setForm(emptyForm);
        setFormError('');
        setCreateOpen(true);
      }}
    >
      <Plus className="h-4 w-4" />
      {roleCopy.showCreate}
    </Button>
  );

  return (
    <AdminShell title={roleCopy.title} description={roleCopy.description} eyebrow={copy.eyebrow}>
      {message ? <FeedbackBanner kind="success">{message}</FeedbackBanner> : null}
      {error ? <FeedbackBanner kind="error">{error}</FeedbackBanner> : null}

      <SectionHeading title={roleCopy.listTitle} description={roleCopy.listDescription} actions={createButton} />

      <DirectoryToolbar
        id="users"
        query={query}
        onQueryChange={setQuery}
        facets={facets}
        searchLabel={copy.searchPlaceholder}
        countLabel={
          visible.length === roleUsers.length
            ? fillTemplate(dir.total, { count: roleUsers.length })
            : fillTemplate(dir.shown, { shown: visible.length, total: roleUsers.length })
        }
      />

      <div className="mt-4">
        <DirectoryTable
          loading={loading}
          rows={visible}
          total={roleUsers.length}
          icon={RoleIcon}
          loadingLabel={copy.loadingTitle}
          rowKey={(user) => user.id}
          actionsHeader={copy.columnActions}
          empty={{ title: roleCopy.emptyTitle, description: roleCopy.emptyDescription, action: createButton }}
          noMatches={{
            title: dir.noMatches,
            description: dir.noMatchesDetail,
            action: (
              <Button variant="outline" className={cn(softButtonClassName, 'min-h-11 rounded-md')} onClick={() => setQuery(emptyQuery)}>
                {dir.showAll}
              </Button>
            ),
          }}
          columns={[
            {
              key: 'user',
              header: copy.columnUser,
              width: showsClub ? 'w-[38%]' : 'w-[62%]',
              cell: (user) => (
                <>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className={styles.primary} title={user.fullName}>
                      {user.fullName}
                    </span>
                    {user.id === currentUserId ? (
                      <Badge className="shrink-0 border-[rgba(61,103,150,0.25)] bg-[var(--dash-info-soft)] text-[var(--dash-info)]">
                        {copy.you}
                      </Badge>
                    ) : null}
                  </div>
                  <span className={styles.secondary} title={user.email}>
                    {user.email}
                  </span>
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
                      <span className={styles.secondary} title={user.club?.name}>
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
                  <Badge
                    className={
                      user.isDisqualified
                        ? 'border-[rgba(194,65,59,0.25)] bg-[var(--dash-coral-soft)] text-[var(--dash-coral)]'
                        : 'border-[var(--dash-border)] bg-[#fdf9f7] text-[var(--dash-muted)]'
                    }
                  >
                    {statusLabel(user)}
                  </Badge>
                  {user.isDisqualified ? (
                    <p className={styles.note}>
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
              {/* Disqualification applies to players only; other roles never see the control. */}
              {user.role === 'USER' ? (
                user.isDisqualified ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className={cn(softButtonClassName, rowActionClassName)}
                    aria-label={copy.clearDisqualify}
                    title={copy.clearDisqualify}
                    disabled={busy}
                    onClick={() => void clearDisqualification(user)}
                  >
                    <Undo2 className="h-4 w-4" />
                    <span className="hidden 2xl:inline">{copy.clearDisqualify}</span>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className={cn(softButtonClassName, rowActionClassName)}
                    aria-label={copy.disqualify}
                    title={copy.disqualify}
                    onClick={() => {
                      setDisqualifyForm(emptyDisqualify);
                      setFormError('');
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
                className="min-h-11 rounded-md border-[rgba(194,65,59,0.28)] bg-white text-[var(--dash-coral)] hover:bg-[var(--dash-coral-soft)]"
                aria-label={copy.delete}
                title={copy.delete}
                onClick={() => {
                  setFormError('');
                  setDeleting(user);
                }}
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden 2xl:inline">{copy.delete}</span>
              </Button>
            </>
          )}
        />
      </div>

      <EditorModal
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) setCreateOpen(false);
        }}
        title={roleCopy.createTitle}
        description={roleCopy.createDescription}
        formId="create-user-form"
        busy={busy}
        error={formError}
        cancelLabel={t('common.cancel')}
        submitLabel={busy ? admin.messages.saving : copy.createSubmit}
        onSubmit={() => void createUser()}
      >
        <div className={styles.formRow}>
          <DashboardField label={copy.fieldName} id="create-user-name">
            <Input
              id="create-user-name"
              required
              value={form.name}
              onChange={(fieldEvent) => setForm((current) => ({ ...current, name: fieldEvent.target.value }))}
              className={formControlClassName}
            />
          </DashboardField>
          <DashboardField label={copy.fieldSurname} id="create-user-surname">
            <Input
              id="create-user-surname"
              required
              value={form.surname}
              onChange={(fieldEvent) => setForm((current) => ({ ...current, surname: fieldEvent.target.value }))}
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
            onChange={(fieldEvent) => setForm((current) => ({ ...current, email: fieldEvent.target.value }))}
            className={formControlClassName}
          />
        </DashboardField>
        {showsClub ? (
          <DashboardField label={copy.fieldClub} id="create-user-club">
            <select
              id="create-user-club"
              required
              value={form.clubId}
              onChange={(fieldEvent) => setForm((current) => ({ ...current, clubId: fieldEvent.target.value }))}
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
            onChange={(fieldEvent) => setForm((current) => ({ ...current, password: fieldEvent.target.value }))}
            className={formControlClassName}
            autoComplete="new-password"
          />
        </DashboardField>
      </EditorModal>

      <EditorModal
        open={Boolean(disqualifying)}
        onOpenChange={(open) => {
          if (!open) setDisqualifying(null);
        }}
        title={copy.disqualifyTitle}
        description={
          disqualifying ? copy.disqualifyDescription.replace('{name}', disqualifying.fullName) : copy.disqualifyDescription
        }
        formId="disqualify-user-form"
        size="md"
        busy={busy}
        error={formError}
        cancelLabel={t('common.cancel')}
        submitLabel={busy ? admin.messages.saving : copy.disqualifySubmit}
        onSubmit={() => void confirmDisqualify()}
      >
        <DashboardField label={copy.fieldUntil} id="disqualify-until">
          <Input
            id="disqualify-until"
            type="date"
            required
            value={disqualifyForm.until}
            onChange={(fieldEvent) => setDisqualifyForm((current) => ({ ...current, until: fieldEvent.target.value }))}
            className={formControlClassName}
          />
        </DashboardField>
        <DashboardField label={copy.fieldReason} id="disqualify-reason" hint={t('common.optional')}>
          <Textarea
            id="disqualify-reason"
            value={disqualifyForm.reason}
            onChange={(fieldEvent) => setDisqualifyForm((current) => ({ ...current, reason: fieldEvent.target.value }))}
            className={formControlClassName}
          />
        </DashboardField>
      </EditorModal>

      <ConfirmModal
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={copy.deleteTitle}
        description={deleting ? copy.deleteDescription.replace('{name}', deleting.fullName) : copy.deleteDescription}
        body={copy.deleteWarning}
        busy={busy}
        error={formError}
        cancelLabel={t('common.cancel')}
        confirmLabel={busy ? admin.messages.saving : copy.confirmDelete}
        onConfirm={() => void confirmDelete()}
      />
    </AdminShell>
  );
}
