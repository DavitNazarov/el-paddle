'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, Download, Plus, Wand2 } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { API_BASE_URL, apiFetch, createCommandId } from '@/lib/api';
import type { EventDto } from '@/types/admin';
import type { BracketDto, CourtDto, ScheduleItemDto } from '@/types/tournament';
import { AdminShell } from './AdminShell';
import { BackLink, CommandButton, EmptyTournamentState, TournamentPanel } from '@/components/tournament/TournamentUI';
import { Notice, PageNotice, SkeletonCards } from '@/components/shared/dashboard/Feedback';
import { pushToast } from '@/components/shared/Toasts';
import { useTournamentRealtime } from '@/hooks/useTournamentRealtime';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import { CourtColumn } from './schedule/CourtColumn';
import { ScheduleDayHeader } from './schedule/ScheduleDayHeader';
import { AddMatchDialog, CreateCourtDialog, type MatchSelection } from './schedule/ScheduleDialogs';
import { UnscheduledPool } from './schedule/UnscheduledPool';
import {
  POOL_ITEM_PREFIX,
  buildDaySummary,
  categoryNamer,
  courtNeedsAttention,
  courtState,
  matchTitle,
  nudgeOrder,
  resolveDrop,
  unscheduledMatches,
} from './schedule/scheduleModel';
import styles from './schedule/Schedule.module.css';

