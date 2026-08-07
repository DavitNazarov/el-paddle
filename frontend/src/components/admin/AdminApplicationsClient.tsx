'use client';

import { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Mail, ShieldAlert, ThumbsDown, ThumbsUp } from 'lucide-react';
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
import { QueueMeter } from '@/components/shared/dashboard/DashboardSignals';
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
  APPLICATION_FACET_VALUES,
  applicantName,
  applicationQueue,
  applicationReader,
  awaitsDecision,
  emptyQuery,
  facetOptions,
  filterRows,
  mateName,
  type DirectoryQuery,
} from './directory/directoryModel';
import styles from './directory/Directory.module.css';
import type { ClubApplication, ClubApplicationMessage } from '@/types/auth';

/**
 * Club requests awaiting a decision — a directory that is also a queue, so it
 * leads with how much is actually decidable and spines the rows that are.
 * Approving materialises the account, club and teammate invite; rejecting
 * deletes the request outright, which is why the confirmation says the applicant
 * may re-apply with the same address.
 */
export function AdminApplicationsClient() {
  const { dictionary, locale, t } = useI18n();
  const admin = dictionary.dashboard.admin;
  const copy = admin.applicationsPage;
  const dir = tournamentCopy[locale].admin.directory;
  const appCopy = dir.applications;

  const [applications, setApplications] = useState<ClubApplication[]>([]);
  const [messages, setMessages] = useState<Record<string, ClubApplicationMessage[]>>({});
  const [query, setQuery] = useState<DirectoryQuery>(emptyQuery);
  const [rejectTarget, setRejectTarget] = useState<ClubApplication | null>(null);
  const [messageTarget, setMessageTarget] = useState<ClubApplication | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [messageForm, setMessageForm] = useState({ subject: '', body: '' });
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
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

  const visible = useMemo(() => filterRows(applications, query, applicationReader), [applications, query]);
  const queue = applicationQueue(applications);
  const facets = useMemo(
    () =>
      facetOptions(applications, query, applicationReader, APPLICATION_FACET_VALUES, (value) =>
        value === ALL_FACET ? dir.all : value === 'SUBMITTED' ? appCopy.ready : appCopy.unverified,
      ),
    [appCopy, applications, dir, query],
  );

  async function send(application: ClubApplication, path: string, body: unknown, success: string) {
    setError('');
    setFormError('');
    setNotice('');
    setBusy(application.id);
    const response = await apiFetch(path, {
      method: 'POST',
      ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(null);
    if (!response.ok) return result.error ?? admin.messages.actionFailed;
    setNotice(success);
    return null;
  }

  async function approve(application: ClubApplication) {
    const failure = await send(
      application,
      `/api/admin/club-applications/${application.id}/approve`,
      undefined,
      t('dashboard.admin.applicationsPage.approved', { email: application.email }),
    );
    if (failure) return setError(failure);
    await load();
  }

  async function reject() {
    if (!rejectTarget) return;
    const failure = await send(
      rejectTarget,
      `/api/admin/club-applications/${rejectTarget.id}/reject`,
      { reason: rejectReason },
      t('dashboard.admin.applicationsPage.rejected', { email: rejectTarget.email }),
    );
    if (failure) return setFormError(failure);
    setRejectTarget(null);
    setRejectReason('');
    await load();
  }

  async function sendMessage() {
    if (!messageTarget) return;
    const failure = await send(
      messageTarget,
      `/api/admin/club-applications/${messageTarget.id}/message`,
      messageForm,
      t('dashboard.admin.applicationsPage.messageSent', { email: messageTarget.email }),
    );
    if (failure) return setFormError(failure);
    await loadMessages(messageTarget);
    setMessageTarget(null);
    setMessageForm({ subject: '', body: '' });
  }

  const history = messageTarget ? messages[messageTarget.id] ?? [] : [];

  return (
    <AdminShell title={copy.title} description={copy.description} eyebrow={copy.eyebrow}>
      {notice ? <FeedbackBanner kind="success">{notice}</FeedbackBanner> : null}
      {error ? <FeedbackBanner kind="error">{error}</FeedbackBanner> : null}

      <SectionHeading title={copy.listTitle} description={copy.listDescription} />

      {/* How much of the queue can actually be acted on — the question this screen exists for. */}
      {loading ? null : (
        <div className={styles.meter}>
          <QueueMeter
            label={appCopy.queueLabel}
            done={queue.ready}
            total={queue.total}
            valueLabel={fillTemplate(dir.ofTotal, { done: queue.ready, total: queue.total })}
          />
        </div>
      )}

      <DirectoryToolbar
        id="applications"
        query={query}
        onQueryChange={setQuery}
        facets={facets}
        searchLabel={appCopy.search}
        countLabel={
          visible.length === applications.length
            ? fillTemplate(dir.total, { count: applications.length })
            : fillTemplate(dir.shown, { shown: visible.length, total: applications.length })
        }
      />

      <div className="mt-4">
        <DirectoryTable
          loading={loading}
          rows={visible}
          total={applications.length}
          icon={ClipboardCheck}
          loadingLabel={copy.loadingTitle}
          rowKey={(application) => application.id}
          rowAttention={awaitsDecision}
          minWidthClassName="min-w-[860px]"
          actionsHeader={tournamentCopy[locale].common.actions}
          actionsWidth="w-[150px] 2xl:w-[360px]"
          empty={{ title: copy.emptyTitle, description: copy.emptyDescription }}
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
              header: appCopy.columnClub,
              width: 'w-[26%]',
              cell: (application) => (
                <>
                  <span className={styles.primary} title={application.clubName}>
                    {application.clubName || copy.untitledClub}
                  </span>
                  {application.submittedAt ? (
                    <span className={styles.secondary}>{new Date(application.submittedAt).toLocaleDateString()}</span>
                  ) : null}
                </>
              ),
            },
            {
              key: 'applicant',
              header: appCopy.columnApplicant,
              width: 'w-[24%]',
              cell: (application) => (
                <>
                  <span className={styles.primary} title={applicantName(application)}>
                    {applicantName(application)}
                  </span>
                  <span className={styles.secondary} title={application.email}>
                    {application.email}
                  </span>
                  {/* Approving mints an ADMIN, not a player. The reviewer sees
                      an ordinary club request otherwise — say so before they act. */}
                  {application.grantsAdmin ? (
                    <span className="mt-1 inline-flex w-fit items-center gap-1 rounded border border-amber-500/45 bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900">
                      <ShieldAlert className="h-3 w-3 shrink-0" aria-hidden />
                      {appCopy.grantsAdmin}
                    </span>
                  ) : null}
                </>
              ),
            },
            {
              key: 'teammate',
              header: appCopy.columnTeammate,
              width: 'w-[22%]',
              cell: (application) =>
                application.mateEmail ? (
                  <span className={styles.secondary} title={application.mateEmail}>
                    {mateName(application)}
                  </span>
                ) : (
                  <span className={styles.faint}>{copy.noMate}</span>
                ),
            },
            {
              key: 'state',
              header: appCopy.columnState,
              width: 'w-[20%]',
              cell: (application) =>
                awaitsDecision(application) ? (
                  <Badge className="border-[rgba(168,103,18,0.25)] bg-[var(--dash-amber-soft)] text-[var(--dash-amber)]">
                    {appCopy.stateReady}
                  </Badge>
                ) : (
                  <>
                    <Badge className="border-[var(--dash-border)] bg-[#fdf9f7] text-[var(--dash-muted)]">
                      {appCopy.stateUnverified}
                    </Badge>
                    <p className={styles.note}>{appCopy.unverifiedNote}</p>
                  </>
                ),
            },
          ]}
          renderActions={(application) => (
            <>
              <Button
                size="sm"
                variant="outline"
                className={cn(softButtonClassName, rowActionClassName)}
                disabled={busy === application.id}
                aria-label={copy.sendEmail}
                title={copy.sendEmail}
                onClick={() => {
                  setMessageForm({ subject: '', body: '' });
                  setFormError('');
                  setMessageTarget(application);
                  void loadMessages(application);
                }}
              >
                <Mail className="h-4 w-4" />
                <span className="hidden 2xl:inline">{copy.sendEmail}</span>
              </Button>
              {/* The server refuses both decisions until the applicant has confirmed their
                  email, so neither control is offered before then. */}
              {awaitsDecision(application) ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className={cn(softButtonClassName, rowActionClassName)}
                    disabled={busy === application.id}
                    aria-label={copy.reject}
                    title={copy.reject}
                    onClick={() => {
                      setRejectReason('');
                      setFormError('');
                      setRejectTarget(application);
                    }}
                  >
                    <ThumbsDown className="h-4 w-4" />
                    <span className="hidden 2xl:inline">{copy.reject}</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="red"
                    className={rowActionClassName}
                    disabled={busy === application.id}
                    aria-label={copy.approve}
                    title={copy.approve}
                    onClick={() => void approve(application)}
                  >
                    <ThumbsUp className="h-4 w-4" />
                    <span className="hidden 2xl:inline">
                      {busy === application.id ? admin.messages.saving : copy.approve}
                    </span>
                  </Button>
                </>
              ) : null}
            </>
          )}
        />
      </div>

      <EditorModal
        open={Boolean(rejectTarget)}
        onOpenChange={(open) => {
          if (!open) setRejectTarget(null);
        }}
        title={copy.rejectTitle}
        description={copy.rejectDescription}
        formId="reject-application-form"
        size="md"
        busy={busy === rejectTarget?.id}
        error={formError}
        cancelLabel={t('common.cancel')}
        submitLabel={busy === rejectTarget?.id ? admin.messages.saving : copy.reject}
        onSubmit={() => void reject()}
      >
        <DashboardField id="reject-reason" label={copy.rejectReason}>
          <Textarea
            id="reject-reason"
            required
            rows={4}
            value={rejectReason}
            onChange={(fieldEvent) => setRejectReason(fieldEvent.target.value)}
            className={formControlClassName}
          />
        </DashboardField>
      </EditorModal>

      <EditorModal
        open={Boolean(messageTarget)}
        onOpenChange={(open) => {
          if (!open) setMessageTarget(null);
        }}
        title={copy.emailTitle}
        description={messageTarget ? t('dashboard.admin.applicationsPage.emailDescription', { email: messageTarget.email }) : ''}
        formId="message-application-form"
        busy={busy === messageTarget?.id}
        error={formError}
        cancelLabel={t('common.cancel')}
        submitLabel={busy === messageTarget?.id ? admin.messages.saving : copy.sendEmail}
        onSubmit={() => void sendMessage()}
      >
        <DashboardField id="message-subject" label={copy.emailSubject}>
          <Input
            id="message-subject"
            required
            value={messageForm.subject}
            onChange={(fieldEvent) => setMessageForm((form) => ({ ...form, subject: fieldEvent.target.value }))}
            className={formControlClassName}
          />
        </DashboardField>
        <DashboardField id="message-body" label={copy.emailBody}>
          <Textarea
            id="message-body"
            required
            rows={8}
            value={messageForm.body}
            onChange={(fieldEvent) => setMessageForm((form) => ({ ...form, body: fieldEvent.target.value }))}
            className={formControlClassName}
          />
        </DashboardField>
        {/* What has already been said, so the admin does not repeat themselves. */}
        {history.length ? (
          <div>
            <p className="dash-kicker">{fillTemplate(appCopy.messagesSent, { count: history.length })}</p>
            {history.map((item) => (
              <p key={item.id} className={styles.note}>
                <span className="font-semibold text-[var(--dash-text)]">{item.subject}</span>
                {' · '}
                {new Date(item.sentAt).toLocaleString()}
              </p>
            ))}
          </div>
        ) : null}
      </EditorModal>
    </AdminShell>
  );
}
