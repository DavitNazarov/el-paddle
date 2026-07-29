'use client';

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  GitBranch,
  LockKeyhole,
  MoveVertical,
  Radio,
  RotateCcw,
  Trophy,
  XCircle,
} from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { apiFetch, createCommandId } from '@/lib/api';
import type { EventDto } from '@/types/admin';
import type { BracketDto, MatchDto, OpponentRequestDto } from '@/types/tournament';
import { AdminShell } from './AdminShell';
import { BackLink, CommandButton, EmptyTournamentState, InlineNotice } from '@/components/tournament/TournamentUI';
import { cn } from '@/lib/utils';
import { DashboardModal, formControlClassName } from '@/components/shared/dashboard/DashboardUI';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import styles from './AdminBracket.module.css';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy, tournamentRound, tournamentStatus } from '@/lib/i18n/tournament';

const rounds: MatchDto['round'][] = ['ROUND_OF_16', 'QUARTERFINAL', 'SEMIFINAL', 'FINAL'];

function pairLabel(bracket: BracketDto, match: MatchDto, side: 'A' | 'B', locale: 'ka' | 'en') {
  const entry = side === 'A' ? match.participantA : match.participantB;
  if (entry) return `${entry.owner.fullName} / ${entry.teammate.fullName}`;
  const source = bracket.matches.find((candidate) => candidate.nextMatchId === match.id && candidate.nextMatchSlot === side);
  const copy = tournamentCopy[locale].publicEvent;
  return source ? fillTemplate(copy.winnerOfMatch, { number: source.matchNumber }) : copy.toBeDetermined;
}

function activeRounds(matches: MatchDto[]) {
  const present = new Set(matches.map((match) => match.round));
  return rounds.filter((round) => present.has(round));
}

/** Slot format an unstarted match would use: its override, else the bracket round default, else one. */
function effectiveSlotCount(bracket: BracketDto, match: MatchDto) {
  return match.slotCount ?? match.slotCountOverride ?? bracket.slotDefaults[match.round] ?? 1;
}

/** A first-round participant slot, addressed as `matchId:side` while dragging. */
export type PlacementSlot = { bracketId: string; matchId: string; side: 'A' | 'B' };

function slotKey(slot: PlacementSlot) {
  return `${slot.matchId}:${slot.side}`;
}

function parseSlotKey(key: string, bracketId: string): PlacementSlot | null {
  const [matchId, side] = key.split(':');
  if (!matchId || (side !== 'A' && side !== 'B')) return null;
  return { bracketId, matchId, side };
}

function firstRoundOf(bracket: BracketDto) {
  return activeRounds(bracket.matches)[0] ?? null;
}

function slotLabel(brackets: BracketDto[], slot: PlacementSlot, locale: 'ka' | 'en') {
  const bracket = brackets.find((candidate) => candidate.id === slot.bracketId);
  const match = bracket?.matches.find((candidate) => candidate.id === slot.matchId);
  return bracket && match ? pairLabel(bracket, match, slot.side, locale) : '';
}

/** Every other first-round slot in the same bracket, as options for the move-entry fallback. */
function placementTargets(brackets: BracketDto[], source: PlacementSlot, locale: 'ka' | 'en') {
  const bracket = brackets.find((candidate) => candidate.id === source.bracketId);
  if (!bracket) return [];
  const firstRound = firstRoundOf(bracket);
  const copy = tournamentCopy[locale].admin.bracket;
  return bracket.matches
    .filter((match) => match.round === firstRound)
    .flatMap((match) => (['A', 'B'] as const).map((side) => ({ match, side })))
    .filter(({ match, side }) => !(match.id === source.matchId && side === source.side))
    .map(({ match, side }) => {
      const entryId = side === 'A' ? match.participantAEntryId : match.participantBEntryId;
      return {
        value: `${match.id}:${side}`,
        label: fillTemplate(copy.slotOptionLabel, {
          number: match.matchNumber,
          side,
          occupant: entryId ? pairLabel(bracket, match, side, locale) : copy.slotEmpty,
        }),
      };
    });
}

