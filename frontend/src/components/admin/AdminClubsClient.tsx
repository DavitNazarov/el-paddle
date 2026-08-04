'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Building2, ExternalLink, Plus, Users } from 'lucide-react';
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
import { EditorModal } from './directory/DirectoryModals';
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

  async function send(key: string, path: string, body: unknown, success: string, failureCopy: string) {
    setError('');
    setFormError('');
    setMessage('');
    setBusy(key);
    const response = await apiFetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(null);
    if (!response.ok) return result.error ?? failureCopy;
    setMessage(success);
    await load();
    return null;
  }

  async function createClub() {
    const failure = await send('club', '/api/admin/clubs', clubForm, admin.messages.clubCreated, admin.messages.actionFailed);
    if (failure) return setFormError(failure);
    setClubForm(emptyClub);
    setCreateOpen(false);
  }

  async function addClubMember() {
    if (!memberClub) return;
    const failure = await send(
      `member-${memberClub.id}`,
      `/api/admin/clubs/${memberClub.id}/members`,
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
          minWidthClassName="min-w-[820px]"
          actionsHeader={admin.clubs.columnActions}
          actionsWidth="w-[120px] 2xl:w-[300px]"
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
        <div className={styles.formRow}>
          <DashboardField label={admin.clubs.clubName} id="club-name">
            <Input
              id="club-name"
              required
              value={clubForm.name}
              onChange={(fieldEvent) => setClubForm((current) => ({ ...current, name: fieldEvent.target.value }))}
              placeholder={admin.clubs.clubPlaceholder}
              className={formControlClassName}
            />
          </DashboardField>
          <DashboardField label={admin.clubs.slug} id="club-slug" hint={t('common.optional')}>
            <Input
              id="club-slug"
              value={clubForm.slug}
              onChange={(fieldEvent) => setClubForm((current) => ({ ...current, slug: fieldEvent.target.value }))}
              placeholder={admin.clubs.slugPlaceholder}
              className={formControlClassName}
            />
          </DashboardField>
        </div>
        <DashboardField label={admin.clubs.logoUrl} id="club-logo" hint={t('common.optional')}>
          <Input
            id="club-logo"
            type="url"
            value={clubForm.logoUrl}
            onChange={(fieldEvent) => setClubForm((current) => ({ ...current, logoUrl: fieldEvent.target.value }))}
            placeholder={admin.clubs.logoPlaceholder}
            className={formControlClassName}
          />
        </DashboardField>
        <DashboardField label={admin.clubs.descriptionLabel} id="club-description" hint={t('common.optional')}>
          <Textarea
            id="club-description"
            value={clubForm.description}
            onChange={(fieldEvent) => setClubForm((current) => ({ ...current, description: fieldEvent.target.value }))}
            placeholder={admin.clubs.descriptionPlaceholder}
            className={formControlClassName}
          />
        </DashboardField>
      </EditorModal>

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
