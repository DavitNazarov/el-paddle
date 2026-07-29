'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ClipboardCheck, Mail, ThumbsDown, ThumbsUp } from 'lucide-react';
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
} from '@/components/shared/dashboard/DashboardUI';
import { Reveal } from '@/components/padel/home/motion';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/shared/I18nProvider';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import { AdminShell } from './AdminShell';
import type { ClubApplication, ClubApplicationMessage } from '@/types/auth';

/**
 * Club requests awaiting a decision. Approving materialises the account, club
 * and teammate invite; rejecting deletes the request outright, which is why the
 * confirmation says the applicant may re-apply with the same address.
 */
export function AdminApplicationsClient() {
  const { dictionary, t } = useI18n();
  const admin = dictionary.dashboard.admin;
  const copy = admin.applicationsPage;

  const [applications, setApplications] = useState<ClubApplication[]>([]);
  const [messages, setMessages] = useState<Record<string, ClubApplicationMessage[]>>({});
  const [rejectTarget, setRejectTarget] = useState<ClubApplication | null>(null);
  const [messageTarget, setMessageTarget] = useState<ClubApplication | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [messageForm, setMessageForm] = useState({ subject: '', body: '' });
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const response = await apiFetch('/api/admin/club-applications', { cache: 'no-store' });
    const data = (await response.json()) as { applications?: ClubApplication[] };
    setApplications(data.applications ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function loadMessages(application: ClubApplication) {
    const response = await apiFetch(`/api/admin/club-applications/${application.id}`, { cache: 'no-store' });
    if (!response.ok) return;
    const data = (await response.json()) as { messages?: ClubApplicationMessage[] };
    setMessages((current) => ({ ...current, [application.id]: data.messages ?? [] }));
  }

  async function approve(application: ClubApplication) {
    setError('');
    setNotice('');
    setBusy(application.id);
    const response = await apiFetch(`/api/admin/club-applications/${application.id}/approve`, {
      method: 'POST',
    });
    const result = (await response.json()) as { error?: string; mateInvited?: boolean };
    setBusy(null);
    if (!response.ok) {
      setError(result.error ?? admin.messages.actionFailed);
      return;
    }
    setNotice(t('dashboard.admin.applicationsPage.approved', { email: application.email }));
    await load();
  }

  async function reject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rejectTarget) return;
    setError('');
    setNotice('');
    setBusy(rejectTarget.id);
    const response = await apiFetch(`/api/admin/club-applications/${rejectTarget.id}/reject`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: rejectReason }),
    });
    const result = (await response.json()) as { error?: string };
    setBusy(null);
    if (!response.ok) {
      setError(result.error ?? admin.messages.actionFailed);
      return;
    }
    setNotice(t('dashboard.admin.applicationsPage.rejected', { email: rejectTarget.email }));
    setRejectTarget(null);
    setRejectReason('');
    await load();
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!messageTarget) return;
    setError('');
    setNotice('');
    setBusy(messageTarget.id);
    const response = await apiFetch(`/api/admin/club-applications/${messageTarget.id}/message`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(messageForm),
    });
    const result = (await response.json()) as { error?: string };
    setBusy(null);
    if (!response.ok) {
      setError(result.error ?? admin.messages.actionFailed);
      return;
    }
    setNotice(t('dashboard.admin.applicationsPage.messageSent', { email: messageTarget.email }));
    await loadMessages(messageTarget);
    setMessageTarget(null);
    setMessageForm({ subject: '', body: '' });
  }

  return (
    <AdminShell title={copy.title} description={copy.description} eyebrow={copy.eyebrow}>
      {notice ? <FeedbackBanner kind="success">{notice}</FeedbackBanner> : null}
      {error ? <FeedbackBanner kind="error">{error}</FeedbackBanner> : null}

      <SectionHeading title={copy.listTitle} description={copy.listDescription} />
      <div className="mt-4 grid gap-4">
        {loading ? <EmptyState title={copy.loadingTitle} description={copy.loadingDescription} icon={ClipboardCheck} /> : null}
        {!loading && !applications.length ? (
          <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} icon={ClipboardCheck} />
        ) : null}

        {applications.map((application, index) => (
          <Reveal key={application.id} delay={Math.min(index * 0.04, 0.2)}>
            <SurfaceCard>
              <div className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="font-display text-xl font-semibold text-[var(--padel-ivory)]">
                      {application.clubName || copy.untitledClub}
                    </h3>
                    <p className="mt-2 text-sm text-[rgba(213,201,177,0.75)]">
                      {[application.name, application.surname].filter(Boolean).join(' ')} · {application.email}
                    </p>
                    {application.phone ? (
                      <p className="mt-1 text-sm text-[rgba(213,201,177,0.55)]">{application.phone}</p>
                    ) : null}
                    {application.clubDescription ? (
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-[rgba(213,201,177,0.55)]">
                        {application.clubDescription}
                      </p>
                    ) : null}
                    <p className="mt-3 text-sm text-[rgba(213,201,177,0.55)]">
                      {application.mateEmail
                        ? t('dashboard.admin.applicationsPage.withMate', {
                            name: [application.mateName, application.mateSurname].filter(Boolean).join(' ') || application.mateEmail,
                            email: application.mateEmail,
                          })
                        : copy.noMate}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {application.submittedAt ? (
                      <Badge className="border-[rgba(213,201,177,0.18)] bg-[rgba(213,201,177,0.05)] text-[rgba(213,201,177,0.75)]">
                        {new Date(application.submittedAt).toLocaleDateString()}
                      </Badge>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      className={cn(softButtonClassName, 'rounded-md')}
                      disabled={busy === application.id}
                      onClick={() => {
                        setMessageForm({ subject: '', body: '' });
                        setMessageTarget(application);
                        void loadMessages(application);
                      }}
                    >
                      <Mail className="h-4 w-4" />
                      {copy.sendEmail}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={cn(softButtonClassName, 'rounded-md')}
                      disabled={busy === application.id}
                      onClick={() => {
                        setRejectReason('');
                        setRejectTarget(application);
                      }}
                    >
                      <ThumbsDown className="h-4 w-4" />
                      {copy.reject}
                    </Button>
                    <Button
                      size="sm"
                      variant="red"
                      className="rounded-md"
                      disabled={busy === application.id}
                      onClick={() => void approve(application)}
                    >
                      <ThumbsUp className="h-4 w-4" />
                      {busy === application.id ? admin.messages.saving : copy.approve}
                    </Button>
                  </div>
                </div>

                {messages[application.id]?.length ? (
                  <div className="mt-4 grid gap-2 border-t border-[rgba(213,201,177,0.12)] pt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgba(213,201,177,0.45)]">
                      {copy.messageHistory}
                    </p>
                    {messages[application.id].map((item) => (
                      <p key={item.id} className="text-sm text-[rgba(213,201,177,0.65)]">
                        <span className="font-semibold text-[rgba(213,201,177,0.85)]">{item.subject}</span>
                        {' · '}
                        {new Date(item.sentAt).toLocaleString()}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            </SurfaceCard>
          </Reveal>
        ))}
      </div>

      <DashboardModal
        open={Boolean(rejectTarget)}
        onOpenChange={(open) => !open && setRejectTarget(null)}
        title={copy.rejectTitle}
        description={copy.rejectDescription}
        footer={
          <ModalFormFooter
            formId="reject-application-form"
            onCancel={() => setRejectTarget(null)}
            cancelLabel={t('common.cancel')}
            busy={busy === rejectTarget?.id}
            submitLabel={busy === rejectTarget?.id ? admin.messages.saving : copy.reject}
          />
        }
      >
        <form id="reject-application-form" onSubmit={reject} className="grid gap-4">
          <DashboardField id="reject-reason" label={copy.rejectReason}>
            <Textarea
              id="reject-reason"
              required
              rows={4}
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              className={formControlClassName}
            />
          </DashboardField>
        </form>
      </DashboardModal>

      <DashboardModal
        open={Boolean(messageTarget)}
        onOpenChange={(open) => !open && setMessageTarget(null)}
        title={copy.emailTitle}
        description={messageTarget ? t('dashboard.admin.applicationsPage.emailDescription', { email: messageTarget.email }) : ''}
        size="lg"
        footer={
          <ModalFormFooter
            formId="message-application-form"
            onCancel={() => setMessageTarget(null)}
            cancelLabel={t('common.cancel')}
            busy={busy === messageTarget?.id}
            submitLabel={busy === messageTarget?.id ? admin.messages.saving : copy.sendEmail}
          />
        }
      >
        <form id="message-application-form" onSubmit={sendMessage} className="grid gap-4">
          <DashboardField id="message-subject" label={copy.emailSubject}>
            <Input
              id="message-subject"
              required
              value={messageForm.subject}
              onChange={(event) => setMessageForm((form) => ({ ...form, subject: event.target.value }))}
              className={formControlClassName}
            />
          </DashboardField>
          <DashboardField id="message-body" label={copy.emailBody}>
            <Textarea
              id="message-body"
              required
              rows={8}
              value={messageForm.body}
              onChange={(event) => setMessageForm((form) => ({ ...form, body: event.target.value }))}
              className={formControlClassName}
            />
          </DashboardField>
        </form>
      </DashboardModal>
    </AdminShell>
  );
}