function winnerSide(match: MatchDto): 'A' | 'B' | null {
  if (match.winnerEntryId && match.winnerEntryId === match.participantAEntryId) return 'A';
  if (match.winnerEntryId && match.winnerEntryId === match.participantBEntryId) return 'B';
  if (match.status !== 'COMPLETED' || match.scoreA === match.scoreB) return null;
  return match.scoreA > match.scoreB ? 'A' : 'B';
}

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

  const matchCount = brackets.reduce((total, bracket) => total + bracket.matches.length, 0);
  const completedMatchCount = brackets.reduce(
    (total, bracket) => total + bracket.matches.filter((match) => match.status === 'COMPLETED').length,
    0,
  );

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

      {error ? <div className="mb-4"><InlineNotice kind="error">{error}</InlineNotice></div> : null}
      {warning ? <div className="mb-4"><InlineNotice kind="info">{warning}</InlineNotice></div> : null}

      {!event && !error ? <BracketSkeleton /> : null}

      {event ? (
        <>
          <BracketOverview
            bracketCount={brackets.length}
            categoryCount={event.categories.length}
            completedMatchCount={completedMatchCount}
            isCompleted={isCompleted}
            matchCount={matchCount}
            publishedCount={brackets.filter((bracket) => bracket.publishedAt).length}
          />

          {isCompleted ? (
            <div className={styles.readOnlyNotice} role="status">
              <span className={styles.noticeIcon}><LockKeyhole aria-hidden="true" /></span>
              <div>
                <p>{copy.admin.bracket.completedTitle}</p>
                <span>{copy.admin.bracket.completedDescription}</span>
              </div>
            </div>
          ) : null}

          {event.categories.length > 1 ? (
            <nav className={styles.categoryNav} aria-label={copy.admin.bracket.categoryNav}>
              {event.categories.map((category) => {
                const bracket = brackets.find((item) => item.categoryId === category.id);
                return (
                  <a key={category.id} href={`#category-${category.id}`}>
                    <span>{category.name}</span>
                    <span className={styles.categoryCount}>{bracket?.matches.length ?? 0}</span>
                  </a>
                );
              })}
            </nav>
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
                  isCompleted={isCompleted}
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

function BracketOverview({
  bracketCount,
  categoryCount,
  completedMatchCount,
  isCompleted,
  matchCount,
  publishedCount,
}: {
  bracketCount: number;
  categoryCount: number;
  completedMatchCount: number;
  isCompleted: boolean;
  matchCount: number;
  publishedCount: number;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].admin.bracket;
  const items = [
    { label: copy.categories, value: categoryCount },
    { label: copy.drawsReady, value: `${bracketCount}/${categoryCount}` },
    { label: copy.matchesComplete, value: matchCount ? `${completedMatchCount}/${matchCount}` : '—' },
    { label: copy.published, value: `${publishedCount}/${bracketCount || categoryCount}` },
  ];

  return (
    <section className={styles.overview} aria-label={copy.overview}>
      <div className={styles.overviewIntro}>
        <span className={styles.overviewIcon}>{isCompleted ? <Trophy aria-hidden="true" /> : <GitBranch aria-hidden="true" />}</span>
        <div>
          <p>{isCompleted ? copy.finalDraw : copy.workspace}</p>
          <span>{isCompleted ? copy.readOnly : copy.workspaceDescription}</span>
        </div>
      </div>
      <dl className={styles.overviewStats}>
        {items.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
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
  const final = bracket.matches.find((match) => match.round === 'FINAL');
  const finalWinner = final ? winnerSide(final) : null;
  const champion = final && finalWinner ? pairLabel(bracket, final, finalWinner, locale) : null;

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
              {bracket.publishedAt ? copy.admin.bracket.published : copy.admin.bracket.notPublished}
            </MetaPill>
          </>
        )}
        champion={champion}
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
        <BracketBoard
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
  champion,
  description,
  title,
  titleId,
}: {
  actions?: ReactNode;
  badges: ReactNode;
  champion?: string | null;
  description: string;
  title: string;
  titleId: string;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].admin.bracket;
  return (
    <header className={styles.bracketHeader}>
      <div className={styles.headerIdentity}>
        <div>
          <h2 id={titleId}>{title}</h2>
          <p>{description}</p>
        </div>
        <div className={styles.metaRow}>{badges}</div>
      </div>
      <div className={styles.headerAside}>
        {champion ? (
          <div className={styles.champion}>
            <Trophy aria-hidden="true" />
            <span><small>{copy.champion}</small>{champion}</span>
          </div>
        ) : null}
        {actions ? <div className={styles.headerActions}>{actions}</div> : null}
      </div>
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

function BracketBoard({
  bracket,
  busy,
  isCompleted,
  onMatchOverride,
  onMoveRequest,
  onReopen,
  onRoundDefault,
}: {
  bracket: BracketDto;
  busy: string;
  isCompleted: boolean;
  onMatchOverride: (match: MatchDto, slotCountOverride: number | null) => void;
  onMoveRequest: (slot: PlacementSlot) => void;
  onReopen: (match: MatchDto) => void;
  onRoundDefault: (bracket: BracketDto, round: MatchDto['round'], slotCount: number) => void;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const visibleRounds = activeRounds(bracket.matches);
  // Locking snapshots participant identity, so entries can only be rearranged while drafting.
  const placementEnabled = !isCompleted && bracket.status === 'DRAFT';
  const firstRoundMatches = bracket.matches.filter((match) => match.round === visibleRounds[0]);
  const rowCount = Math.max(firstRoundMatches.length * 2, 2);
  const boardStyle = {
    '--round-count': visibleRounds.length,
    '--row-count': rowCount,
  } as CSSProperties;

  return (
    <div className={styles.boardRegion}>
      <div className={styles.boardHint}>
        <span>{copy.admin.bracket.progression}</span>
        <span>{placementEnabled ? copy.admin.bracket.dragHint : copy.admin.bracket.progressionDescription}</span>
      </div>
      <div className={styles.board} style={boardStyle}>
        {visibleRounds.map((round, roundIndex) => {
          const roundMatches = bracket.matches
            .filter((match) => match.round === round)
            .sort((a, b) => a.roundPosition - b.roundPosition);
          const rowSpan = Math.max(2 ** (roundIndex + 1), 2);
          return (
            <section key={round} className={styles.round} aria-labelledby={`${bracket.id}-${round}`}>
              <header className={styles.roundHeader}>
                <span>{String(roundIndex + 1).padStart(2, '0')}</span>
                <h3 id={`${bracket.id}-${round}`}>{tournamentRound(locale, round)}</h3>
                <small>{roundMatches.length} {roundMatches.length === 1 ? copy.common.match.toLowerCase() : copy.common.matches}</small>
                {isCompleted ? null : (
                  <div className={cn(styles.slotControl, styles.roundSlotControl)}>
                    <label htmlFor={`${bracket.id}-${round}-slots`}>{copy.admin.bracket.slotsPerMatch}</label>
                    <select
                      id={`${bracket.id}-${round}-slots`}
                      value={bracket.slotDefaults[round] ?? 1}
                      disabled={busy === `slots-${bracket.id}-${round}`}
                      onChange={(fieldEvent) => onRoundDefault(bracket, round, Number(fieldEvent.target.value))}
                    >
                      <option value={1}>{copy.admin.bracket.slotOption1}</option>
                      <option value={2}>{copy.admin.bracket.slotOption2}</option>
                      <option value={3}>{copy.admin.bracket.slotOption3}</option>
                    </select>
                  </div>
                )}
              </header>
              <div className={styles.roundMatches}>
                {roundMatches.map((match, matchIndex) => {
                  const slotStyle = {
                    gridRow: `${matchIndex * rowSpan + 1} / span ${rowSpan}`,
                  } as CSSProperties;
                  return (
                    <div
                      key={match.id}
                      className={cn(styles.matchSlot, roundIndex < visibleRounds.length - 1 && styles.matchAdvances)}
                      style={slotStyle}
                    >
                      <MatchCard
                        bracket={bracket}
                        busy={busy}
                        isCompleted={isCompleted}
                        match={match}
                        onMatchOverride={onMatchOverride}
                        onMoveRequest={onMoveRequest}
                        onReopen={onReopen}
                        placementEnabled={placementEnabled && round === visibleRounds[0]}
                      />
                      {roundIndex < visibleRounds.length - 1 ? <ChevronRight className={styles.advanceIcon} aria-hidden="true" /> : null}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function MatchCard({
  bracket,
  busy,
  isCompleted,
  match,
  onMatchOverride,
  onMoveRequest,
  onReopen,
  placementEnabled,
}: {
  bracket: BracketDto;
  busy: string;
  isCompleted: boolean;
  match: MatchDto;
  onMatchOverride: (match: MatchDto, slotCountOverride: number | null) => void;
  onMoveRequest: (slot: PlacementSlot) => void;
  onReopen: (match: MatchDto) => void;
  placementEnabled: boolean;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const winner = winnerSide(match);
  const slotsUsed = match.scoringMode === 'SLOTS';
  // Once a match starts its format is frozen server-side, so the select gives way to a badge.
  const formatEditable = slotsUsed && !isCompleted && !match.startedAt && (match.status === 'PENDING' || match.status === 'READY');
  const roundDefault = bracket.slotDefaults[match.round] ?? 1;
  // Only a normally scored slot match can be walked back; walkovers go through corrections.
  const canReopen = slotsUsed && !isCompleted && match.status === 'COMPLETED' && match.resultType === 'NORMAL' && match.slots.length > 0;

  return (
    <article className={styles.matchCard} data-status={match.status.toLowerCase()} aria-label={`${copy.common.match} ${match.matchNumber}, ${tournamentStatus(locale, match.status)}`}>
      <header className={styles.matchHeader}>
        <span>{copy.common.match} {match.matchNumber}</span>
        <MatchStatus status={match.status} />
      </header>
      <div className={styles.participants}>
        {(['A', 'B'] as const).map((side) => (
          <ParticipantRow
            key={side}
            busy={busy}
            hasEntry={Boolean(side === 'A' ? match.participantAEntryId : match.participantBEntryId)}
            label={pairLabel(bracket, match, side, locale)}
            onMoveRequest={onMoveRequest}
            placementEnabled={placementEnabled}
            score={match.status === 'COMPLETED' ? (side === 'A' ? match.scoreA : match.scoreB) : null}
            side={side}
            slot={{ bracketId: bracket.id, matchId: match.id, side }}
            winner={winner === side}
          />
        ))}
      </div>
      {slotsUsed ? (
        <div className={styles.matchFormat}>
          {formatEditable ? (
            <div className={styles.slotControl}>
              <label className="sr-only" htmlFor={`${match.id}-slots`}>{copy.admin.bracket.matchSlots}</label>
              <select
                id={`${match.id}-slots`}
                value={match.slotCountOverride ?? ''}
                disabled={busy === `slots-match-${match.id}`}
                onChange={(fieldEvent) => onMatchOverride(match, fieldEvent.target.value === '' ? null : Number(fieldEvent.target.value))}
              >
                <option value="">{fillTemplate(copy.admin.bracket.slotDefaultOption, { count: roundDefault })}</option>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </div>
          ) : (
            <span className={styles.formatBadge}>{fillTemplate(copy.admin.bracket.slotBadge, { count: effectiveSlotCount(bracket, match) })}</span>
          )}
          {match.slots.length && match.resultType !== 'ADMIN_DECISION' ? (
            <ul className={styles.slotChips} aria-label={copy.admin.bracket.matchSlots}>
              {match.slots.map((slot) => (
                <li key={slot.slotNumber}>
                  {fillTemplate(copy.publicEvent.slotShort, { number: slot.slotNumber })}
                  <span aria-hidden="true">·</span>
                  {slot.winnerSide}
                </li>
              ))}
            </ul>
          ) : null}
          {canReopen ? (
            <CommandButton className="min-h-11" busy={busy === `reopen-${match.id}`} onClick={() => onReopen(match)}>
              <RotateCcw aria-hidden="true" />
              {copy.admin.bracket.reopenMatch}
            </CommandButton>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function ParticipantRow({
  busy,
  hasEntry,
  label,
  onMoveRequest,
  placementEnabled,
  score,
  side,
  slot,
  winner,
}: {
  busy: string;
  hasEntry: boolean;
  label: string;
  onMoveRequest: (slot: PlacementSlot) => void;
  placementEnabled: boolean;
  score: number | null;
  side: 'A' | 'B';
  slot: PlacementSlot;
  winner: boolean;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const pending = label === copy.publicEvent.toBeDetermined || label.includes(copy.common.winner);
  const key = slotKey(slot);
  const draggable = placementEnabled && hasEntry;
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: key, data: { bracketId: slot.bracketId }, disabled: !draggable });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: key, data: { bracketId: slot.bracketId }, disabled: !placementEnabled });

  return (
    <div
      ref={setDropRef}
      className={cn(styles.participant, winner && styles.winner, pending && styles.pendingParticipant, isOver && styles.dropTarget, isDragging && styles.dragging)}
    >
      <span className={styles.sideLabel}>{side}</span>
      {draggable ? (
        <button
          type="button"
          ref={setDragRef}
          className={styles.pairHandle}
          aria-label={fillTemplate(copy.admin.bracket.moveEntryTitle, { pair: label })}
          {...attributes}
          {...listeners}
        >
          {label}
        </button>
      ) : (
        <span className={styles.pairName}>{label}</span>
      )}
      {winner ? <Check className={styles.winnerCheck} aria-label={copy.common.winner} /> : null}
      {draggable ? (
        <button
          type="button"
          className={styles.moveButton}
          aria-label={fillTemplate(copy.admin.bracket.moveEntryTitle, { pair: label })}
          disabled={busy === `place-${key}`}
          onClick={() => onMoveRequest(slot)}
        >
          <MoveVertical aria-hidden="true" />
        </button>
      ) : null}
      <span className={styles.score}>{score ?? '—'}</span>
    </div>
  );
}

function MatchStatus({ status }: { status: MatchDto['status'] }) {
  const { locale } = useI18n();
  const icons: Record<MatchDto['status'], ReactNode> = {
    COMPLETED: <CheckCircle2 aria-hidden="true" />,
    IN_PROGRESS: <Radio aria-hidden="true" />,
    READY: <CircleDot aria-hidden="true" />,
    PENDING: <Clock3 aria-hidden="true" />,
    CANCELLED: <XCircle aria-hidden="true" />,
  };
  return (
    <span className={styles.matchStatus} data-status={status.toLowerCase()}>
      {icons[status]}
      {tournamentStatus(locale, status)}
    </span>
  );
}

function BracketSkeleton() {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].admin.bracket;
  return (
    <div className={styles.skeleton} role="status" aria-label={copy.loading}>
      <div className={styles.skeletonOverview} />
      <div className={styles.skeletonPanel}>
        <div />
        <div />
        <div />
      </div>
    </div>
  );
}
