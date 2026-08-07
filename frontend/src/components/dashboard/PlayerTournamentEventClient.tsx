'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Network, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiFetch, createCommandId } from '@/lib/api';
import type { PublicUser } from '@/types/auth';
import type { DashboardData, EventDto, RegistrationDto } from '@/types/dashboard';
import type { BracketDto, CourtDto, OpponentRequestDto } from '@/types/tournament';
import { PlayerShell } from './PlayerShell';
import { PlayerEntryCard } from './PlayerEntryCard';
import { OpponentRequestModal } from './OpponentRequestModal';
import { ClubLineupEditor } from './ClubLineupEditor';
import { RegisterModal } from './PlayerShared';
import {
  BackLink,
  CommandButton,
  EmptyTournamentState,
  InlineNotice,
  TournamentPanel,
  TournamentSectionHeader,
} from '@/components/tournament/TournamentUI';
import { Textarea } from '@/components/ui/textarea';
import { DashboardField, DashboardModal, formControlClassName, softButtonClassName } from '@/components/shared/dashboard/DashboardUI';
import { PageNotice, SkeletonCards } from '@/components/shared/dashboard/Feedback';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/shared/I18nProvider';
import { tournamentCopy } from '@/lib/i18n/tournament';
import { usePlayerDashboard } from '@/hooks/usePlayerDashboard';
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

/**
 * A player's own page for one event, in the order they ask: am I in (their
 * entry path), who am I playing (their opponent requests), when do I play
 * (their matches). The bracket and schedule as a whole belong to the public
 * event page — a competitor only needs their own row of each.
 */
