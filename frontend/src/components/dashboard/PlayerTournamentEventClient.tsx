'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { apiFetch, createCommandId } from '@/lib/api';
import type { PublicUser } from '@/types/auth';
import type { DashboardData, EventDto, RegistrationDto } from '@/types/dashboard';
import type { BracketDto, CourtDto, OpponentRequestDto } from '@/types/tournament';
import { PlayerShell } from './PlayerShell';
import { PlayerEntryCard } from './PlayerEntryCard';
import {
  BackLink,
  CommandButton,
  EmptyTournamentState,
  InlineNotice,
  TournamentPanel,
  TournamentSectionHeader,
} from '@/components/tournament/TournamentUI';
import { Textarea } from '@/components/ui/textarea';
import { DashboardField, DashboardModal, formControlClassName, selectControlClassName } from '@/components/shared/dashboard/DashboardUI';
import { SkeletonCards } from '@/components/shared/dashboard/Feedback';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/shared/I18nProvider';
import { tournamentCopy } from '@/lib/i18n/tournament';
import {
  PlayerMatchPanel,
  RequestPanel,
  playerEventPageClassName,
  playerNoteClassName,
  requestsGridClassName,
} from './event/PlayerEventSections';
import {
  approvedEntries as approvedOf,
  ownEntryIds,
  playerMatches,
  receivedRequests,
  sentRequests,
} from './event/playerEventModel';

type EligibleEntry = { id: string; owner: { fullName: string }; teammate: { fullName: string } };

/**
 * A player's own page for one event, in the order they ask: am I in (their
 * entry path), who am I playing (their opponent requests), when do I play
 * (their matches). The bracket and schedule as a whole belong to the public
 * event page — a competitor only needs their own row of each.
 */
