'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Check, CheckCircle2, CircleDot, Clock3, GitBranch, Trophy } from 'lucide-react';
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
import { pushToast } from '@/components/shared/Toasts';
import { DashboardModal, formControlClassName } from '@/components/shared/dashboard/DashboardUI';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import styles from './AdminBracket.module.css';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy, tournamentStatus } from '@/lib/i18n/tournament';
import { BracketSwitcher } from './bracket/BracketSwitcher';
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
  const [bracketToDiscard, setBracketToDiscard] = useState<BracketDto | null>(null);
  const [bracketToUnlock, setBracketToUnlock] = useState<BracketDto | null>(null);
  const [unlockReason, setUnlockReason] = useState('');
  const [matchToReopen, setMatchToReopen] = useState<MatchDto | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [moveSource, setMoveSource] = useState<PlacementSlot | null>(null);
  const [moveTargetKey, setMoveTargetKey] = useState('');
  const [warning, setWarning] = useState('');
  const [draggingSlot, setDraggingSlot] = useState<string | null>(null);
  /** Which draw is on screen. Empty until the event's categories are known. */
  const [openCategoryId, setOpenCategoryId] = useState('');
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

  /**
   * One command, reported over the page rather than on it. Locking a draw and
   * reopening a match are both driven from dialogs, so a banner behind them is
   * a refusal nobody reads — and the server's reason ("A downstream match has
   * already started") is the whole content of the message.
   *
   * Returns the parsed body on success and null on refusal, so a caller only
   * closes its dialog when the change actually landed.
   */
  const send = useCallback(async <T,>(
    key: string,
    path: string,
    init: { method: string; body: unknown },
    failure: string,
    success?: string,
  ): Promise<(T & { error?: string }) | null> => {
    setBusy(key);
    try {
      const response = await apiFetch(path, { method: init.method, body: JSON.stringify(init.body) });
      const data = await response.json().catch(() => ({})) as T & { error?: string };
      if (!response.ok) {
        pushToast({ tone: 'error', title: failure, message: data.error ?? copy.admin.common.commandFailed });
        return null;
      }
      if (success) pushToast({ tone: 'success', message: success });
      return data;
    } catch {
      pushToast({ tone: 'error', title: failure, message: copy.admin.common.offline });
      return null;
    } finally {
      setBusy('');
      void load();
    }
  }, [copy.admin.common.commandFailed, copy.admin.common.offline, load]);

  async function create(categoryId: string) {
    await send(
      `create-${categoryId}`,
      `/api/admin/events/${eventId}/brackets`,
      { method: 'POST', body: { categoryId, commandId: createCommandId('bracket-create') } },
      copy.admin.bracket.createError,
      fillTemplate(copy.admin.bracket.drawCreated, { category: categoryName(categoryId) }),
    );
  }

  /** Draws are spoken about by their category, never by their id. */
  function categoryName(categoryId: string) {
    return event?.categories.find((category) => category.id === categoryId)?.name ?? '';
  }

  /** What each draw command confirms once it has landed. */
  function commandSuccess(bracket: BracketDto, action: 'generate' | 'lock' | 'publication') {
    const category = categoryName(bracket.categoryId);
    if (action === 'generate') return fillTemplate(copy.admin.bracket.drawGenerated, { category });
    if (action === 'lock') return fillTemplate(copy.admin.bracket.drawLocked, { category });
    return fillTemplate(
      bracket.publishedAt ? copy.admin.bracket.drawHidden : copy.admin.bracket.drawPublished,
      { category },
    );
  }

  async function command(bracket: BracketDto, action: 'generate' | 'lock' | 'publication') {
    const approvedRequestIds = requests
      .filter((request) => request.categoryId === bracket.categoryId && ['APPROVED_BY_ADMIN', 'OVERRIDDEN_BY_ADMIN'].includes(request.status))
      .map((request) => request.id);
    const result = await send(
      `${action}-${bracket.id}`,
      `/api/admin/events/${eventId}/brackets/${bracket.id}/${action}`,
      {
        method: action === 'publication' ? 'PATCH' : 'POST',
        body: {
          expectedVersion: bracket.version,
          commandId: createCommandId(`bracket-${action}`),
          requestIds: approvedRequestIds,
          published: !bracket.publishedAt,
        },
      },
      copy.admin.bracket.commandError,
      commandSuccess(bracket, action),
    );
    if (result && action === 'lock') setBracketToLock(null);
  }

  /**
   * Throwing a draft away, and rewinding a locked draw.
   *
   * Both are corrections rather than steps forward, so both ask first and both
   * say plainly what goes: a discard takes the whole draw with it, an unlock
   * puts every team back in the first round and clears the byes the lock wrote.
   * Unlocking additionally needs a reason, because it is auditable in the same
   * way reopening a finished event is.
   */
  async function discardDraw() {
    if (!bracketToDiscard) return;
    const category = categoryName(bracketToDiscard.categoryId);
    const result = await send(
      `discard-${bracketToDiscard.id}`,
      `/api/admin/events/${eventId}/brackets/${bracketToDiscard.id}`,
      { method: 'DELETE', body: { commandId: createCommandId('bracket-delete') } },
      copy.admin.bracket.discardError,
      fillTemplate(copy.admin.bracket.drawDiscarded, { category }),
    );
    if (result) setBracketToDiscard(null);
  }

  async function unlockDraw() {
    if (!bracketToUnlock) return;
    const category = categoryName(bracketToUnlock.categoryId);
    const result = await send(
      `unlock-${bracketToUnlock.id}`,
      `/api/admin/events/${eventId}/brackets/${bracketToUnlock.id}/unlock`,
      {
        method: 'POST',
        body: {
          reason: unlockReason,
          expectedVersion: bracketToUnlock.version,
          commandId: createCommandId('bracket-unlock'),
        },
      },
      copy.admin.bracket.unlockError,
      fillTemplate(copy.admin.bracket.drawUnlocked, { category }),
    );
    if (result) { setBracketToUnlock(null); setUnlockReason(''); }
  }

  async function setRoundDefault(bracket: BracketDto, round: MatchDto['round'], setCount: number) {
    await send(
      `sets-${bracket.id}-${round}`,
      `/api/admin/events/${eventId}/brackets/${bracket.id}/set-defaults`,
      {
        method: 'PUT',
        body: {
          defaults: { ...bracket.setDefaults, [round]: setCount },
          expectedVersion: bracket.version,
          commandId: createCommandId('bracket-set-defaults'),
        },
      },
      copy.admin.bracket.setConfigError,
      copy.admin.bracket.setFormatSaved,
    );
  }

  async function setMatchOverride(match: MatchDto, setCountOverride: number | null) {
    await send(
      `sets-match-${match.id}`,
      `/api/admin/matches/${match.id}/set-config`,
      { method: 'PATCH', body: { setCountOverride, expectedVersion: match.version, commandId: createCommandId('match-set-config') } },
      copy.admin.bracket.setConfigError,
      copy.admin.bracket.setFormatSaved,
    );
  }

  async function reopenMatch() {
    if (!matchToReopen) return;
    const result = await send(
      `reopen-${matchToReopen.id}`,
      `/api/admin/matches/${matchToReopen.id}/sets/undo`,
      { method: 'POST', body: { reason: reopenReason, expectedVersion: matchToReopen.version, commandId: createCommandId('set-undo-admin') } },
      copy.admin.bracket.reopenError,
      fillTemplate(copy.admin.bracket.matchReopened, { number: matchToReopen.matchNumber }),
    );
    if (result) { setMatchToReopen(null); setReopenReason(''); }
  }

  async function placeEntry(source: PlacementSlot, target: PlacementSlot) {
    const bracket = brackets.find((candidate) => candidate.id === source.bracketId);
    if (!bracket || source.bracketId !== target.bracketId) return;
    setWarning('');
    const result = await send<{ revertedRequestIds?: string[] }>(
      `place-${slotKey(source)}`,
      `/api/admin/events/${eventId}/brackets/${bracket.id}/placements`,
      {
        method: 'POST',
        body: {
          sourceMatchId: source.matchId,
          sourceSide: source.side,
          targetMatchId: target.matchId,
          targetSide: target.side,
          expectedVersion: bracket.version,
          commandId: createCommandId('bracket-place'),
        },
      },
      copy.admin.bracket.placementError,
      fillTemplate(copy.admin.bracket.entryMoved, { pair: slotLabel(brackets, source, locale) }),
    );
    // Moving an entry can break a pairing an admin already approved, which is
    // not a failure but does need saying.
    if (result?.revertedRequestIds?.length) setWarning(copy.admin.bracket.pairingBroken);
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

  const draws = event ? buildDrawSummaries(event.categories, brackets, locale) : [];
  // Derived, not synced: a category can vanish under a refresh, and falling back
  // to the first one keeps the page showing a draw rather than nothing.
  const openCategory = event
    ? event.categories.find((category) => category.id === openCategoryId) ?? event.categories[0] ?? null
    : null;

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
          <BracketSwitcher
            draws={draws}
            selectedCategoryId={openCategory?.id ?? ''}
            onSelect={setOpenCategoryId}
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
            {(openCategory ? [openCategory] : []).map((category) => {
              const bracket = brackets.find((item) => item.categoryId === category.id);
              if (!bracket) {
                return (
                  <section
                    id={`draw-panel-${category.id}`}
                    key={category.id}
                    className={styles.bracketPanel}
                    role={draws.length > 1 ? 'tabpanel' : undefined}
                    aria-labelledby={draws.length > 1 ? `draw-tab-${category.id}` : `category-title-${category.id}`}
                  >
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
                  tabbed={draws.length > 1}
                  champion={draws.find((draw) => draw.categoryId === category.id)?.champion ?? null}
                  categoryName={category.name}
                  busy={busy}
                  isCompleted={Boolean(isCompleted)}
                  onCommand={command}
                  onLock={setBracketToLock}
                  onDiscard={setBracketToDiscard}
                  onUnlock={(bracket) => { setBracketToUnlock(bracket); setUnlockReason(''); }}
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
            open={Boolean(bracketToDiscard)}
            onOpenChange={(open) => { if (!open && !busy) setBracketToDiscard(null); }}
            title={copy.admin.bracket.discardTitle}
            description={bracketToDiscard ? categoryName(bracketToDiscard.categoryId) : undefined}
            size="md"
            footer={(
              <ModalFormFooter
                onCancel={() => setBracketToDiscard(null)}
                cancelLabel={copy.common.cancel}
                submitType="button"
                onSubmitClick={() => { void discardDraw(); }}
                busy={Boolean(bracketToDiscard && busy === `discard-${bracketToDiscard.id}`)}
                submitLabel={copy.admin.bracket.discard}
              />
            )}
          >
            <p className="text-sm leading-6 text-[rgba(88,16,16,0.72)]">{copy.admin.bracket.discardNote}</p>
          </DashboardModal>
          <DashboardModal
            open={Boolean(bracketToUnlock)}
            onOpenChange={(open) => { if (!open && !busy) { setBracketToUnlock(null); setUnlockReason(''); } }}
            title={copy.admin.bracket.unlockTitle}
            description={bracketToUnlock ? categoryName(bracketToUnlock.categoryId) : undefined}
            size="md"
            footer={(
              <ModalFormFooter
                onCancel={() => { setBracketToUnlock(null); setUnlockReason(''); }}
                cancelLabel={copy.common.cancel}
                submitType="button"
                onSubmitClick={() => { void unlockDraw(); }}
                busy={Boolean(bracketToUnlock && busy === `unlock-${bracketToUnlock.id}`)}
                disabled={unlockReason.trim().length < 3}
                submitLabel={copy.admin.bracket.unlock}
              />
            )}
          >
            <p className="text-sm leading-6 text-[rgba(88,16,16,0.72)]">{copy.admin.bracket.unlockNote}</p>
            <label className="mt-4 block text-sm font-semibold text-[var(--dash-text)]" htmlFor="unlock-reason">{copy.admin.bracket.unlockReason}</label>
            <input
              id="unlock-reason"
              className={formControlClassName}
              value={unlockReason}
              onChange={(fieldEvent) => setUnlockReason(fieldEvent.target.value)}
            />
            <p className="mt-1 text-xs text-[var(--dash-muted)]">{copy.admin.bracket.unlockReasonHint}</p>
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
              {matchToReopen ? fillTemplate(copy.admin.bracket.reopenBody, { number: matchToReopen.sets.at(-1)?.setNumber ?? matchToReopen.sets.length }) : null}
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
  champion,
  isCompleted,
  onCommand,
  onLock,
  onDiscard,
  onUnlock,
  onMatchOverride,
  onMoveRequest,
  onReopen,
  onRoundDefault,
  tabbed,
}: {
  bracket: BracketDto;
  busy: string;
  categoryName: string;
  /** Named in the header once the final is decided — the draw's own answer. */
  champion: string | null;
  isCompleted: boolean;
  /** True when the switcher is on screen, which makes this panel its tab panel. */
  tabbed: boolean;
  onCommand: (bracket: BracketDto, action: 'generate' | 'lock' | 'publication') => void;
  onLock: (bracket: BracketDto) => void;
  onDiscard: (bracket: BracketDto) => void;
  onUnlock: (bracket: BracketDto) => void;
  onMatchOverride: (match: MatchDto, setCountOverride: number | null) => void;
  onMoveRequest: (slot: PlacementSlot) => void;
  onReopen: (match: MatchDto) => void;
  onRoundDefault: (bracket: BracketDto, round: MatchDto['round'], setCount: number) => void;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];

  return (
    <section
      id={`draw-panel-${bracket.categoryId}`}
      className={styles.bracketPanel}
      role={tabbed ? 'tabpanel' : undefined}
      aria-labelledby={tabbed ? `draw-tab-${bracket.categoryId}` : `category-title-${bracket.categoryId}`}
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
            {/* The one fact the summary cards carried that this header did not:
                who actually won it. */}
            {champion ? (
              <MetaPill tone="success" icon={<Trophy />}>
                {fillTemplate(copy.admin.bracket.championIs, { pair: champion })}
              </MetaPill>
            ) : null}
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
            {/* Exactly one of these applies at a time: a draft can be thrown
                away, a locked draw can be rewound. Offering both at once would
                be two ways to undo one thing. */}
            {bracket.status === 'DRAFT' ? (
              <CommandButton
                tone="danger"
                busy={busy === `discard-${bracket.id}`}
                onClick={() => onDiscard(bracket)}
              >
                {copy.admin.bracket.discard}
              </CommandButton>
            ) : (
              <CommandButton
                tone="danger"
                busy={busy === `unlock-${bracket.id}`}
                disabled={Boolean(bracket.publishedAt)}
                onClick={() => onUnlock(bracket)}
              >
                {copy.admin.bracket.unlock}
              </CommandButton>
            )}
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
