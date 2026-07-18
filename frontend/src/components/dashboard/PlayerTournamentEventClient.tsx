'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { apiFetch, createCommandId } from '@/lib/api';
import type { PublicUser } from '@/types/auth';
import type { DashboardData, EventDto, RegistrationDto } from '@/types/dashboard';
import type { BracketDto, CourtDto, OpponentRequestDto } from '@/types/tournament';
import { PlayerShell } from './PlayerShell';
import { BackLink, CommandButton, EmptyTournamentState, InlineNotice, KeyValueGrid, StatusLabel, TournamentPanel, TournamentSectionHeader } from '@/components/tournament/TournamentUI';
import { Textarea } from '@/components/ui/textarea';
import { DashboardField, DashboardModal, formControlClassName, selectControlClassName } from '@/components/shared/dashboard/DashboardUI';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy, tournamentRound, tournamentStatus } from '@/lib/i18n/tournament';

type EligibleEntry = { id: string; owner: { fullName: string }; teammate: { fullName: string } };

export function PlayerTournamentEventClient({ eventId, initialUser }: { eventId: string; initialUser: PublicUser }) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale];
  const [event, setEvent] = useState<EventDto | null>(null);
  const [entries, setEntries] = useState<RegistrationDto[]>([]);
  const [requests, setRequests] = useState<OpponentRequestDto[]>([]);
  const [brackets, setBrackets] = useState<BracketDto[]>([]);
  const [courts, setCourts] = useState<CourtDto[]>([]);
  const [eligible, setEligible] = useState<EligibleEntry[]>([]);
  const [form, setForm] = useState({ requestingEntryId: '', targetEntryId: '', message: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [eligibleLoadedFor, setEligibleLoadedFor] = useState('');
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestDecision, setRequestDecision] = useState<{ request: OpponentRequestDto; action: 'accept' | 'refuse' | 'withdraw' } | null>(null);
  const [decisionReason, setDecisionReason] = useState('');

  const fetchEligible = useCallback(async (entryId: string) => {
    setError('');
    const response = await apiFetch(`/api/events/${eventId}/eligible-opponents?requestingEntryId=${encodeURIComponent(entryId)}`, { cache: 'no-store' });
    const data = await response.json() as { entries?: EligibleEntry[]; error?: string };
    setEligibleLoadedFor(entryId);
    if (!response.ok) setError(data.error ?? copy.playerEvent.choicesUnavailable);
    else setEligible(data.entries ?? []);
  }, [copy.playerEvent.choicesUnavailable, eventId]);

  const load = useCallback(async () => {
    const [dashboardResponse, requestResponse, bracketResponse, scheduleResponse] = await Promise.all([apiFetch('/api/dashboard', { cache: 'no-store' }), apiFetch(`/api/events/${eventId}/opponent-request-state`, { cache: 'no-store' }), apiFetch(`/api/events/${eventId}/brackets`, { cache: 'no-store' }), apiFetch(`/api/public/events/${eventId}/schedule`, { cache: 'no-store' })]);
    const dashboard = await dashboardResponse.json() as DashboardData;
    const requestData = await requestResponse.json() as { requests?: OpponentRequestDto[]; error?: string };
    const bracketData = await bracketResponse.json() as { brackets?: BracketDto[] };
    const scheduleData = await scheduleResponse.json() as { courts?: CourtDto[] };
    if (!dashboardResponse.ok) setError(copy.playerEvent.loadError);
    else {
      const found = dashboard.events.find((item) => item.id === eventId) ?? null;
      setEvent(found);
      const eventEntries = dashboard.registrations.filter((entry) => entry.event.id === eventId);
      setEntries(eventEntries);
      setRequests(requestData.requests ?? []);
      setBrackets(bracketData.brackets ?? []);
      setCourts(scheduleData.courts ?? []);
      const defaultEntryId = eventEntries.find((entry) => entry.status === 'APPROVED')?.id || '';
      setForm((current) => ({ ...current, requestingEntryId: current.requestingEntryId || defaultEntryId }));
      if (defaultEntryId) void fetchEligible(defaultEntryId);
    }
  }, [copy.playerEvent.loadError, eventId, fetchEligible]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const ownEntryIds = useMemo(() => new Set(entries.map((entry) => entry.id)), [entries]);
  const received = requests.filter((request) => ownEntryIds.has(request.targetEntryId));
  const sent = requests.filter((request) => ownEntryIds.has(request.requestingEntryId));
  const approvedEntries = entries.filter((entry) => entry.status === 'APPROVED');
  const eligibleLoading = Boolean(
    form.requestingEntryId && eligibleLoadedFor !== form.requestingEntryId,
  );

  function selectEntry(entryId: string) {
    setForm((current) => ({ ...current, requestingEntryId: entryId, targetEntryId: '' }));
    setEligible([]);
    setEligibleLoadedFor('');
    if (entryId) void fetchEligible(entryId);
  }

  async function sendRequest() {
    if (!form.requestingEntryId || !form.targetEntryId) return;
    setBusy('send'); setError('');
    const response = await apiFetch(`/api/events/${eventId}/opponent-requests`, { method: 'POST', body: JSON.stringify({ ...form, commandId: createCommandId('opponent-request') }) });
    const data = await response.json() as { error?: string };
    setBusy(''); if (!response.ok) setError(data.error ?? copy.playerEvent.sendError); else { setEligible([]); setForm((current) => ({ ...current, targetEntryId: '', message: '' })); setRequestModalOpen(false); void load(); }
  }

  async function respond(request: OpponentRequestDto, action: 'accept' | 'refuse') {
    const reason = action === 'refuse' ? decisionReason.trim() : '';
    setBusy(`${action}-${request.id}`); setError('');
    const response = await apiFetch(`/api/events/${eventId}/opponent-requests/${request.id}/${action}`, { method: 'POST', body: JSON.stringify({ reason, expectedVersion: request.version, commandId: createCommandId(`opponent-${action}`) }) });
    const data = await response.json() as { error?: string };
    setBusy(''); if (!response.ok) setError(data.error ?? copy.playerEvent.sendError); else { setRequestDecision(null); setDecisionReason(''); void load(); }
  }

  async function withdraw(request: OpponentRequestDto) {
    setBusy(`withdraw-${request.id}`); setError('');
    const response = await apiFetch(`/api/events/${eventId}/opponent-requests/${request.id}`, { method: 'DELETE', body: JSON.stringify({ expectedVersion: request.version, commandId: createCommandId('opponent-withdraw') }) });
    const data = await response.json() as { error?: string };
    setBusy(''); if (!response.ok) setError(data.error ?? copy.playerEvent.withdrawError); else { setRequestDecision(null); void load(); }
  }

  function openRequestDecision(request: OpponentRequestDto, action: 'accept' | 'refuse' | 'withdraw') {
    setRequestDecision({ request, action });
    setDecisionReason('');
  }

  return (
    <PlayerShell user={initialUser} title={event?.title ?? copy.playerEvent.event} description={copy.playerEvent.description} eyebrow={copy.playerEvent.eyebrow}>
      <div className="mb-4"><BackLink href="/dashboard/events">{copy.playerEvent.allEvents}</BackLink></div>
      {error ? <div className="mb-4"><InlineNotice kind="error">{error}</InlineNotice></div> : null}
      {event ? <KeyValueGrid items={[{ label: copy.playerEvent.lifecycle, value: tournamentStatus(locale, event.status) }, { label: copy.common.date, value: formatDate(event.date, { dateStyle: 'long', timeStyle: 'short' }) }, { label: copy.common.location, value: event.location }, { label: copy.playerEvent.yourEntry, value: entries[0] ? tournamentStatus(locale, entries[0].status) : copy.playerEvent.notRegistered }]} /> : null}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <TournamentPanel>
          <TournamentSectionHeader title={copy.playerEvent.chooseOpponent} description={copy.playerEvent.chooseDescription} actions={<CommandButton tone="primary" disabled={!approvedEntries.length} onClick={() => setRequestModalOpen(true)}><Plus />{copy.playerEvent.newRequest}</CommandButton>} />
          <div className="px-5 py-4 text-sm leading-6 text-[rgba(213,201,177,0.65)]">
            {approvedEntries.length ? (approvedEntries.length === 1 ? copy.playerEvent.readyOne : fillTemplate(copy.playerEvent.readyMany, { count: approvedEntries.length })) : copy.playerEvent.approvalRequired}
          </div>
        </TournamentPanel>
        <TournamentPanel>
          <TournamentSectionHeader title={copy.playerEvent.received} description={copy.playerEvent.receivedDescription} />
          {received.length ? <div className="divide-y divide-[rgba(213,201,177,0.08)]">{received.map((request) => <RequestRow key={request.id} request={request} side="received" busy={busy} onAccept={() => openRequestDecision(request, 'accept')} onRefuse={() => openRequestDecision(request, 'refuse')} />)}</div> : <EmptyTournamentState title={copy.playerEvent.noReceived} />}
        </TournamentPanel>
      </div>
      <TournamentPanel className="mt-5">
        <TournamentSectionHeader title={copy.playerEvent.sent} />
        {sent.length ? <div className="divide-y divide-[rgba(213,201,177,0.08)]">{sent.map((request) => <RequestRow key={request.id} request={request} side="sent" busy={busy} onWithdraw={() => openRequestDecision(request, 'withdraw')} />)}</div> : <EmptyTournamentState title={copy.playerEvent.noSent} />}
      </TournamentPanel>
      <TournamentPanel className="mt-5"><TournamentSectionHeader title={copy.playerEvent.publishedBracket} />{brackets.length ? <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">{brackets.flatMap((bracket) => bracket.matches).map((match) => <div key={match.id} className="rounded-lg border border-[rgba(213,201,177,0.12)] p-3"><p className="text-xs text-[rgba(213,201,177,0.5)]">{tournamentRound(locale, match.round)} · {copy.common.match} {match.matchNumber}</p><p className="mt-2 text-sm font-medium text-[var(--padel-ivory)]">{match.participantA?.owner.fullName ?? copy.common.tbd} {copy.common.versus} {match.participantB?.owner.fullName ?? copy.common.tbd}</p>{match.status === 'COMPLETED' || match.status === 'IN_PROGRESS' ? <p className="mt-2 font-mono text-lg">{match.scoreA}–{match.scoreB}</p> : null}</div>)}</div> : <EmptyTournamentState title={copy.playerEvent.bracketUnavailable} />}</TournamentPanel>
      <TournamentPanel className="mt-5"><TournamentSectionHeader title={copy.playerEvent.publishedSchedule} />{courts.length ? <div className="divide-y divide-[rgba(213,201,177,0.08)]">{courts.flatMap((court) => court.scheduleItems.map((item) => <div key={item.id} className="flex justify-between gap-3 px-5 py-4 text-sm"><div><p className="font-semibold text-[var(--padel-ivory)]">{court.name} · {copy.common.match} {item.match.matchNumber}</p><p className="mt-1 text-[rgba(213,201,177,0.55)]">{item.plannedStartAt ? formatDate(item.plannedStartAt, { dateStyle: 'medium', timeStyle: 'short' }) : copy.publicEvent.timeTbc}</p></div><StatusLabel>{tournamentStatus(locale, item.status)}</StatusLabel></div>))}</div> : <EmptyTournamentState title={copy.playerEvent.scheduleUnavailable} />}</TournamentPanel>

      <DashboardModal
        open={requestModalOpen}
        onOpenChange={(open) => { if (!busy) setRequestModalOpen(open); }}
        title={copy.playerEvent.chooseOpponent}
        description={copy.playerEvent.modalDescription}
        footer={
          <ModalFormFooter
            formId="opponent-request-form"
            onCancel={() => setRequestModalOpen(false)}
            cancelLabel={copy.common.cancel}
            busy={busy === 'send'}
            disabled={!form.requestingEntryId || !form.targetEntryId || eligibleLoading}
            submitLabel={busy === 'send' ? copy.playerEvent.sending : copy.playerEvent.send}
          />
        }
      >
        <form
          id="opponent-request-form"
          className="grid gap-5"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            void sendRequest();
          }}
        >
          {error ? (
            <div role="alert" className="rounded-lg border border-[#e6b9b6] bg-[#fff5f4] px-3.5 py-3 text-sm leading-5 text-[#9f332d]">
              {error}
            </div>
          ) : null}
          <DashboardField id="own-entry" label={copy.playerEvent.competitionEntry}>
            <select id="own-entry" className={selectControlClassName} value={form.requestingEntryId} onChange={(event) => selectEntry(event.target.value)} disabled={busy === 'send'}><option value="">{copy.playerEvent.selectEntry}</option>{approvedEntries.map((entry) => <option key={entry.id} value={entry.id}>{entry.owner.fullName} / {entry.teammate.fullName} · {entry.category.name}</option>)}</select>
          </DashboardField>
          <DashboardField id="opponent-entry" label={copy.playerEvent.eligibleOpponent} hint={copy.playerEvent.eligibleHint}>
            <select
              id="opponent-entry"
              className={selectControlClassName}
              value={form.targetEntryId}
              onChange={(event) => setForm((current) => ({ ...current, targetEntryId: event.target.value }))}
              disabled={!form.requestingEntryId || eligibleLoading || busy === 'send'}
              aria-busy={eligibleLoading}
            >
              <option value="">{eligible.length ? copy.playerEvent.selectOpponent : eligibleLoading ? copy.playerEvent.loadingOpponents : copy.playerEvent.noOpponents}</option>
              {eligible.map((entry) => <option key={entry.id} value={entry.id}>{entry.owner.fullName} / {entry.teammate.fullName}</option>)}
            </select>
          </DashboardField>
          <DashboardField id="request-message" label={copy.playerEvent.message} hint={copy.playerEvent.messageHint}>
            <Textarea
              id="request-message"
              value={form.message}
              onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
              placeholder={copy.playerEvent.messagePlaceholder}
              className={cn(formControlClassName, 'min-h-28 resize-y leading-6')}
              disabled={busy === 'send'}
              rows={4}
            />
          </DashboardField>
        </form>
      </DashboardModal>

      <DashboardModal
        open={Boolean(requestDecision)}
        onOpenChange={(open) => { if (!open && !busy) setRequestDecision(null); }}
        title={requestDecision?.action === 'accept' ? copy.playerEvent.acceptTitle : requestDecision?.action === 'refuse' ? copy.playerEvent.refuseTitle : copy.playerEvent.withdrawTitle}
        description={copy.playerEvent.reviewAction}
        size="md"
        footer={
          <ModalFormFooter
            onCancel={() => setRequestDecision(null)}
            cancelLabel={copy.common.cancel}
            submitType="button"
            onSubmitClick={() => {
              if (!requestDecision) return;
              if (requestDecision.action === 'withdraw') void withdraw(requestDecision.request);
              else void respond(requestDecision.request, requestDecision.action);
            }}
            busy={Boolean(requestDecision && busy === `${requestDecision.action}-${requestDecision.request.id}`)}
            submitLabel={requestDecision?.action === 'accept' ? copy.playerEvent.acceptRequest : requestDecision?.action === 'refuse' ? copy.playerEvent.refuseRequest : copy.playerEvent.withdrawRequest}
            submitVariant={requestDecision?.action === 'accept' ? 'red' : 'destructive'}
          />
        }
      >
        {requestDecision?.action === 'refuse' ? (
          <DashboardField id="response-reason" label={copy.playerEvent.publicReason} hint={copy.playerEvent.publicReasonHint}>
            <Textarea id="response-reason" value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} className={cn(formControlClassName, 'min-h-28 resize-y leading-6')} rows={4} />
          </DashboardField>
        ) : (
          <p className="text-sm leading-6 text-[rgba(88,16,16,0.72)]">{requestDecision?.action === 'accept' ? copy.playerEvent.acceptNote : copy.playerEvent.withdrawNote}</p>
        )}
      </DashboardModal>
    </PlayerShell>
  );
}