export function PlayerTournamentEventClient({ eventId, initialUser }: { eventId: string; initialUser: PublicUser }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const player = copy.playerEvent;

  const [event, setEvent] = useState<EventDto | null>(null);
  const [entries, setEntries] = useState<RegistrationDto[]>([]);
  const [requests, setRequests] = useState<OpponentRequestDto[]>([]);
  const [brackets, setBrackets] = useState<BracketDto[]>([]);
  const [courts, setCourts] = useState<CourtDto[]>([]);
  const [eligible, setEligible] = useState<EligibleEntry[]>([]);
  const [form, setForm] = useState({ requestingEntryId: '', targetEntryId: '', message: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [eligibleLoadedFor, setEligibleLoadedFor] = useState('');
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestDecision, setRequestDecision] = useState<{ request: OpponentRequestDto; action: 'accept' | 'refuse' | 'withdraw' } | null>(null);
  const [decisionReason, setDecisionReason] = useState('');

  const fetchEligible = useCallback(async (entryId: string) => {
    setError('');
    const response = await apiFetch(`/api/events/${eventId}/eligible-opponents?requestingEntryId=${encodeURIComponent(entryId)}`, { cache: 'no-store' });
    const data = await response.json() as { entries?: EligibleEntry[]; error?: string };
    setEligibleLoadedFor(entryId);
    if (!response.ok) setError(data.error ?? player.choicesUnavailable);
    else setEligible(data.entries ?? []);
  }, [player.choicesUnavailable, eventId]);

  const load = useCallback(async () => {
    const [dashboardResponse, requestResponse, bracketResponse, scheduleResponse] = await Promise.all([
      apiFetch('/api/dashboard', { cache: 'no-store' }),
      apiFetch(`/api/events/${eventId}/opponent-request-state`, { cache: 'no-store' }),
      apiFetch(`/api/events/${eventId}/brackets`, { cache: 'no-store' }),
      apiFetch(`/api/public/events/${eventId}/schedule`, { cache: 'no-store' }),
    ]);
    const dashboard = await dashboardResponse.json() as DashboardData;
    const requestData = await requestResponse.json() as { requests?: OpponentRequestDto[]; error?: string };
    const bracketData = await bracketResponse.json() as { brackets?: BracketDto[] };
    const scheduleData = await scheduleResponse.json() as { courts?: CourtDto[] };
    if (!dashboardResponse.ok) setError(player.loadError);
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
    setLoading(false);
  }, [player.loadError, eventId, fetchEligible]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const mine = useMemo(() => ownEntryIds(entries), [entries]);
  const received = useMemo(() => receivedRequests(requests, mine), [mine, requests]);
  const sent = useMemo(() => sentRequests(requests, mine), [mine, requests]);
  const matches = useMemo(() => playerMatches(brackets, courts, mine), [brackets, courts, mine]);
  const approvedEntries = approvedOf(entries);
  const eligibleLoading = Boolean(form.requestingEntryId && eligibleLoadedFor !== form.requestingEntryId);

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
    setBusy('');
    if (!response.ok) setError(data.error ?? player.sendError);
    else { setEligible([]); setForm((current) => ({ ...current, targetEntryId: '', message: '' })); setRequestModalOpen(false); void load(); }
  }

  async function respond(request: OpponentRequestDto, action: 'accept' | 'refuse') {
    const reason = action === 'refuse' ? decisionReason.trim() : '';
    setBusy(`${action}-${request.id}`); setError('');
    const response = await apiFetch(`/api/events/${eventId}/opponent-requests/${request.id}/${action}`, { method: 'POST', body: JSON.stringify({ reason, expectedVersion: request.version, commandId: createCommandId(`opponent-${action}`) }) });
    const data = await response.json() as { error?: string };
    setBusy('');
    if (!response.ok) setError(data.error ?? player.sendError);
    else { setRequestDecision(null); setDecisionReason(''); void load(); }
  }

  async function withdraw(request: OpponentRequestDto) {
    setBusy(`withdraw-${request.id}`); setError('');
    const response = await apiFetch(`/api/events/${eventId}/opponent-requests/${request.id}`, { method: 'DELETE', body: JSON.stringify({ expectedVersion: request.version, commandId: createCommandId('opponent-withdraw') }) });
    const data = await response.json() as { error?: string };
    setBusy('');
    if (!response.ok) setError(data.error ?? player.withdrawError);
    else { setRequestDecision(null); void load(); }
  }

  function openRequestDecision(request: OpponentRequestDto, action: 'accept' | 'refuse' | 'withdraw') {
    setRequestDecision({ request, action });
    setDecisionReason('');
  }

  return (
    <PlayerShell user={initialUser} title={event?.title ?? player.event} description={player.description} eyebrow={player.eyebrow}>
      <div className="mb-4"><BackLink href="/dashboard/events">{player.allEvents}</BackLink></div>
      {error ? <div className="mb-4"><InlineNotice kind="error">{error}</InlineNotice></div> : null}

      <div className={playerEventPageClassName}>
        {/* Am I in? The entry path, in the same vocabulary as the player home. */}
        {loading ? (
          <SkeletonCards count={1} columns={2} label={copy.common.loading} />
        ) : entries.length ? (
          entries.map((entry) => (
            <PlayerEntryCard key={entry.id} registration={entry} ownershipLabel={entry.category.name} />
          ))
        ) : (
          <TournamentPanel>
            <EmptyTournamentState title={player.noEntryTitle} detail={player.noEntryDetail} />
          </TournamentPanel>
        )}

        {/* Who am I playing? */}
        <div className={requestsGridClassName}>
          <RequestPanel
            title={player.received}
            description={player.receivedDescription}
            side="received"
            requests={received}
            busy={busy}
            emptyTitle={player.noReceived}
            onAccept={(request) => openRequestDecision(request, 'accept')}
            onRefuse={(request) => openRequestDecision(request, 'refuse')}
          />
          <RequestPanel
            title={player.sent}
            side="sent"
            requests={sent}
            busy={busy}
            emptyTitle={player.noSent}
            onWithdraw={(request) => openRequestDecision(request, 'withdraw')}
            actions={
              <CommandButton tone="primary" disabled={!approvedEntries.length} onClick={() => setRequestModalOpen(true)}>
                <Plus aria-hidden="true" />
                {player.newRequest}
              </CommandButton>
            }
          />
        </div>

        {approvedEntries.length ? null : (
          <TournamentPanel>
            <TournamentSectionHeader title={player.chooseOpponent} description={player.chooseDescription} />
            <p className={playerNoteClassName}>{player.approvalRequired}</p>
          </TournamentPanel>
        )}

        {/* When do I play? */}
        <PlayerMatchPanel matches={matches} emptyTitle={player.noMatches} emptyDetail={player.noMatchesDetail} />
      </div>

      <DashboardModal
        open={requestModalOpen}
        onOpenChange={(open) => { if (!busy) setRequestModalOpen(open); }}
        title={player.chooseOpponent}
        description={player.modalDescription}
        footer={
          <ModalFormFooter
            formId="opponent-request-form"
            onCancel={() => setRequestModalOpen(false)}
            cancelLabel={copy.common.cancel}
            busy={busy === 'send'}
            disabled={!form.requestingEntryId || !form.targetEntryId || eligibleLoading}
            submitLabel={busy === 'send' ? player.sending : player.send}
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
          {error ? <InlineNotice kind="error">{error}</InlineNotice> : null}
          <DashboardField id="own-entry" label={player.competitionEntry}>
            <select id="own-entry" className={selectControlClassName} value={form.requestingEntryId} onChange={(fieldEvent) => selectEntry(fieldEvent.target.value)} disabled={busy === 'send'}>
              <option value="">{player.selectEntry}</option>
              {approvedEntries.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.owner.fullName} / {entry.teammate.fullName} · {entry.category.name}</option>
              ))}
            </select>
          </DashboardField>
          <DashboardField id="opponent-entry" label={player.eligibleOpponent} hint={player.eligibleHint}>
            <select
              id="opponent-entry"
              className={selectControlClassName}
              value={form.targetEntryId}
              onChange={(fieldEvent) => setForm((current) => ({ ...current, targetEntryId: fieldEvent.target.value }))}
              disabled={!form.requestingEntryId || eligibleLoading || busy === 'send'}
              aria-busy={eligibleLoading}
            >
              <option value="">{eligible.length ? player.selectOpponent : eligibleLoading ? player.loadingOpponents : player.noOpponents}</option>
              {eligible.map((entry) => <option key={entry.id} value={entry.id}>{entry.owner.fullName} / {entry.teammate.fullName}</option>)}
            </select>
          </DashboardField>
          <DashboardField id="request-message" label={player.message} hint={player.messageHint}>
            <Textarea
              id="request-message"
              value={form.message}
              onChange={(fieldEvent) => setForm((current) => ({ ...current, message: fieldEvent.target.value }))}
              placeholder={player.messagePlaceholder}
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
        title={requestDecision?.action === 'accept' ? player.acceptTitle : requestDecision?.action === 'refuse' ? player.refuseTitle : player.withdrawTitle}
        description={player.reviewAction}
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
            submitLabel={requestDecision?.action === 'accept' ? player.acceptRequest : requestDecision?.action === 'refuse' ? player.refuseRequest : player.withdrawRequest}
            submitVariant={requestDecision?.action === 'accept' ? 'red' : 'destructive'}
          />
        }
      >
        {requestDecision?.action === 'refuse' ? (
          <DashboardField id="response-reason" label={player.publicReason} hint={player.publicReasonHint}>
            <Textarea id="response-reason" value={decisionReason} onChange={(fieldEvent) => setDecisionReason(fieldEvent.target.value)} className={cn(formControlClassName, 'min-h-28 resize-y leading-6')} rows={4} />
          </DashboardField>
        ) : (
          <p className={playerNoteClassName}>{requestDecision?.action === 'accept' ? player.acceptNote : player.withdrawNote}</p>
        )}
      </DashboardModal>
    </PlayerShell>
  );
}
