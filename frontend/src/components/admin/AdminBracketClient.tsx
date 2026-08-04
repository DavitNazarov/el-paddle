'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Check, CheckCircle2, CircleDot, Clock3, GitBranch } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { apiFetch, createCommandId } from '@/lib/api';
import type { EventDto } from '@/types/admin';
import type { BracketDto, MatchDto, OpponentRequestDto } from '@/types/tournament';
import { AdminShell } from './AdminShell';
import { BackLink, CommandButton, EmptyTournamentState } from '@/components/tournament/TournamentUI';
import { Notice, PageNotice } from '@/components/shared/dashboard/Feedback';
import { DashboardModal, formControlClassName } from '@/components/shared/dashboard/DashboardUI';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import styles from './AdminBracket.module.css';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy, tournamentStatus } from '@/lib/i18n/tournament';
import { BracketDrawStrip } from './bracket/BracketDrawStrip';
import { BracketTree } from './bracket/BracketTree';
import {
  buildDrawSummaries,
  parseSlotKey,
  placementTargets,
  slotKey,
  slotLabel,
  type PlacementSlot,
} from './bracket/bracketModel';

export function AdminBracketClient({ eventId }: { eventId: string }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const [event, setEvent] = useState<EventDto | null>(null);
  const [brackets, setBrackets] = useState<BracketDto[]>([]);
  const [requests, setRequests] = useState<OpponentRequestDto[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [bracketToLock, setBracketToLock] = useState<BracketDto | null>(null);
  const [matchToReopen, setMatchToReopen] = useState<MatchDto | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [moveSource, setMoveSource] = useState<PlacementSlot | null>(null);
  const [moveTargetKey, setMoveTargetKey] = useState('');
  const [warning, setWarning] = useState('');
  const [draggingSlot, setDraggingSlot] = useState<string | null>(null);
  const isCompleted = event?.status === 'COMPLETED';

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      apiFetch(`/api/events/${eventId}`, { cache: 'no-store' }),
      apiFetch(`/api/admin/events/${eventId}/brackets`, { cache: 'no-store' }),
      apiFetch(`/api/admin/events/${eventId}/opponent-requests`, { cache: 'no-store' }),
    ]);
    const eventData = await a.json() as { event?: EventDto; error?: string };
    const bracketData = await b.json() as { brackets?: BracketDto[]; error?: string };
    const requestData = await c.json() as { requests?: OpponentRequestDto[] };
    if (!a.ok || !b.ok) setError(eventData.error ?? bracketData.error ?? copy.admin.bracket.loadError);
    else {
      setEvent(eventData.event ?? null);
      setBrackets(bracketData.brackets ?? []);
      setRequests(requestData.requests ?? []);
    }
  }, [copy.admin.bracket.loadError, eventId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function create(categoryId: string) {
    setBusy(`create-${categoryId}`);
    setError('');
    const response = await apiFetch(`/api/admin/events/${eventId}/brackets`, {
      method: 'POST',
      body: JSON.stringify({ categoryId, commandId: createCommandId('bracket-create') }),
    });
    const data = await response.json() as { error?: string };
    setBusy('');
    if (!response.ok) setError(data.error ?? copy.admin.bracket.createError);
    else void load();
  }

  async function command(bracket: BracketDto, action: 'generate' | 'lock' | 'publication') {
    setBusy(`${action}-${bracket.id}`);
    setError('');
    const approvedRequestIds = requests
      .filter((request) => request.categoryId === bracket.categoryId && ['APPROVED_BY_ADMIN', 'OVERRIDDEN_BY_ADMIN'].includes(request.status))
      .map((request) => request.id);
    const response = await apiFetch(`/api/admin/events/${eventId}/brackets/${bracket.id}/${action === 'publication' ? 'publication' : action}`, {
      method: action === 'publication' ? 'PATCH' : 'POST',
      body: JSON.stringify({
        expectedVersion: bracket.version,
        commandId: createCommandId(`bracket-${action}`),
        requestIds: approvedRequestIds,
        published: !bracket.publishedAt,
      }),
    });
    const data = await response.json() as { error?: string };
    setBusy('');
    if (!response.ok) setError(data.error ?? copy.admin.bracket.commandError);
    else { if (action === 'lock') setBracketToLock(null); void load(); }
  }

  async function setRoundDefault(bracket: BracketDto, round: MatchDto['round'], slotCount: number) {
    setBusy(`slots-${bracket.id}-${round}`);
    setError('');
    const response = await apiFetch(`/api/admin/events/${eventId}/brackets/${bracket.id}/slot-defaults`, {
      method: 'PUT',
      body: JSON.stringify({
        defaults: { ...bracket.slotDefaults, [round]: slotCount },
        expectedVersion: bracket.version,
        commandId: createCommandId('bracket-slot-defaults'),
      }),
    });
    const data = await response.json() as { error?: string };
    setBusy('');
    if (!response.ok) setError(data.error ?? copy.admin.bracket.slotConfigError);
    void load();
  }

  async function setMatchOverride(match: MatchDto, slotCountOverride: number | null) {
    setBusy(`slots-match-${match.id}`);
    setError('');
    const response = await apiFetch(`/api/admin/matches/${match.id}/slot-config`, {
      method: 'PATCH',
      body: JSON.stringify({ slotCountOverride, expectedVersion: match.version, commandId: createCommandId('match-slot-config') }),
    });
    const data = await response.json() as { error?: string };
    setBusy('');
    if (!response.ok) setError(data.error ?? copy.admin.bracket.slotConfigError);
    void load();
  }

  async function reopenMatch() {
    if (!matchToReopen) return;
    setBusy(`reopen-${matchToReopen.id}`);
    setError('');
    const response = await apiFetch(`/api/admin/matches/${matchToReopen.id}/slots/undo`, {
      method: 'POST',
      body: JSON.stringify({ reason: reopenReason, expectedVersion: matchToReopen.version, commandId: createCommandId('slot-undo-admin') }),
    });
    const data = await response.json() as { error?: string };
    setBusy('');
    if (!response.ok) setError(data.error ?? copy.admin.bracket.reopenError);
    else { setMatchToReopen(null); setReopenReason(''); }
    void load();
  }

  async function placeEntry(source: PlacementSlot, target: PlacementSlot) {
    const bracket = brackets.find((candidate) => candidate.id === source.bracketId);
    if (!bracket || source.bracketId !== target.bracketId) return;
    setBusy(`place-${slotKey(source)}`);
    setError('');
    setWarning('');
    const response = await apiFetch(`/api/admin/events/${eventId}/brackets/${bracket.id}/placements`, {
      method: 'POST',
      body: JSON.stringify({
        sourceMatchId: source.matchId,
        sourceSide: source.side,
        targetMatchId: target.matchId,
        targetSide: target.side,
        expectedVersion: bracket.version,
        commandId: createCommandId('bracket-place'),
      }),
    });
    const data = await response.json() as { revertedRequestIds?: string[]; error?: string };
    setBusy('');
    if (!response.ok) setError(data.error ?? copy.admin.bracket.placementError);
    else if (data.revertedRequestIds?.length) setWarning(copy.admin.bracket.pairingBroken);
    void load();
  }

  function handleDragEnd(dragEvent: DragEndEvent) {
    setDraggingSlot(null);
    const { active, over } = dragEvent;
    if (!over || active.id === over.id) return;
    const bracketId = String(active.data.current?.bracketId ?? '');
    const source = parseSlotKey(String(active.id), bracketId);
    const target = parseSlotKey(String(over.id), String(over.data.current?.bracketId ?? ''));
    if (!source || !target || source.bracketId !== target.bracketId) return;
    void placeEntry(source, target);
  }

  return (
    <AdminShell
      title={copy.admin.bracket.title}
      description={copy.admin.bracket.description}
      eyebrow={copy.admin.common.eyebrow}
    >
      <div className={styles.pageToolbar}>
        <BackLink href={`/admin/events/${eventId}`}>{copy.admin.common.eventWorkspace}</BackLink>
        {event ? <span className={styles.eventName}>{event.title}</span> : null}
      </div>

      {error ? <PageNotice tone="error" onDismiss={() => setError('')}>{error}</PageNotice> : null}
      {warning ? <PageNotice tone="warning" onDismiss={() => setWarning('')}>{warning}</PageNotice> : null}

      {!event && !error ? <BracketSkeleton /> : null}

      {event ? (
        <>
          <BracketDrawStrip
            draws={buildDrawSummaries(event.categories, brackets, locale)}
            isCompleted={Boolean(isCompleted)}
          />

          {isCompleted ? (
            <div className="mb-4">
              <Notice tone="warning" title={copy.admin.bracket.completedTitle}>
                {copy.admin.bracket.completedDescription}
              </Notice>
            </div>
          ) : null}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={(dragEvent) => setDraggingSlot(String(dragEvent.active.id))}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setDraggingSlot(null)}
          >
          <div className={styles.categoryList}>
            {event.categories.map((category) => {
              const bracket = brackets.find((item) => item.categoryId === category.id);
              if (!bracket) {
                return (
                  <section id={`category-${category.id}`} key={category.id} className={styles.bracketPanel} aria-labelledby={`category-title-${category.id}`}>
                    <BracketHeader
                      titleId={`category-title-${category.id}`}
                      title={category.name}
                      description={isCompleted ? copy.admin.bracket.noBracketCategory : copy.admin.bracket.createCategory}
                      badges={<MetaPill icon={<GitBranch />}>{copy.admin.bracket.notCreated}</MetaPill>}
                      actions={isCompleted ? undefined : (
                        <CommandButton tone="primary" busy={busy === `create-${category.id}`} onClick={() => create(category.id)} className={styles.primaryAction}>
                          {copy.admin.bracket.createBracket}
                        </CommandButton>
                      )}
                    />
                    <EmptyTournamentState title={copy.admin.bracket.notCreatedTitle} detail={copy.admin.bracket.notCreatedDetail} />
                  </section>
                );
              }

              return (
                <BracketCategory
                  key={bracket.id}
                  bracket={bracket}
                  categoryName={category.name}
                  busy={busy}
                  isCompleted={Boolean(isCompleted)}
                  onCommand={command}
                  onLock={setBracketToLock}
                  onMatchOverride={setMatchOverride}
                  onMoveRequest={(slot) => { setMoveSource(slot); setMoveTargetKey(''); }}
                  onReopen={setMatchToReopen}
                  onRoundDefault={setRoundDefault}
                />
              );
            })}
          </div>
          <DragOverlay>
            {draggingSlot ? <span className={styles.dragGhost}>{draggingSlot.split(':')[1]}</span> : null}
          </DragOverlay>
          </DndContext>
          <DashboardModal
            open={Boolean(bracketToLock)}
            onOpenChange={(open) => { if (!open && !busy) setBracketToLock(null); }}
            title={copy.admin.bracket.lockTitle}
            description={bracketToLock ? `${bracketToLock.eventCategory.category.name} · ${fillTemplate(copy.admin.bracket.generation, { number: bracketToLock.generation })}` : undefined}
            size="md"
            footer={
              <ModalFormFooter
                onCancel={() => setBracketToLock(null)}
                cancelLabel={copy.common.cancel}
                submitType="button"
                onSubmitClick={() => { if (bracketToLock) void command(bracketToLock, 'lock'); }}
                busy={Boolean(bracketToLock && busy === `lock-${bracketToLock.id}`)}
                submitLabel={copy.admin.bracket.lock}
              />
            }
          >
            <p className="text-sm leading-6 text-[rgba(88,16,16,0.72)]">{copy.admin.bracket.lockNote}</p>
          </DashboardModal>
          <DashboardModal
            open={Boolean(matchToReopen)}
            onOpenChange={(open) => { if (!open && !busy) { setMatchToReopen(null); setReopenReason(''); } }}
            title={matchToReopen ? fillTemplate(copy.admin.bracket.reopenTitle, { number: matchToReopen.matchNumber }) : copy.admin.bracket.reopenMatch}
            size="md"
            footer={(
              <ModalFormFooter
                onCancel={() => { setMatchToReopen(null); setReopenReason(''); }}
                cancelLabel={copy.common.cancel}
                submitType="button"
                onSubmitClick={() => { void reopenMatch(); }}
                busy={Boolean(matchToReopen && busy === `reopen-${matchToReopen.id}`)}
                disabled={!reopenReason.trim()}
                submitLabel={copy.admin.bracket.reopenSubmit}
              />
            )}
          >
            <p className="text-sm leading-6 text-[rgba(88,16,16,0.72)]">
              {matchToReopen ? fillTemplate(copy.admin.bracket.reopenBody, { number: matchToReopen.slots.at(-1)?.slotNumber ?? matchToReopen.slots.length }) : null}
            </p>
            <label className="mt-4 block text-sm font-semibold text-[var(--dash-text)]" htmlFor="reopen-reason">{copy.admin.bracket.reopenReason}</label>
            <input
              id="reopen-reason"
              className={formControlClassName}
              value={reopenReason}
              onChange={(fieldEvent) => setReopenReason(fieldEvent.target.value)}
            />
            <p className="mt-1 text-xs text-[var(--dash-muted)]">{copy.admin.bracket.reopenReasonHint}</p>
          </DashboardModal>
          <DashboardModal
            open={Boolean(moveSource)}
            onOpenChange={(open) => { if (!open && !busy) { setMoveSource(null); setMoveTargetKey(''); } }}
            title={moveSource ? fillTemplate(copy.admin.bracket.moveEntryTitle, { pair: slotLabel(brackets, moveSource, locale) }) : copy.admin.bracket.moveEntry}
            size="md"
            footer={(
              <ModalFormFooter
                onCancel={() => { setMoveSource(null); setMoveTargetKey(''); }}
                cancelLabel={copy.common.cancel}
                submitType="button"
                onSubmitClick={() => {
                  if (!moveSource) return;
                  const target = parseSlotKey(moveTargetKey, moveSource.bracketId);
                  if (target) { void placeEntry(moveSource, target); setMoveSource(null); setMoveTargetKey(''); }
                }}
                busy={Boolean(moveSource && busy === `place-${slotKey(moveSource)}`)}
                disabled={!moveTargetKey}
                submitLabel={copy.admin.bracket.moveEntry}
              />
            )}
          >
            <label className="block text-sm font-semibold text-[var(--dash-text)]" htmlFor="placement-target">{copy.admin.bracket.targetSlot}</label>
            <select
              id="placement-target"
              className={formControlClassName}
              value={moveTargetKey}
              onChange={(fieldEvent) => setMoveTargetKey(fieldEvent.target.value)}
            >
              <option value="">{copy.admin.bracket.targetSlot}</option>
              {moveSource ? placementTargets(brackets, moveSource, locale).map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              )) : null}
            </select>
            <p className="mt-2 text-xs text-[var(--dash-muted)]">{copy.admin.bracket.swapHint}</p>
          </DashboardModal>
        </>
      ) : null}
    </AdminShell>
  );
}

