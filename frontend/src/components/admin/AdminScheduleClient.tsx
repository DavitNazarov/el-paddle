'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, Plus } from 'lucide-react';
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
import { apiFetch, createCommandId } from '@/lib/api';
import type { EventDto } from '@/types/admin';
import type { BracketDto, CourtDto, ScheduleItemDto } from '@/types/tournament';
import { AdminShell } from './AdminShell';
import { BackLink, CommandButton, EmptyTournamentState, TournamentPanel } from '@/components/tournament/TournamentUI';
import { Notice, PageNotice, SkeletonCards } from '@/components/shared/dashboard/Feedback';
import { useTournamentRealtime } from '@/hooks/useTournamentRealtime';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import { CourtBoard } from './schedule/CourtBoard';
import { CourtDetail } from './schedule/CourtDetail';
import { EventJudgePanel } from './schedule/EventJudgePanel';
import { ScheduleDayHeader } from './schedule/ScheduleDayHeader';
import { AddJudgeDialog, AddMatchDialog, CreateCourtDialog, type JudgeForm, type MatchSelection } from './schedule/ScheduleDialogs';
import { UnscheduledPool } from './schedule/UnscheduledPool';
import {
  POOL_ITEM_PREFIX,
  buildDaySummary,
  courtNeedsAttention,
  courtState,
  matchTitle,
  nudgeOrder,
  resolveDrop,
  unscheduledMatches,
  type EventJudge,
} from './schedule/scheduleModel';
import styles from './schedule/Schedule.module.css';

