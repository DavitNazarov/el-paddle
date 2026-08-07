'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Building2, ExternalLink, Pencil, Plus, Trash2, Users } from 'lucide-react';
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
import { AdminShell } from './AdminShell';
import { DirectoryTable, rowActionClassName } from './directory/DirectoryTable';
import { DirectoryToolbar } from './directory/DirectoryToolbar';
import { ConfirmModal, EditorModal } from './directory/DirectoryModals';
import {
  ALL_FACET,
  CLUB_FACET_VALUES,
  clubReader,
  emptyQuery,
  facetOptions,
  filterRows,
  type DirectoryQuery,
} from './directory/directoryModel';
import styles from './directory/Directory.module.css';
import type { ClubDto } from '@/types/admin';

const emptyClub = { name: '', slug: '', description: '', logoUrl: '' };
const emptyMember = { email: '', roleTitle: '' };

export function AdminClubsClient() {
  const { dictionary, locale, t } = useI18n();
  const admin = dictionary.dashboard.admin;
  const copy = admin.clubsPage;
  const dir = tournamentCopy[locale].admin.directory;

  const [clubs, setClubs] = useState<ClubDto[]>([]);
  const [query, setQuery] = useState<DirectoryQuery>(emptyQuery);
  const [clubForm, setClubForm] = useState(emptyClub);
  const [memberForm, setMemberForm] = useState(emptyMember);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ClubDto | null>(null);
  const [deleting, setDeleting] = useState<ClubDto | null>(null);
  const [memberClub, setMemberClub] = useState<ClubDto | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const response = await apiFetch('/api/admin/clubs', { cache: 'no-store' });
    const data = (await response.json()) as { clubs: ClubDto[] };
    setClubs(data.clubs ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const visible = useMemo(() => filterRows(clubs, query, clubReader), [clubs, query]);
  const facets = useMemo(
    () =>
      facetOptions(clubs, query, clubReader, CLUB_FACET_VALUES, (value) =>
        value === ALL_FACET ? dir.all : value === 'STAFFED' ? dir.clubWithMembers : dir.clubNoMembers,
      ),
    [clubs, dir, query],
  );

  /** One writer for every command: they differ only in route, method and message. */
  async function send(
    key: string,
    path: string,
    method: string,
    body: unknown,
    success: string,
    failureCopy: string,
  ) {
    setError('');
    setFormError('');
    setMessage('');
    setBusy(key);
    const response = await apiFetch(path, {
      method,
      ...(body === undefined
        ? {}
        : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(null);
    if (!response.ok) return result.error ?? failureCopy;
    setMessage(success);
    await load();
    return null;
  }

  async function createClub() {
    const failure = await send('club', '/api/admin/clubs', 'POST', clubForm, admin.messages.clubCreated, admin.messages.actionFailed);
    if (failure) return setFormError(failure);
    setClubForm(emptyClub);
    setCreateOpen(false);
  }

  async function updateClub() {
    if (!editing) return;
    const failure = await send(
      'club',
      `/api/admin/clubs/${editing.id}`,
      'PATCH',
      clubForm,
      admin.messages.clubUpdated,
      admin.messages.actionFailed,
    );
    if (failure) return setFormError(failure);
    setClubForm(emptyClub);
    setEditing(null);
  }

  async function confirmDelete() {
    if (!deleting) return;
    const failure = await send(
      `delete-${deleting.id}`,
      `/api/admin/clubs/${deleting.id}`,
      'DELETE',
      undefined,
      admin.messages.clubDeleted,
      admin.messages.actionFailed,
    );
    if (failure) return setFormError(failure);
    setDeleting(null);
  }

  async function addClubMember() {
    if (!memberClub) return;
    const failure = await send(
      `member-${memberClub.id}`,
      `/api/admin/clubs/${memberClub.id}/members`,
      'POST',
      memberForm,
      admin.messages.memberAdded,
      admin.messages.memberAddFailed,
    );
    if (failure) return setFormError(failure);
    setMemberForm(emptyMember);
    setMemberClub(null);
  }

  const createButton = (
    <Button
      variant="red"
      className="min-h-11 rounded-md"
      onClick={() => {
        setClubForm(emptyClub);
        setFormError('');
        setCreateOpen(true);
      }}
    >
      <Plus className="h-4 w-4" />
      {copy.showCreate}
    </Button>
  );

  function openEdit(club: ClubDto) {
    setClubForm({
      name: club.name,
      slug: club.slug,
      description: club.description,
      logoUrl: club.logoUrl,
    });
    setFormError('');
    setEditing(club);
  }

  /** The same four profile fields for create and edit; only the field ids differ. */
  const clubFields = (idPrefix: string) => (
    <>
      <div className={styles.formRow}>
        <DashboardField label={admin.clubs.clubName} id={`${idPrefix}-name`}>
          <Input
            id={`${idPrefix}-name`}
            required
            value={clubForm.name}
            onChange={(fieldEvent) => setClubForm((current) => ({ ...current, name: fieldEvent.target.value }))}
            placeholder={admin.clubs.clubPlaceholder}
            className={formControlClassName}
          />
        </DashboardField>
        <DashboardField label={admin.clubs.slug} id={`${idPrefix}-slug`} hint={t('common.optional')}>
          <Input
            id={`${idPrefix}-slug`}
            value={clubForm.slug}
            onChange={(fieldEvent) => setClubForm((current) => ({ ...current, slug: fieldEvent.target.value }))}
            placeholder={admin.clubs.slugPlaceholder}
            className={formControlClassName}
          />
        </DashboardField>
      </div>
      <DashboardField label={admin.clubs.logoUrl} id={`${idPrefix}-logo`} hint={t('common.optional')}>
        <Input
          id={`${idPrefix}-logo`}
          type="url"
          value={clubForm.logoUrl}
          onChange={(fieldEvent) => setClubForm((current) => ({ ...current, logoUrl: fieldEvent.target.value }))}
          placeholder={admin.clubs.logoPlaceholder}
          className={formControlClassName}
        />
      </DashboardField>
      <DashboardField label={admin.clubs.descriptionLabel} id={`${idPrefix}-description`} hint={t('common.optional')}>
        <Textarea
          id={`${idPrefix}-description`}
          value={clubForm.description}
          onChange={(fieldEvent) => setClubForm((current) => ({ ...current, description: fieldEvent.target.value }))}
          placeholder={admin.clubs.descriptionPlaceholder}
          className={formControlClassName}
        />
      </DashboardField>
    </>
  );

  return (
    <AdminShell title={copy.title} description={copy.description} eyebrow={copy.eyebrow}>
      {message ? <FeedbackBanner kind="success">{message}</FeedbackBanner> : null}
      {error ? <FeedbackBanner kind="error">{error}</FeedbackBanner> : null}

      <SectionHeading title={copy.listTitle} description={copy.listDescription} actions={createButton} />

      <DirectoryToolbar
        id="clubs"
        query={query}
        onQueryChange={setQuery}
        facets={facets}
        searchLabel={dir.searchClubs}
        countLabel={
          visible.length === clubs.length
            ? fillTemplate(dir.total, { count: clubs.length })
            : fillTemplate(dir.shown, { shown: visible.length, total: clubs.length })
        }
      />

      <div className="mt-4">
        <DirectoryTable
          loading={loading}
          rows={visible}
          total={clubs.length}
          icon={Building2}
          loadingLabel={admin.clubs.loadingTitle}
          rowKey={(club) => club.id}
          minWidthClassName="min-w-[900px]"
          actionsHeader={admin.clubs.columnActions}
          actionsWidth="w-[212px] 2xl:w-[440px]"
          empty={{
            title: admin.clubs.emptyTitle,
            description: admin.clubs.emptyDescription,
            action: createButton,
          }}
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
              key: 'club',
              header: admin.clubs.columnClub,
              width: 'w-[28%]',
              cell: (club) => (
                <>
                  <span className={styles.primary} title={club.name}>
                    {club.name}
                  </span>
                  <span className={styles.secondary}>/{club.slug}</span>
                </>
              ),
            },
            {
              key: 'description',
              header: admin.clubs.columnDescription,
              width: 'w-[32%]',
              cell: (club) => <p className={styles.wrapped}>{club.description || admin.clubs.noDescription}</p>,
            },
            {
              key: 'members',
              header: admin.clubs.columnMembers,
              width: 'w-[28%]',
              cell: (club) =>
                club.members.length ? (
                  <>
                    <Badge className="border-[var(--dash-border)] bg-[#fdf9f7] text-[var(--dash-muted)]">
                      {t('common.members', { count: club.members.length })}
                    </Badge>
                    <p className={styles.note}>
                      {club.members
                        .map((member) => member.user.fullName + (member.roleTitle ? ` · ${member.roleTitle}` : ''))
                        .join(', ')}
                    </p>
                  </>
                ) : (
                  <span className={styles.faint}>{admin.clubs.noMembers}</span>
                ),
            },
          ]}
          renderActions={(club) => (
            <>
              <Button
                size="sm"
                variant="outline"
                className={cn(softButtonClassName, rowActionClassName)}
                aria-label={admin.clubs.edit}
                title={admin.clubs.edit}
                onClick={() => openEdit(club)}
              >
                <Pencil className="h-4 w-4" />
                <span className="hidden 2xl:inline">{admin.clubs.edit}</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className={cn(softButtonClassName, rowActionClassName)}
                aria-label={admin.clubs.addMember}
                title={admin.clubs.addMember}
                onClick={() => {
                  setMemberForm(emptyMember);
                  setFormError('');
                  setMemberClub(club);
                }}
              >
                <Users className="h-4 w-4" />
                <span className="hidden 2xl:inline">{admin.clubs.addMember}</span>
              </Button>
              <Button asChild size="sm" variant="outline" className={cn(softButtonClassName, rowActionClassName)}>
                <Link href={`/clubs/${club.slug}`} aria-label={admin.clubs.openPage} title={admin.clubs.openPage}>
                  <ExternalLink className="h-4 w-4" />
                  <span className="hidden 2xl:inline">{admin.clubs.openPage}</span>
                </Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="min-h-11 rounded-md border-[rgba(194,65,59,0.28)] bg-white text-[var(--dash-coral)] hover:bg-[var(--dash-coral-soft)]"
                aria-label={admin.clubs.delete}
                title={admin.clubs.delete}
                onClick={() => {
                  setFormError('');
                  setDeleting(club);
                }}
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden 2xl:inline">{admin.clubs.delete}</span>
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
        title={admin.clubs.createClub}
        description={copy.createDescription}
        formId="create-club-form"
        busy={busy === 'club'}
        error={formError}
        cancelLabel={t('common.cancel')}
        submitLabel={busy === 'club' ? admin.messages.saving : admin.clubs.saveClub}
        onSubmit={() => void createClub()}
      >
        {clubFields('club')}
      </EditorModal>

      <EditorModal
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title={copy.editTitle}
        description={editing ? `${copy.editDescription} · ${editing.name}` : copy.editDescription}
        formId="edit-club-form"
        busy={busy === 'club'}
        error={formError}
        cancelLabel={t('common.cancel')}
        submitLabel={busy === 'club' ? admin.messages.saving : copy.saveEdit}
        onSubmit={() => void updateClub()}
      >
        {clubFields('edit-club')}
      </EditorModal>

      <ConfirmModal
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={copy.deleteTitle}
        description={deleting ? copy.deleteDescription.replace('{name}', deleting.name) : copy.deleteDescription}
        body={
          deleting?.members.length
            ? `${fillTemplate(copy.deleteMembers, { count: deleting.members.length })} ${copy.deleteWarning}`
            : copy.deleteWarning
        }
        busy={Boolean(busy?.startsWith('delete-'))}
        error={formError}
        cancelLabel={t('common.cancel')}
        confirmLabel={busy?.startsWith('delete-') ? admin.messages.saving : copy.confirmDelete}
        onConfirm={() => void confirmDelete()}
      />

      <EditorModal
        open={Boolean(memberClub)}
        onOpenChange={(open) => {
          if (!open) setMemberClub(null);
        }}
        title={copy.addMemberTitle}
        description={memberClub ? `${copy.addMemberModalDescription} · ${memberClub.name}` : copy.addMemberModalDescription}
        formId="add-member-form"
        size="md"
        busy={Boolean(busy?.startsWith('member-'))}
        error={formError}
        cancelLabel={t('common.cancel')}
        submitLabel={busy?.startsWith('member-') ? admin.messages.saving : admin.clubs.addMember}
        onSubmit={() => void addClubMember()}
      >
        <DashboardField label={admin.clubs.memberEmail} id="member-email">
          <Input
            id="member-email"
            type="email"
            required
            value={memberForm.email}
            onChange={(fieldEvent) => setMemberForm((current) => ({ ...current, email: fieldEvent.target.value }))}
            placeholder={admin.clubs.userEmail}
            className={formControlClassName}
          />
        </DashboardField>
        <DashboardField label={admin.clubs.memberRole} id="member-role" hint={t('common.optional')}>
          <Input
            id="member-role"
            value={memberForm.roleTitle}
            onChange={(fieldEvent) => setMemberForm((current) => ({ ...current, roleTitle: fieldEvent.target.value }))}
            placeholder={admin.clubs.roleTitle}
            className={formControlClassName}
          />
        </DashboardField>
      </EditorModal>
    </AdminShell>
  );
}