function RequestRow({ request, side, busy, onAccept, onRefuse, onWithdraw }: { request: OpponentRequestDto; side: 'sent' | 'received'; busy: string; onAccept?: () => void; onRefuse?: () => void; onWithdraw?: () => void }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const other = side === 'sent' ? request.targetEntry : request.requestingEntry;
  return <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-[var(--padel-ivory)]">{other.owner.fullName} / {other.teammate.fullName}</p><div className="mt-2"><StatusLabel icon={request.status.includes('REFUSED') ? 'warning' : request.status.includes('APPROVED') || request.status.includes('APPLIED') ? 'check' : 'dot'}>{tournamentStatus(locale, request.status)}</StatusLabel></div>{request.responseReason || request.adminPublicReason ? <p className="mt-2 text-sm text-[rgba(213,201,177,0.58)]">{request.responseReason || request.adminPublicReason}</p> : null}</div><div className="flex flex-wrap gap-2">{side === 'received' && request.status === 'PENDING_RESPONSE' ? <><CommandButton size="sm" busy={busy === `accept-${request.id}`} onClick={onAccept}>{copy.playerEvent.accept}</CommandButton><CommandButton size="sm" busy={busy === `refuse-${request.id}`} onClick={onRefuse}>{copy.playerEvent.refuse}</CommandButton></> : null}{side === 'sent' && ['PENDING_RESPONSE', 'ACCEPTED_BY_OPPONENT'].includes(request.status) ? <CommandButton size="sm" busy={busy === `withdraw-${request.id}`} onClick={onWithdraw}>{copy.playerEvent.withdraw}</CommandButton> : null}</div></div>;
}