export function AdminScheduleClient({ eventId }: { eventId: string }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const [event, setEvent] = useState<EventDto | null>(null);
  const [courts, setCourts] = useState<CourtDto[]>([]);
  const [brackets, setBrackets] = useState<BracketDto[]>([]);
  const [dialog, setDialog] = useState<'court' | 'match' | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const isCompleted = event?.status === 'COMPLETED';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b, c] = await Promise.all([
        apiFetch(`/api/events/${eventId}`, { cache: 'no-store' }),
        apiFetch(`/api/admin/events/${eventId}/schedule`, { cache: 'no-store' }),
        apiFetch(`/api/admin/events/${eventId}/brackets`, { cache: 'no-store' }),
      ]);
      const eventData = await a.json() as { event?: EventDto; error?: string };
      const scheduleData = await b.json() as { courts?: CourtDto[]; error?: string };
      const bracketData = await c.json() as { brackets?: BracketDto[] };
      if (!a.ok || !b.ok) setError(eventData.error ?? scheduleData.error ?? copy.admin.schedule.loadError);
      else {
        setEvent(eventData.event ?? null);
        setCourts(scheduleData.courts ?? []);
        setBrackets(bracketData.brackets ?? []);
      }
    } catch {
      setError(copy.admin.schedule.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.admin.schedule.loadError, eventId]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  useTournamentRealtime({ eventId, onChange: load, paused: draggingId !== null });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const waiting = useMemo(
    () => unscheduledMatches(brackets.flatMap((bracket) => bracket.matches), courts),
    [brackets, courts],
  );
  const summary = buildDaySummary(courts, waiting.length, Boolean(event?.schedulePublishedAt));
  // Only names a category when the event runs more than one; otherwise every
  // row would carry the same word.
  const categoryOf = useMemo(() => categoryNamer(brackets), [brackets]);
  const needAttention = courts.filter((court) => courtNeedsAttention(courtState(court))).length;

  /** One request helper: every schedule command differs only in route, body, and message. */
  /**
   * A refused command is reported over the board, not on it: half of these are
   * sent from a dialog, and the rest from a drag whose result is far from the
   * top of the page. The server's own reason is the message whenever it gives
   * one — "Court is busy" is actionable, "Could not move the match" is not.
   */
  const send = useCallback(async (
    key: string,
    path: string,
    init: { method: string; body?: unknown },
    failure: string,
    success?: string,
  ) => {
    setBusy(key);
    try {
      const response = await apiFetch(path, {
        method: init.method,
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string; invited?: boolean };
      if (!response.ok) {
        pushToast({ tone: 'error', title: failure, message: data.error ?? copy.admin.common.commandFailed });
        return null;
      }
      if (success) pushToast({ tone: 'success', message: success });
      void load();
      return data;
    } catch {
      pushToast({ tone: 'error', title: failure, message: copy.admin.common.offline });
      return null;
    } finally {
      setBusy('');
    }
  }, [copy.admin.common.commandFailed, copy.admin.common.offline, load]);

  async function createCourt(name: string) {
    if (!name.trim()) return;
    const result = await send(
      'court',
      `/api/admin/events/${eventId}/courts`,
      { method: 'POST', body: { name } },
      copy.admin.schedule.createError,
      fillTemplate(copy.admin.schedule.courtCreated, { court: name.trim() }),
    );
    if (result) setDialog(null);
  }




  async function addMatch(selection: MatchSelection) {
    if (!selection.courtId || !selection.matchId) return;
    const result = await send('match', `/api/admin/events/${eventId}/schedule/items`, {
      method: 'POST',
      body: { ...selection, plannedStartAt: selection.plannedStartAt ? new Date(selection.plannedStartAt).toISOString() : undefined },
    }, copy.admin.schedule.matchError, placedMessage(selection.matchId, selection.courtId));
    if (result) setDialog(null);
  }

  /** Names the match and the court it landed on, so a mis-drop is obvious. */
  function placedMessage(matchId: string, courtId: string) {
    const match = waiting.find((candidate) => candidate.id === matchId);
    const court = courts.find((candidate) => candidate.id === courtId);
    if (!match || !court) return undefined;
    return fillTemplate(copy.admin.schedule.matchPlaced, { number: match.matchNumber, court: court.name });
  }

  async function placeMatch(matchId: string, courtId: string) {
    await send(
      `place-${matchId}`,
      `/api/admin/events/${eventId}/schedule/items`,
      { method: 'POST', body: { matchId, courtId } },
      copy.admin.schedule.matchError,
      placedMessage(matchId, courtId),
    );
  }

  async function unschedule(item: ScheduleItemDto) {
    await send(
      `remove-${item.id}`,
      `/api/admin/events/${eventId}/schedule/items/${item.id}`,
      { method: 'DELETE' },
      copy.admin.schedule.removeError,
      fillTemplate(copy.admin.schedule.matchRemoved, { number: item.match.matchNumber }),
    );
  }

  /**
   * Deals every unplaced match over the active courts.
   *
   * Reports both numbers, because "placed 28" and "placed 28, skipped 3" are
   * different situations for whoever runs the day: the skipped ones are still
   * sitting in the waiting column and still need somewhere to go.
   */
  async function autoFill() {
    const result = await send(
      'auto-fill',
      `/api/admin/events/${eventId}/schedule/auto-fill`,
      { method: 'POST', body: { readyOnly: true, commandId: createCommandId('schedule-auto-fill') } },
      copy.admin.schedule.autoFillError,
    ) as { placed?: number; skipped?: number } | null;
    if (!result) return;
    pushToast({
      tone: result.placed ? 'success' : 'info',
      message: result.skipped
        ? fillTemplate(copy.admin.schedule.autoFillPartial, { placed: result.placed ?? 0, skipped: result.skipped })
        : fillTemplate(copy.admin.schedule.autoFillDone, { placed: result.placed ?? 0 }),
    });
  }

  /** The court sheet, as a file the desk can print. */
  function exportSheet() {
    window.open(`${API_BASE_URL}/api/admin/events/${eventId}/schedule?format=csv`, '_blank', 'noopener');
  }

  async function publish() {
    const next = !event?.schedulePublishedAt;
    await send(
      'publish',
      `/api/admin/events/${eventId}/schedule/publication`,
      { method: 'PATCH', body: { published: next, commandId: createCommandId('schedule-publish') } },
      copy.admin.schedule.publishError,
      next ? copy.admin.schedule.schedulePublished : copy.admin.schedule.scheduleHidden,
    );
  }

  /** Sends a court's complete desired order. The server pins started and finished matches. */
  async function reorderCourt(court: CourtDto, orderedIds: string[]) {
    const byId = new Map(court.scheduleItems.map((item) => [item.id, item]));
    await send(`reorder-${court.id}`, `/api/admin/events/${eventId}/schedule/reorder`, {
      method: 'POST',
      body: {
        courtId: court.id,
        items: orderedIds.map((id) => ({ id, version: byId.get(id)?.version ?? 0 })),
        commandId: createCommandId('schedule-reorder'),
      },
    }, copy.admin.schedule.reorderError, fillTemplate(copy.admin.schedule.queueReordered, { court: court.name }));
  }

  async function moveToCourt(item: ScheduleItemDto, targetCourtId: string, queuePosition?: number) {
    await send(`move-${item.id}`, `/api/admin/events/${eventId}/schedule/items/${item.id}`, {
      method: 'PATCH',
      body: { courtId: targetCourtId, queuePosition, expectedVersion: item.version, commandId: createCommandId('schedule-item-move') },
    }, copy.admin.schedule.moveError, fillTemplate(copy.admin.schedule.matchMoved, {
      number: item.match.matchNumber,
      court: courts.find((candidate) => candidate.id === targetCourtId)?.name ?? '',
    }));
  }

  function nudge(court: CourtDto, item: ScheduleItemDto, delta: number) {
    const order = nudgeOrder(court, item, delta);
    if (order) void reorderCourt(court, order);
  }

  function handleDragStart(dragEvent: DragStartEvent) {
    setDraggingId(String(dragEvent.active.id));
  }

  function handleDragEnd(dragEvent: DragEndEvent) {
    setDraggingId(null);
    const intent = resolveDrop(courts, String(dragEvent.active.id), String(dragEvent.over?.id ?? ''));
    if (intent.kind === 'reorder') {
      const court = courts.find((candidate) => candidate.id === intent.courtId);
      if (court) void reorderCourt(court, intent.orderedIds);
    } else if (intent.kind === 'move') {
      void moveToCourt(intent.item, intent.targetCourtId, intent.queuePosition);
    } else if (intent.kind === 'schedule') {
      void placeMatch(intent.matchId, intent.targetCourtId);
    } else if (intent.kind === 'unschedule') {
      void unschedule(intent.item);
    }
  }

  const draggingLabel = useDragLabel(draggingId, courts, waiting);

  return (
    <AdminShell title={copy.admin.schedule.title} description={copy.admin.schedule.description} eyebrow={copy.admin.common.eyebrow}>
      <div className="mb-4">
        <BackLink href={`/admin/events/${eventId}`}>{copy.admin.common.eventWorkspace}</BackLink>
      </div>

      {error ? <PageNotice tone="error" onDismiss={() => setError('')}>{error}</PageNotice> : null}
      {isCompleted ? <div className="mb-4"><Notice tone="warning">{copy.admin.schedule.readOnly}</Notice></div> : null}

      <ScheduleDayHeader
        event={event}
        summary={summary}
        action={(
          <CommandButton
            tone={event?.schedulePublishedAt ? 'default' : 'primary'}
            busy={busy === 'publish'}
            disabled={isCompleted}
            onClick={publish}
          >
            {event?.schedulePublishedAt ? copy.admin.schedule.unpublish : copy.admin.schedule.publish}
          </CommandButton>
        )}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggingId(null)}
      >
        <div className={styles.boardHead}>
          <div className="min-w-0">
            <h2 className={styles.boardTitle}>
              {copy.admin.schedule.activeCourts}
              {courts.length ? (
                <span className={styles.boardFlag} data-quiet={needAttention === 0}>
                  {needAttention
                    ? fillTemplate(copy.admin.schedule.courtsNeedYou, { count: needAttention })
                    : copy.admin.schedule.allCourtsReady}
                </span>
              ) : null}
            </h2>
            <p className={styles.boardHint}>
              {courts.length ? copy.admin.schedule.boardHint : copy.admin.schedule.noCourtsDetail}
            </p>
          </div>
          <div className={styles.boardActions}>
            {isCompleted ? null : (
              <>
                <CommandButton tone="primary" onClick={() => setDialog('court')}>
                  <Plus aria-hidden="true" /> {copy.admin.schedule.createCourt}
                </CommandButton>
                <CommandButton disabled={!courts.length || !waiting.length} onClick={() => setDialog('match')}>
                  <CalendarClock aria-hidden="true" /> {copy.admin.schedule.addMatch}
                </CommandButton>
                {/* Placing a 32-draw one drag at a time is thirty identical
                    drags; this deals them out and leaves every placement
                    draggable afterwards. */}
                <CommandButton
                  busy={busy === 'auto-fill'}
                  disabled={!courts.length || !waiting.length}
                  onClick={autoFill}
                >
                  <Wand2 aria-hidden="true" /> {copy.admin.schedule.autoFill}
                </CommandButton>
              </>
            )}
            <CommandButton disabled={!courts.length} onClick={exportSheet}>
              <Download aria-hidden="true" /> {copy.admin.schedule.exportSheet}
            </CommandButton>
          </div>
        </div>

        {loading && !courts.length ? (
          <SkeletonCards count={3} columns={4} label={copy.admin.schedule.loading} />
        ) : !courts.length ? (
          <TournamentPanel className="border-[var(--dash-border)] bg-white">
            <EmptyTournamentState title={copy.admin.schedule.noCourts} detail={copy.admin.schedule.noCourtsDetail} />
          </TournamentPanel>
        ) : (
          /* One column per court, with the waiting matches as the first of them.
             The strip scrolls inside itself, so a ten-court event never makes
             the page scroll sideways. */
          <div className={styles.board}>
            <UnscheduledPool
              busy={busy}
              categoryOf={categoryOf}
              courts={courts}
              locked={isCompleted}
              matches={waiting}
              onPlace={placeMatch}
            />
            {courts.map((court) => (
              <CourtColumn
                key={court.id}
                busy={busy}
                categoryOf={categoryOf}
                court={court}
                courts={courts}
                locked={isCompleted}
                onMoveToCourt={moveToCourt}
                onNudge={nudge}
                onUnschedule={unschedule}
              />
            ))}
          </div>
        )}

        <DragOverlay>
          {draggingLabel ? <div className={styles.dragGhost}>{draggingLabel}</div> : null}
        </DragOverlay>
      </DndContext>

      <CreateCourtDialog
        open={dialog === 'court'}
        onOpenChange={(open) => { if (!open) setDialog(null); }}
        busy={busy === 'court'}
        onSubmit={createCourt}
      />
      <AddMatchDialog
        open={dialog === 'match'}
        onOpenChange={(open) => { if (!open) setDialog(null); }}
        busy={busy === 'match'}
        categoryOf={categoryOf}
        courts={courts}
        matches={waiting}
        onSubmit={addMatch}
      />
    </AdminShell>
  );
}

/** What the drag ghost says, for both a queued item and a match from the holding area. */
function useDragLabel(draggingId: string | null, courts: CourtDto[], waiting: BracketDto['matches']) {
  const { locale } = useI18n();
  if (!draggingId) return null;
  if (draggingId.startsWith(POOL_ITEM_PREFIX)) {
    const match = waiting.find((candidate) => candidate.id === draggingId.slice(POOL_ITEM_PREFIX.length));
    return match ? matchTitle(locale, match) : null;
  }
  const item = courts.flatMap((court) => court.scheduleItems).find((candidate) => candidate.id === draggingId);
  return item ? matchTitle(locale, item.match) : null;
}