export function AdminScheduleClient({ eventId }: { eventId: string }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const [event, setEvent] = useState<EventDto | null>(null);
  const [courts, setCourts] = useState<CourtDto[]>([]);
  const [brackets, setBrackets] = useState<BracketDto[]>([]);
  const [judges, setJudges] = useState<EventJudge[]>([]);
  const [dialog, setDialog] = useState<'court' | 'judge' | 'match' | null>(null);
  const [judgeNotice, setJudgeNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [openCourtId, setOpenCourtId] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement | null>(null);
  const isCompleted = event?.status === 'COMPLETED';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b, c, d] = await Promise.all([
        apiFetch(`/api/events/${eventId}`, { cache: 'no-store' }),
        apiFetch(`/api/admin/events/${eventId}/schedule`, { cache: 'no-store' }),
        apiFetch(`/api/admin/events/${eventId}/brackets`, { cache: 'no-store' }),
        apiFetch(`/api/admin/events/${eventId}/judges`, { cache: 'no-store' }),
      ]);
      const eventData = await a.json() as { event?: EventDto; error?: string };
      const scheduleData = await b.json() as { courts?: CourtDto[]; error?: string };
      const bracketData = await c.json() as { brackets?: BracketDto[] };
      const userData = await d.json() as { judges?: EventJudge[] };
      if (!a.ok || !b.ok) setError(eventData.error ?? scheduleData.error ?? copy.admin.schedule.loadError);
      else {
        setEvent(eventData.event ?? null);
        setCourts(scheduleData.courts ?? []);
        setBrackets(bracketData.brackets ?? []);
        setJudges(userData.judges ?? []);
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
  // Derived rather than synced: a court can disappear under us on any refresh.
  const openCourt = courts.find((court) => court.id === openCourtId) ?? courts[0] ?? null;
  const needAttention = courts.filter((court) => courtNeedsAttention(courtState(court))).length;

  /** Opening a court from the board must land the reader on the queue, not leave it below the fold. */
  const openCourtAt = useCallback((courtId: string) => {
    setOpenCourtId(courtId);
    window.requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: 'nearest' }));
  }, []);

  function stepCourt(delta: number) {
    if (!openCourt || courts.length < 2) return;
    const index = courts.findIndex((court) => court.id === openCourt.id);
    openCourtAt(courts[(index + delta + courts.length) % courts.length]!.id);
  }

  /** One request helper: every schedule command differs only in route, body, and message. */
  const send = useCallback(async (
    key: string,
    path: string,
    init: { method: string; body?: unknown },
    failure: string,
  ) => {
    setBusy(key);
    setError('');
    const response = await apiFetch(path, {
      method: init.method,
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
    const data = await response.json().catch(() => ({})) as { error?: string; invited?: boolean };
    setBusy('');
    if (!response.ok) { setError(data.error ?? failure); return null; }
    void load();
    return data;
  }, [load]);

  async function createCourt(name: string) {
    if (!name.trim()) return;
    const result = await send('court', `/api/admin/events/${eventId}/courts`, { method: 'POST', body: { name } }, copy.admin.schedule.createError);
    if (result) setDialog(null);
  }

  async function addJudge(form: JudgeForm) {
    setJudgeNotice('');
    const result = await send('judge-add', `/api/admin/events/${eventId}/judges`, { method: 'POST', body: form }, copy.admin.judges.addError);
    if (!result) return;
    setJudgeNotice(fillTemplate(result.invited ? copy.admin.judges.invited : copy.admin.judges.added, { email: form.email }));
    setDialog(null);
  }

  async function removeJudge(judge: EventJudge) {
    setJudgeNotice('');
    await send(`judge-remove-${judge.id}`, `/api/admin/events/${eventId}/judges/${judge.id}`, { method: 'DELETE' }, copy.admin.judges.removeError);
  }

  async function assignJudge(court: CourtDto, judgeId: string) {
    if (!event || !judgeId) return;
    // The assignment window brackets the event day so a judge is never refused for timing.
    const startsAt = new Date(event.date);
    startsAt.setHours(startsAt.getHours() - 2);
    const endsAt = new Date(event.date);
    endsAt.setHours(endsAt.getHours() + 12);
    await send(
      `judge-${court.id}`,
      `/api/admin/events/${eventId}/courts/${court.id}/judge-assignments`,
      { method: 'POST', body: { judgeId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() } },
      copy.admin.schedule.assignError,
    );
  }

  async function addMatch(selection: MatchSelection) {
    if (!selection.courtId || !selection.matchId) return;
    const result = await send('match', `/api/admin/events/${eventId}/schedule/items`, {
      method: 'POST',
      body: { ...selection, plannedStartAt: selection.plannedStartAt ? new Date(selection.plannedStartAt).toISOString() : undefined },
    }, copy.admin.schedule.matchError);
    if (result) setDialog(null);
  }

  async function placeMatch(matchId: string, courtId: string) {
    await send(`place-${matchId}`, `/api/admin/events/${eventId}/schedule/items`, { method: 'POST', body: { matchId, courtId } }, copy.admin.schedule.matchError);
  }

  async function unschedule(item: ScheduleItemDto) {
    await send(`remove-${item.id}`, `/api/admin/events/${eventId}/schedule/items/${item.id}`, { method: 'DELETE' }, copy.admin.schedule.removeError);
  }

  async function publish() {
    await send('publish', `/api/admin/events/${eventId}/schedule/publication`, {
      method: 'PATCH',
      body: { published: !event?.schedulePublishedAt, commandId: createCommandId('schedule-publish') },
    }, copy.admin.schedule.publishError);
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
    }, copy.admin.schedule.reorderError);
  }

  async function moveToCourt(item: ScheduleItemDto, targetCourtId: string, queuePosition?: number) {
    await send(`move-${item.id}`, `/api/admin/events/${eventId}/schedule/items/${item.id}`, {
      method: 'PATCH',
      body: { courtId: targetCourtId, queuePosition, expectedVersion: item.version, commandId: createCommandId('schedule-item-move') },
    }, copy.admin.schedule.moveError);
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
        <div className={styles.layout}>
          <div>
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
                <p className={styles.boardHint}>{courts.length ? copy.admin.schedule.boardHint : copy.admin.schedule.noCourtsDetail}</p>
              </div>
              {isCompleted ? null : (
                <div className={styles.boardActions}>
                  <CommandButton tone="primary" onClick={() => setDialog('court')}>
                    <Plus aria-hidden="true" /> {copy.admin.schedule.createCourt}
                  </CommandButton>
                  <CommandButton disabled={!courts.length || !waiting.length} onClick={() => setDialog('match')}>
                    <CalendarClock aria-hidden="true" /> {copy.admin.schedule.addMatch}
                  </CommandButton>
                </div>
              )}
            </div>

            {loading && !courts.length ? <SkeletonCards count={2} columns={2} label={copy.admin.schedule.loading} /> : null}

            {courts.length ? (
              <>
                <CourtBoard courts={courts} selectedCourtId={openCourt?.id ?? null} onSelect={openCourtAt} />
                {openCourt ? (
                  <div ref={detailRef} className={styles.detailAnchor}>
                    <CourtDetail
                      busy={busy}
                      court={openCourt}
                      courts={courts}
                      judges={judges}
                      locked={isCompleted}
                      onAssign={assignJudge}
                      onMoveToCourt={moveToCourt}
                      onNudge={nudge}
                      onStep={stepCourt}
                      onUnschedule={unschedule}
                    />
                  </div>
                ) : null}
              </>
            ) : loading ? null : (
              <TournamentPanel className="border-[var(--dash-border)] bg-white">
                <EmptyTournamentState title={copy.admin.schedule.noCourts} detail={copy.admin.schedule.noCourtsDetail} />
              </TournamentPanel>
            )}
          </div>

          <div className={styles.rail}>
            <UnscheduledPool
              busy={busy}
              courts={courts}
              locked={isCompleted}
              matches={waiting}
              onPlace={placeMatch}
            />
            <EventJudgePanel
              busy={busy}
              judges={judges}
              locked={isCompleted}
              notice={judgeNotice}
              onAdd={() => { setJudgeNotice(''); setDialog('judge'); }}
              onRemove={removeJudge}
            />
          </div>
        </div>

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
      <AddJudgeDialog
        open={dialog === 'judge'}
        onOpenChange={(open) => { if (!open) setDialog(null); }}
        busy={busy === 'judge-add'}
        onSubmit={addJudge}
      />
      <AddMatchDialog
        open={dialog === 'match'}
        onOpenChange={(open) => { if (!open) setDialog(null); }}
        busy={busy === 'match'}
        courts={courts}
        judges={judges}
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