export function PlayerTournamentEventClient({ eventId, initialUser }: { eventId: string; initialUser: PublicUser }) {
  const { locale, dictionary } = useI18n();
  const copy = tournamentCopy[locale];
  const player = copy.playerEvent;
  const clubCopy = dictionary.dashboard.player.clubEntries;
  const api = usePlayerDashboard(initialUser);

  const [event, setEvent] = useState<EventDto | null>(null);
  const [entries, setEntries] = useState<RegistrationDto[]>([]);
  const [requests, setRequests] = useState<OpponentRequestDto[]>([]);
  const [brackets, setBrackets] = useState<BracketDto[]>([]);
  const [courts, setCourts] = useState<CourtDto[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestDecision, setRequestDecision] = useState<{ request: OpponentRequestDto; action: 'accept' | 'refuse' | 'withdraw' } | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [managedEntry, setManagedEntry] = useState<RegistrationDto | null>(null);

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
    }
    setLoading(false);
  }, [player.loadError, eventId]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const mine = useMemo(() => ownEntryIds(entries), [entries]);
  const received = useMemo(() => receivedRequests(requests, mine), [mine, requests]);
  const sent = useMemo(() => sentRequests(requests, mine), [mine, requests]);
  const matches = useMemo(() => playerMatches(brackets, courts, mine), [brackets, courts, mine]);
  const approvedEntries = approvedOf(entries);
  const clubPlayers = useMemo(
    () =>
      [api.user, ...api.clubMembers].filter(
        (member, index, all) => all.findIndex((candidate) => candidate.id === member.id) === index,
      ),
    [api.clubMembers, api.user],
  );

  async function respond(request: OpponentRequestDto, action: 'accept' | 'refuse') {
    const reason = action === 'refuse' ? decisionReason.trim() : '';
    setBusy(`${action}-${request.id}`); setError(''); setNotice('');
    const response = await apiFetch(`/api/events/${eventId}/opponent-requests/${request.id}/${action}`, { method: 'POST', body: JSON.stringify({ reason, expectedVersion: request.version, commandId: createCommandId(`opponent-${action}`) }) });
    const data = await response.json() as { error?: string };
    setBusy('');
    if (!response.ok) setError(data.error ?? player.sendError);
    else { setRequestDecision(null); setDecisionReason(''); setNotice(action === 'accept' ? player.requestAccepted : player.requestRefused); void load(); }
  }

  async function withdraw(request: OpponentRequestDto) {
    setBusy(`withdraw-${request.id}`); setError(''); setNotice('');
    const response = await apiFetch(`/api/events/${eventId}/opponent-requests/${request.id}`, { method: 'DELETE', body: JSON.stringify({ expectedVersion: request.version, commandId: createCommandId('opponent-withdraw') }) });
    const data = await response.json() as { error?: string };
    setBusy('');
    if (!response.ok) setError(data.error ?? player.withdrawError);
    else { setRequestDecision(null); setNotice(player.requestWithdrawn); void load(); }
  }

  function openRequestDecision(request: OpponentRequestDto, action: 'accept' | 'refuse' | 'withdraw') {
    setRequestDecision({ request, action });
    setDecisionReason('');
  }

  return (
    <PlayerShell user={initialUser} title={event?.title ?? player.event} description={player.description} eyebrow={player.eyebrow}>
      <div className="mb-4"><BackLink href="/dashboard/events">{player.allEvents}</BackLink></div>
      {notice ? <PageNotice tone="success" onDismiss={() => setNotice('')}>{notice}</PageNotice> : null}
      {error && !requestDecision ? <div className="mb-4"><InlineNotice kind="error">{error}</InlineNotice></div> : null}

      <div className={playerEventPageClassName}>
        {loading ? (
          <SkeletonCards count={1} columns={2} label={copy.common.loading} />
        ) : entries.length ? (
          entries.map((entry) => (
            <PlayerEntryCard
              key={entry.id}
              registration={entry}
              ownershipLabel={
                entry.owner.id === api.user.id || entry.teammate.id === api.user.id
                  ? clubCopy.yourTeam
                  : clubCopy.clubTeam
              }
              actions={api.clubMembershipRole === 'LEADER' ? (
                <Button
                  type="button"
                  variant="outline"
                  className={cn(softButtonClassName, 'min-h-11 rounded-lg')}
                  onClick={() => setManagedEntry(entry)}
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  {clubCopy.manageLineup}
                </Button>
              ) : undefined}
            />
          ))
        ) : (
          <TournamentPanel>
            <EmptyTournamentState
              title={player.noEntryTitle}
              detail={
                event?.status === 'REGISTRATION_OPEN' ? player.noEntryDetail : player.registrationClosedNote
              }
              action={
                event?.status === 'REGISTRATION_OPEN' ? (
                  <Button
                    type="button"
                    variant="red"
                    className="min-h-11 rounded-md"
                    onClick={() => api.openRegister(event)}
                  >
                    {player.registerCta}
                  </Button>
                ) : undefined
              }
            />
          </TournamentPanel>
        )}

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

        <PlayerMatchPanel
          matches={matches}
          emptyTitle={player.noMatches}
          emptyDetail={player.noMatchesDetail}
          actions={
            brackets.length ? (
              <Button asChild variant="outline" size="sm" className={cn(softButtonClassName, 'min-h-11 rounded-md')}>
                <Link href={`/dashboard/events/${eventId}/draw`}>
                  <Network className="h-4 w-4" aria-hidden="true" />
                  {player.seeDraw}
                </Link>
              </Button>
            ) : undefined
          }
        />
      </div>

      <RegisterModal
        api={api}
        onRegistered={() => {
          setNotice(dictionary.dashboard.player.messages.registerSuccess);
          void load();
        }}
      />

      <OpponentRequestModal
        open={requestModalOpen}
        onOpenChange={setRequestModalOpen}
        eventId={eventId}
        approvedEntries={approvedEntries}
        onSent={() => {
          setNotice(player.requestSent);
          void load();
        }}
      />

      {managedEntry ? (
        <ClubLineupEditor
          key={`${managedEntry.id}:${managedEntry.version}`}
          registration={managedEntry}
          clubPlayers={clubPlayers}
          onClose={() => setManagedEntry(null)}
          onConflict={() => void load()}
          onUpdated={async () => {
            setManagedEntry(null);
            setNotice(clubCopy.success);
            await load();
          }}
        />
      ) : null}

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
          <p className="text-sm leading-6 text-[var(--dash-muted)]">
            {requestDecision?.action === 'accept' ? player.acceptNote : player.withdrawNote}
          </p>
        )}
      </DashboardModal>
    </PlayerShell>
  );
}
