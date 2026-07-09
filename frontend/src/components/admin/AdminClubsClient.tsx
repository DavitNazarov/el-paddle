'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { Building2, ExternalLink, Plus, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  DashboardField,
  DashboardModal,
  EmptyState,
  FeedbackBanner,
  SectionHeading,
  SurfaceCard,
  formControlClassName,
  softButtonClassName,
  modalSoftButtonClassName,
} from '@/components/shared/dashboard/DashboardUI';
import { Reveal } from '@/components/padel/home/motion';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/shared/I18nProvider';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import { AdminShell } from './AdminShell';
import type { ClubDto } from '@/types/admin';

export function AdminClubsClient() {
  const { dictionary, t } = useI18n();
  const admin = dictionary.dashboard.admin;
  const copy = admin.clubsPage;
  const [clubs, setClubs] = useState<ClubDto[]>([]);
  const [clubForm, setClubForm] = useState({ name: '', slug: '', description: '', logoUrl: '' });
  const [memberForm, setMemberForm] = useState({ email: '', roleTitle: '' });
  const [createOpen, setCreateOpen] = useState(false);
  const [memberClub, setMemberClub] = useState<ClubDto | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
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

  async function createClub(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setBusy('club');
    const response = await apiFetch('/api/admin/clubs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(clubForm),
    });
    const result = (await response.json()) as { error?: string };
    setBusy(null);
    if (!response.ok) {
      setError(result.error ?? admin.messages.actionFailed);
      return;
    }
    setMessage(admin.messages.clubCreated);
    setClubForm({ name: '', slug: '', description: '', logoUrl: '' });
    setCreateOpen(false);
    await load();
  }

  async function addClubMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!memberClub) return;
    setError('');
    setMessage('');
    setBusy(`member-${memberClub.id}`);
    const response = await apiFetch(`/api/admin/clubs/${memberClub.id}/members`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(memberForm),
    });
    const result = (await response.json()) as { error?: string };
    setBusy(null);
    if (!response.ok) {
      setError(result.error ?? admin.messages.memberAddFailed);
      return;
    }
    setMessage(admin.messages.memberAdded);
    setMemberForm({ email: '', roleTitle: '' });
    setMemberClub(null);
    await load();
  }

  return (
    <AdminShell title={copy.title} description={copy.description} eyebrow={copy.eyebrow}>
      {message ? <FeedbackBanner kind="success">{message}</FeedbackBanner> : null}
      {error ? <FeedbackBanner kind="error">{error}</FeedbackBanner> : null}

      <div className="mb-6 flex justify-end">
        <Button
          variant="red"
          className="rounded-md"
          onClick={() => {
            setClubForm({ name: '', slug: '', description: '', logoUrl: '' });
            setCreateOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          {copy.showCreate}
        </Button>
      </div>

      <SectionHeading title={copy.listTitle} description={copy.listDescription} />
      <div className="mt-4 grid gap-4">
        {loading ? <EmptyState title={admin.clubs.loadingTitle} description={admin.clubs.loadingDescription} icon={Building2} /> : null}
        {!loading && !clubs.length ? (
          <EmptyState
            title={admin.clubs.emptyTitle}
            description={admin.clubs.emptyDescription}
            icon={Building2}
            action={
              <Button variant="red" className="rounded-md" onClick={() => setCreateOpen(true)}>
                {copy.showCreate}
              </Button>
            }
          />
        ) : null}

        {clubs.map((club, index) => (
          <Reveal key={club.id} delay={Math.min(index * 0.04, 0.2)}>
            <SurfaceCard>
              <div className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="font-display text-xl font-semibold text-[var(--padel-ivory)]">{club.name}</h3>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-[rgba(246,239,225,0.55)]">
                      {club.description || admin.clubs.noDescription}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-[var(--padel-gold)]/30 bg-[var(--padel-gold)]/15 text-[var(--padel-gold-2)]">
                      {t('common.members', { count: club.members.length })}
                    </Badge>
                    <Button asChild size="sm" variant="outline" className={cn(softButtonClassName, 'rounded-md')}>
                      <Link href={`/clubs/${club.slug}`}>
                        <ExternalLink className="h-4 w-4" />
                        {admin.clubs.openPage}
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="red"
                      className="rounded-md"
                      onClick={() => {
                        setMemberForm({ email: '', roleTitle: '' });
                        setMemberClub(club);
                      }}
                    >
                      <Users className="h-4 w-4" />
                      {admin.clubs.addMember}
                    </Button>
                  </div>
                </div>

                {club.members.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {club.members.map((member) => (
                      <Badge
                        key={member.id}
                        className="border-[rgba(246,239,225,0.18)] bg-[rgba(246,239,225,0.05)] text-[rgba(246,239,225,0.75)]"
                      >
                        {member.user.fullName}
                        {member.roleTitle ? ` · ${member.roleTitle}` : ''}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            </SurfaceCard>
          </Reveal>
        ))}
      </div>

      <DashboardModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={admin.clubs.createClub}
        description={copy.createDescription}
        size="lg"
        footer={
          <ModalFormFooter
            formId="create-club-form"
            onCancel={() => setCreateOpen(false)}
            cancelLabel={t('common.cancel')}
            busy={busy === 'club'}
            submitLabel={busy === 'club' ? admin.messages.saving : admin.clubs.saveClub}
          />
        }
      >
        <form id="create-club-form" onSubmit={createClub} className="grid gap-4 sm:grid-cols-2">
          <DashboardField label={admin.clubs.clubName} id="club-name">
            <Input
              id="club-name"
              required
              value={clubForm.name}
              onChange={(event) => setClubForm((current) => ({ ...current, name: event.target.value }))}
              placeholder={admin.clubs.clubPlaceholder}
              className={formControlClassName}
            />
          </DashboardField>
          <DashboardField label={admin.clubs.slug} id="club-slug" hint={t('common.optional')}>
            <Input
              id="club-slug"
              value={clubForm.slug}
              onChange={(event) => setClubForm((current) => ({ ...current, slug: event.target.value }))}
              placeholder={admin.clubs.slugPlaceholder}
              className={formControlClassName}
            />
          </DashboardField>
          <DashboardField label={admin.clubs.logoUrl} id="club-logo" hint={t('common.optional')}>
            <Input
              id="club-logo"
              type="url"
              value={clubForm.logoUrl}
              onChange={(event) => setClubForm((current) => ({ ...current, logoUrl: event.target.value }))}
              placeholder={admin.clubs.logoPlaceholder}
              className={formControlClassName}
            />
          </DashboardField>
          <DashboardField label={admin.clubs.descriptionLabel} id="club-description" hint={t('common.optional')}>
            <Textarea
              id="club-description"
              value={clubForm.description}
              onChange={(event) => setClubForm((current) => ({ ...current, description: event.target.value }))}
              placeholder={admin.clubs.descriptionPlaceholder}
              className={formControlClassName}
            />
          </DashboardField>
        </form>
      </DashboardModal>

      <DashboardModal
        open={Boolean(memberClub)}
        onOpenChange={(open) => {
          if (!open) setMemberClub(null);
        }}
        title={copy.addMemberTitle}
        description={memberClub ? `${copy.addMemberModalDescription} · ${memberClub.name}` : copy.addMemberModalDescription}
        size="md"
        footer={
          <>
            <Button type="button" variant="outline" className={modalSoftButtonClassName} onClick={() => setMemberClub(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              form="add-member-form"
              variant="red"
              disabled={!memberClub || busy === `member-${memberClub.id}`}
            >
              <Users className="h-4 w-4" />
              {busy?.startsWith('member-') ? admin.messages.saving : admin.clubs.addMember}
            </Button>
          </>
        }
      >
        <form id="add-member-form" onSubmit={addClubMember} className="space-y-4">
          <DashboardField label={admin.clubs.memberEmail} id="member-email">
            <Input
              id="member-email"
              type="email"
              required
              value={memberForm.email}
              onChange={(event) => setMemberForm((current) => ({ ...current, email: event.target.value }))}
              placeholder={admin.clubs.userEmail}
              className={formControlClassName}
            />
          </DashboardField>
          <DashboardField label={admin.clubs.memberRole} id="member-role" hint={t('common.optional')}>
            <Input
              id="member-role"
              value={memberForm.roleTitle}
              onChange={(event) => setMemberForm((current) => ({ ...current, roleTitle: event.target.value }))}
              placeholder={admin.clubs.roleTitle}
              className={formControlClassName}
            />
          </DashboardField>
        </form>
      </DashboardModal>
    </AdminShell>
  );
}