function BracketCategory({
  bracket,
  busy,
  categoryName,
  isCompleted,
  onCommand,
  onLock,
  onMatchOverride,
  onMoveRequest,
  onReopen,
  onRoundDefault,
}: {
  bracket: BracketDto;
  busy: string;
  categoryName: string;
  isCompleted: boolean;
  onCommand: (bracket: BracketDto, action: 'generate' | 'lock' | 'publication') => void;
  onLock: (bracket: BracketDto) => void;
  onMatchOverride: (match: MatchDto, slotCountOverride: number | null) => void;
  onMoveRequest: (slot: PlacementSlot) => void;
  onReopen: (match: MatchDto) => void;
  onRoundDefault: (bracket: BracketDto, round: MatchDto['round'], slotCount: number) => void;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];

  return (
    <section
      id={`category-${bracket.categoryId}`}
      className={styles.bracketPanel}
      aria-labelledby={`category-title-${bracket.categoryId}`}
    >
      <BracketHeader
        titleId={`category-title-${bracket.categoryId}`}
        title={categoryName}
        description={`${fillTemplate(copy.admin.bracket.generation, { number: bracket.generation })} · ${fillTemplate(copy.admin.bracket.entryDraw, { count: bracket.size })}`}
        badges={(
          <>
            <MetaPill tone={bracket.status === 'COMPLETED' ? 'success' : 'neutral'} icon={bracket.status === 'COMPLETED' ? <CheckCircle2 /> : <CircleDot />}>
              {tournamentStatus(locale, bracket.status)}
            </MetaPill>
            <MetaPill tone={bracket.publishedAt ? 'info' : 'neutral'} icon={bracket.publishedAt ? <Check /> : <Clock3 />}>
              {bracket.publishedAt ? copy.admin.bracket.published : copy.admin.bracket.hidden}
            </MetaPill>
          </>
        )}
        actions={isCompleted ? undefined : (
          <>
            <CommandButton
              tone="primary"
              busy={busy === `generate-${bracket.id}`}
              disabled={bracket.status !== 'DRAFT'}
              onClick={() => onCommand(bracket, 'generate')}
              className={styles.primaryAction}
            >
              {copy.admin.bracket.generateDraft}
            </CommandButton>
            <CommandButton
              busy={busy === `lock-${bracket.id}`}
              disabled={bracket.status !== 'DRAFT' || !bracket.matches.length}
              onClick={() => onLock(bracket)}
            >
              {copy.admin.bracket.lockShort}
            </CommandButton>
            <CommandButton
              busy={busy === `publication-${bracket.id}`}
              disabled={bracket.status === 'DRAFT'}
              onClick={() => onCommand(bracket, 'publication')}
            >
              {bracket.publishedAt ? copy.admin.bracket.unpublish : copy.admin.bracket.publish}
            </CommandButton>
          </>
        )}
      />

      {bracket.matches.length ? (
        <BracketTree
          bracket={bracket}
          busy={busy}
          isCompleted={isCompleted}
          onMatchOverride={onMatchOverride}
          onMoveRequest={onMoveRequest}
          onReopen={onReopen}
          onRoundDefault={onRoundDefault}
        />
      ) : (
        <EmptyTournamentState title={copy.admin.bracket.empty} detail={copy.admin.bracket.emptyDetail} />
      )}
    </section>
  );
}

function BracketHeader({
  actions,
  badges,
  description,
  title,
  titleId,
}: {
  actions?: ReactNode;
  badges: ReactNode;
  description: string;
  title: string;
  titleId: string;
}) {
  return (
    <header className={styles.bracketHeader}>
      <div className={styles.headerIdentity}>
        <div>
          <h2 id={titleId}>{title}</h2>
          <p>{description}</p>
        </div>
        <div className={styles.metaRow}>{badges}</div>
      </div>
      {actions ? <div className={styles.headerActions}>{actions}</div> : null}
    </header>
  );
}

function MetaPill({ children, icon, tone = 'neutral' }: { children: ReactNode; icon: ReactNode; tone?: 'neutral' | 'success' | 'info' }) {
  return (
    <span className={styles.metaPill} data-tone={tone}>
      {icon}
      <span>{children}</span>
    </span>
  );
}

function BracketSkeleton() {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].admin.bracket;
  return (
    <div className={styles.skeleton} role="status" aria-label={copy.loading}>
      <div className={styles.skeletonStrip} />
      <div className={styles.skeletonPanel}>
        <div />
        <div />
        <div />
      </div>
    </div>
  );
}
