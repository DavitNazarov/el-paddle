'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, ChevronDown, ChevronUp, CircleAlert, GripVertical, Lock, MapPin, Plus, Timer, UsersRound } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { apiFetch, createCommandId } from '@/lib/api';
import type { EventDto } from '@/types/admin';
import type { BracketDto, CourtDto, MatchDto, ScheduleItemDto } from '@/types/tournament';
import { AdminShell } from './AdminShell';
import { BackLink, CommandButton, EmptyTournamentState, InlineNotice, TournamentPanel, TournamentSectionHeader } from '@/components/tournament/TournamentUI';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DashboardField, DashboardModal, formControlClassName, selectControlClassName } from '@/components/shared/dashboard/DashboardUI';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import { useTournamentRealtime } from '@/hooks/useTournamentRealtime';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy, tournamentRound, tournamentStatus } from '@/lib/i18n/tournament';

const COURT_DROPPABLE_PREFIX = 'court:';

/** Started and finished matches are pinned; the server rejects any attempt to move them. */
function isFrozen(item: ScheduleItemDto) {
  return item.status === 'IN_PROGRESS' || item.status === 'COMPLETED';
}

function isQueueFinished(court: CourtDto) {
  return court.scheduleItems.length > 0 && court.scheduleItems.every((item) => item.status === 'COMPLETED' || item.status === 'CANCELLED');
}

/** Lowest 1-based position a movable match may take on a court. */
function firstMovablePosition(items: ScheduleItemDto[]) {
  const frozen = items.filter(isFrozen);
  return frozen.length ? Math.max(...frozen.map((item) => item.queuePosition)) + 1 : 1;
}

/** A judge admitted to this event. Only these may be assigned to its courts. */
type EventJudge = { id: string; name: string | null; surname: string | null; email: string };

function judgeName(judge: EventJudge) {
  return [judge.name, judge.surname].filter(Boolean).join(' ') || judge.email;
}

export function AdminScheduleClient({ eventId }: { eventId: string }) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale];
  const [event, setEvent] = useState<EventDto | null>(null);
  const [courts, setCourts] = useState<CourtDto[]>([]);
  const [brackets, setBrackets] = useState<BracketDto[]>([]);
  const [judges, setJudges] = useState<EventJudge[]>([]);
  const [judgeForm, setJudgeForm] = useState({ email: '', name: '', surname: '' });
  const [addJudgeOpen, setAddJudgeOpen] = useState(false);
  const [judgeNotice, setJudgeNotice] = useState('');
  const [courtName, setCourtName] = useState('');
  const [selection, setSelection] = useState({ courtId: '', matchId: '', judgeId: '', plannedStartAt: '' });
  const [createCourtOpen, setCreateCourtOpen] = useState(false);
  const [addMatchOpen, setAddMatchOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const isCompleted = event?.status === 'COMPLETED';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b, c, d] = await Promise.all([apiFetch(`/api/events/${eventId}`, { cache: 'no-store' }), apiFetch(`/api/admin/events/${eventId}/schedule`, { cache: 'no-store' }), apiFetch(`/api/admin/events/${eventId}/brackets`, { cache: 'no-store' }), apiFetch(`/api/admin/events/${eventId}/judges`, { cache: 'no-store' })]);
      const eventData = await a.json() as { event?: EventDto; error?: string };
      const scheduleData = await b.json() as { courts?: CourtDto[]; error?: string };
      const bracketData = await c.json() as { brackets?: BracketDto[] };
      const userData = await d.json() as { judges?: EventJudge[] };
      if (!a.ok || !b.ok) setError(eventData.error ?? scheduleData.error ?? copy.admin.schedule.loadError);
      else { setEvent(eventData.event ?? null); setCourts(scheduleData.courts ?? []); setBrackets(bracketData.brackets ?? []); setJudges(userData.judges ?? []); }
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

  const unscheduledMatches = useMemo(() => {
    const scheduled = new Set(courts.flatMap((court) => court.scheduleItems.map((item) => item.matchId)));
    return brackets.flatMap((bracket) => bracket.matches).filter((match) => !scheduled.has(match.id) && match.status !== 'COMPLETED');
  }, [brackets, courts]);

  const scheduledMatches = courts.reduce((total, court) => total + court.scheduleItems.length, 0);
  const staffedCourts = courts.filter((court) => court.judgeAssignments.length > 0).length;
  const draggingItem = draggingId ? courts.flatMap((court) => court.scheduleItems).find((item) => item.id === draggingId) ?? null : null;

  async function createCourt() {
    if (!courtName.trim()) return;
    setBusy('court'); setError('');
    const response = await apiFetch(`/api/admin/events/${eventId}/courts`, { method: 'POST', body: JSON.stringify({ name: courtName }) });
    const data = await response.json() as { error?: string };
    setBusy(''); if (!response.ok) setError(data.error ?? copy.admin.schedule.createError); else { setCourtName(''); setCreateCourtOpen(false); void load(); }
  }

  async function addJudge() {
    setBusy('judge-add'); setError(''); setJudgeNotice('');
    const response = await apiFetch(`/api/admin/events/${eventId}/judges`, { method: 'POST', body: JSON.stringify(judgeForm) });
    const data = await response.json() as { invited?: boolean; error?: string };
    setBusy('');
    if (!response.ok) { setError(data.error ?? copy.admin.judges.addError); return; }
    setJudgeNotice(fillTemplate(data.invited ? copy.admin.judges.invited : copy.admin.judges.added, { email: judgeForm.email }));
    setAddJudgeOpen(false);
    void load();
  }

  async function removeJudge(judge: EventJudge) {
    setBusy(`judge-remove-${judge.id}`); setError(''); setJudgeNotice('');
    const response = await apiFetch(`/api/admin/events/${eventId}/judges/${judge.id}`, { method: 'DELETE' });
    const data = await response.json() as { error?: string };
    setBusy('');
    if (!response.ok) { setError(data.error ?? copy.admin.judges.removeError); return; }
    void load();
  }

  async function assignJudge(court: CourtDto, judgeId: string) {
    if (!event || !judgeId) return;
    setBusy(`judge-${court.id}`); setError('');
    const start = new Date(event.date); start.setHours(start.getHours() - 2);
    const end = new Date(event.date); end.setHours(end.getHours() + 12);
    const response = await apiFetch(`/api/admin/events/${eventId}/courts/${court.id}/judge-assignments`, { method: 'POST', body: JSON.stringify({ judgeId, startsAt: start.toISOString(), endsAt: end.toISOString() }) });
    const data = await response.json() as { error?: string };
    setBusy(''); if (!response.ok) setError(data.error ?? copy.admin.schedule.assignError); else void load();
  }

  async function addMatch() {
    if (!selection.courtId || !selection.matchId) return;
    setBusy('match'); setError('');
    const response = await apiFetch(`/api/admin/events/${eventId}/schedule/items`, { method: 'POST', body: JSON.stringify({ ...selection, plannedStartAt: selection.plannedStartAt ? new Date(selection.plannedStartAt).toISOString() : undefined }) });
    const data = await response.json() as { error?: string };
    setBusy(''); if (!response.ok) setError(data.error ?? copy.admin.schedule.matchError); else { setSelection({ courtId: '', matchId: '', judgeId: '', plannedStartAt: '' }); setAddMatchOpen(false); void load(); }
  }

  async function publish() {
    setBusy('publish'); setError('');
    const response = await apiFetch(`/api/admin/events/${eventId}/schedule/publication`, { method: 'PATCH', body: JSON.stringify({ published: !event?.schedulePublishedAt, commandId: createCommandId('schedule-publish') }) });
    const data = await response.json() as { error?: string };
    setBusy(''); if (!response.ok) setError(data.error ?? copy.admin.schedule.publishError); else void load();
  }

  /** Sends a court's complete desired order. The server pins started and finished matches. */
  async function reorderCourt(court: CourtDto, orderedIds: string[]) {
    setBusy(`reorder-${court.id}`); setError('');
    const byId = new Map(court.scheduleItems.map((item) => [item.id, item]));
    const response = await apiFetch(`/api/admin/events/${eventId}/schedule/reorder`, {
      method: 'POST',
      body: JSON.stringify({
        courtId: court.id,
        items: orderedIds.map((id) => ({ id, version: byId.get(id)?.version ?? 0 })),
        commandId: createCommandId('schedule-reorder'),
      }),
    });
    const data = await response.json() as { error?: string };
    setBusy('');
    if (!response.ok) setError(data.error ?? copy.admin.schedule.reorderError);
    void load();
  }

  async function moveToCourt(item: ScheduleItemDto, targetCourtId: string, queuePosition?: number) {
    setBusy(`move-${item.id}`); setError('');
    const response = await apiFetch(`/api/admin/events/${eventId}/schedule/items/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ courtId: targetCourtId, queuePosition, expectedVersion: item.version, commandId: createCommandId('schedule-item-move') }),
    });
    const data = await response.json() as { error?: string };
    setBusy('');
    if (!response.ok) setError(data.error ?? copy.admin.schedule.moveError);
    void load();
  }

  function moveWithinCourt(court: CourtDto, item: ScheduleItemDto, delta: number) {
    const ids = court.scheduleItems.map((entry) => entry.id);
    const from = ids.indexOf(item.id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]!);
    void reorderCourt(court, ids);
  }

  function handleDragStart(dragEvent: DragStartEvent) {
    setDraggingId(String(dragEvent.active.id));
  }

  function handleDragEnd(dragEvent: DragEndEvent) {
    setDraggingId(null);
    const { active, over } = dragEvent;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const sourceCourt = courts.find((court) => court.scheduleItems.some((entry) => entry.id === activeId));
    const item = sourceCourt?.scheduleItems.find((entry) => entry.id === activeId);
    if (!sourceCourt || !item) return;

    const targetCourt = overId.startsWith(COURT_DROPPABLE_PREFIX)
      ? courts.find((court) => court.id === overId.slice(COURT_DROPPABLE_PREFIX.length))
      : courts.find((court) => court.scheduleItems.some((entry) => entry.id === overId));
    if (!targetCourt || isQueueFinished(targetCourt)) return;

    if (targetCourt.id === sourceCourt.id) {
      const ids = sourceCourt.scheduleItems.map((entry) => entry.id);
      const from = ids.indexOf(activeId);
      const to = overId.startsWith(COURT_DROPPABLE_PREFIX) ? ids.length - 1 : ids.indexOf(overId);
      if (from < 0 || to < 0 || from === to) return;
      ids.splice(to, 0, ids.splice(from, 1)[0]!);
      void reorderCourt(sourceCourt, ids);
      return;
    }

    const targetIds = targetCourt.scheduleItems.map((entry) => entry.id);
    const dropIndex = overId.startsWith(COURT_DROPPABLE_PREFIX) ? targetIds.length : targetIds.indexOf(overId);
    const position = Math.max(dropIndex + 1, firstMovablePosition(targetCourt.scheduleItems));
    void moveToCourt(item, targetCourt.id, position);
  }

  return (
    <AdminShell title={copy.admin.schedule.title} description={copy.admin.schedule.description} eyebrow={copy.admin.common.eyebrow}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><BackLink href={`/admin/events/${eventId}`}>{copy.admin.common.eventWorkspace}</BackLink><CommandButton tone={event?.schedulePublishedAt ? 'default' : 'primary'} busy={busy === 'publish'} disabled={isCompleted} onClick={publish}>{event?.schedulePublishedAt ? copy.admin.schedule.unpublish : copy.admin.schedule.publish}</CommandButton></div>
      {isCompleted ? <div className="mb-4"><InlineNotice kind="info">{copy.admin.schedule.readOnly}</InlineNotice></div> : null}
      {error ? <div className="mb-4"><InlineNotice kind="error">{error}</InlineNotice></div> : null}
      <section aria-label={copy.admin.schedule.overview} className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ScheduleMetric icon={CalendarClock} label={copy.admin.schedule.eventDay} value={event ? formatDate(event.date, { weekday: 'short', month: 'short', day: 'numeric' }) : copy.common.loading} />
        <ScheduleMetric icon={MapPin} label={copy.admin.schedule.activeCourts} value={fillTemplate(copy.admin.schedule.courtsCount, { count: courts.length })} detail={courts.length ? fillTemplate(copy.admin.schedule.staffed, { count: staffedCourts }) : copy.admin.schedule.createToBegin} />
        <ScheduleMetric icon={Timer} label={copy.admin.schedule.inQueue} value={fillTemplate(copy.admin.schedule.matchesCount, { count: scheduledMatches })} detail={fillTemplate(copy.admin.schedule.unscheduled, { count: unscheduledMatches.length })} />
        <ScheduleMetric icon={event?.schedulePublishedAt ? UsersRound : CircleAlert} label={copy.admin.schedule.publicSchedule} value={event?.schedulePublishedAt ? copy.admin.bracket.published : copy.admin.schedule.draft} detail={event?.schedulePublishedAt ? copy.admin.schedule.visiblePlayers : copy.admin.schedule.adminsOnly} tone={event?.schedulePublishedAt ? 'success' : 'warning'} />
      </section>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          {loading ? <TournamentPanel className="border-[var(--dash-border)] bg-white"><EmptyTournamentState title={copy.admin.schedule.loading} /></TournamentPanel> : null}
          {!loading && courts.length ? <p className="text-xs leading-5 text-[var(--dash-muted)]">{copy.admin.schedule.dragHint}</p> : null}
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setDraggingId(null)}>
            <div className="space-y-4">
              {!loading && courts.map((court) => (
                <CourtQueue
                  key={court.id}
                  busy={busy}
                  court={court}
                  courts={courts}
                  judges={judges}
                  locked={isCompleted}
                  onAssign={assignJudge}
                  onMoveToCourt={moveToCourt}
                  onNudge={moveWithinCourt}
                />
              ))}
            </div>
            <DragOverlay>
              {draggingItem ? (
                <div className="rounded-xl border border-[var(--dash-primary)] bg-white px-4 py-3 text-sm font-semibold text-[var(--dash-text)] shadow-lg">
                  {tournamentRound(locale, draggingItem.match.round)} · {copy.common.match} {draggingItem.match.matchNumber}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
          {!loading && !courts.length ? <TournamentPanel className="border-[var(--dash-border)] bg-white"><EmptyTournamentState title={copy.admin.schedule.noCourts} detail={copy.admin.schedule.noCourtsDetail} /></TournamentPanel> : null}
        </div>
        <div className="space-y-4">
          <TournamentPanel className="border-[var(--dash-border)] bg-white">
            <TournamentSectionHeader title={copy.admin.schedule.actions} description={copy.admin.schedule.actionsDescription} />
            <div className="space-y-3 p-4">
              <CommandButton tone="primary" className="w-full" disabled={isCompleted} onClick={() => setCreateCourtOpen(true)}><Plus /> {copy.admin.schedule.createCourt}</CommandButton>
              <CommandButton className="w-full border-[var(--dash-border)] bg-white text-[var(--dash-text)] hover:bg-[#fdf9f7] hover:text-[var(--dash-text)]" disabled={isCompleted || !courts.length || !unscheduledMatches.length} onClick={() => setAddMatchOpen(true)}><CalendarClock /> {copy.admin.schedule.addMatch}</CommandButton>
              {!courts.length ? <p className="text-xs leading-5 text-[var(--dash-muted)]">{copy.admin.schedule.createBeforeMatches}</p> : !unscheduledMatches.length ? <p className="text-xs leading-5 text-[var(--dash-muted)]">{copy.admin.schedule.allScheduled}</p> : null}
            </div>
          </TournamentPanel>

          <TournamentPanel className="border-[var(--dash-border)] bg-white">
            <TournamentSectionHeader
              title={copy.admin.judges.title}
              description={copy.admin.judges.description}
              actions={<CommandButton tone="primary" busy={busy === 'judge-add'} disabled={isCompleted} onClick={() => { setJudgeForm({ email: '', name: '', surname: '' }); setJudgeNotice(''); setAddJudgeOpen(true); }}><Plus /> {copy.admin.judges.add}</CommandButton>}
            />
            <div className="space-y-3 p-4">
              {judgeNotice ? <InlineNotice kind="success">{judgeNotice}</InlineNotice> : null}
              {judges.length ? (
                <ul className="grid gap-2">
                  {judges.map((judge) => (
                    <li key={judge.id} className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--dash-text)]">
                      <span>
                        {judgeName(judge)}
                        <span className="text-[var(--dash-muted)]"> · {judge.email}</span>
                      </span>
                      <CommandButton tone="danger" busy={busy === `judge-remove-${judge.id}`} disabled={isCompleted} onClick={() => void removeJudge(judge)}>
                        {copy.admin.judges.remove}
                      </CommandButton>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs leading-5 text-[var(--dash-muted)]">{copy.admin.judges.none}</p>
              )}
            </div>
          </TournamentPanel>
        </div>
      </div>

      <DashboardModal
        open={createCourtOpen}
        onOpenChange={setCreateCourtOpen}
        title={copy.admin.schedule.createCourt}
        description={copy.admin.schedule.createCourtDescription}
        footer={<ModalFormFooter formId="create-court-form" onCancel={() => setCreateCourtOpen(false)} cancelLabel={copy.common.cancel} busy={busy === 'court'} disabled={!courtName.trim()} submitLabel={busy === 'court' ? copy.admin.schedule.creating : copy.admin.schedule.createCourt} />}
      >
        <form id="create-court-form" onSubmit={(formEvent) => { formEvent.preventDefault(); void createCourt(); }}>
          <DashboardField label={copy.admin.schedule.courtName} id="court-name">
            <Input id="court-name" autoFocus required value={courtName} onChange={(fieldEvent) => setCourtName(fieldEvent.target.value)} placeholder={copy.admin.schedule.courtPlaceholder} className={formControlClassName} />
          </DashboardField>
        </form>
      </DashboardModal>

      <DashboardModal
        open={addJudgeOpen}
        onOpenChange={setAddJudgeOpen}
        title={copy.admin.judges.addTitle}
        description={copy.admin.judges.addDescription}
        footer={<ModalFormFooter formId="add-judge-form" onCancel={() => setAddJudgeOpen(false)} cancelLabel={copy.common.cancel} busy={busy === 'judge-add'} disabled={!judgeForm.email.trim() || !judgeForm.name.trim() || !judgeForm.surname.trim()} submitLabel={busy === 'judge-add' ? copy.admin.judges.adding : copy.admin.judges.add} />}
      >
        <form id="add-judge-form" onSubmit={(formEvent) => { formEvent.preventDefault(); void addJudge(); }} className="space-y-4">
          <DashboardField label={copy.admin.judges.email} id="judge-email">
            <Input id="judge-email" autoFocus required type="email" value={judgeForm.email} onChange={(fieldEvent) => setJudgeForm((current) => ({ ...current, email: fieldEvent.target.value }))} className={formControlClassName} />
          </DashboardField>
          <DashboardField label={copy.admin.judges.firstName} id="judge-name">
            <Input id="judge-name" required value={judgeForm.name} onChange={(fieldEvent) => setJudgeForm((current) => ({ ...current, name: fieldEvent.target.value }))} className={formControlClassName} />
          </DashboardField>
          <DashboardField label={copy.admin.judges.lastName} id="judge-surname">
            <Input id="judge-surname" required value={judgeForm.surname} onChange={(fieldEvent) => setJudgeForm((current) => ({ ...current, surname: fieldEvent.target.value }))} className={formControlClassName} />
          </DashboardField>
        </form>
      </DashboardModal>

      <DashboardModal
        open={addMatchOpen}
        onOpenChange={setAddMatchOpen}
        title={copy.admin.schedule.addMatch}
        description={copy.admin.schedule.addMatchDescription}
        size="lg"
        footer={<ModalFormFooter formId="add-match-form" onCancel={() => setAddMatchOpen(false)} cancelLabel={copy.common.cancel} busy={busy === 'match'} disabled={!selection.courtId || !selection.matchId} submitLabel={busy === 'match' ? copy.admin.schedule.adding : copy.admin.schedule.addToQueue} />}
      >
        <form id="add-match-form" onSubmit={(formEvent) => { formEvent.preventDefault(); void addMatch(); }} className="space-y-4">
          <FieldSelect label={copy.admin.schedule.court} disabled={!courts.length} value={selection.courtId} onChange={(value) => setSelection((current) => ({ ...current, courtId: value }))} options={courts.filter((court) => !isQueueFinished(court)).map((court) => ({ value: court.id, label: court.name }))} />
          <FieldSelect label={copy.admin.schedule.match} disabled={!unscheduledMatches.length} value={selection.matchId} onChange={(value) => setSelection((current) => ({ ...current, matchId: value }))} options={unscheduledMatches.map((match) => ({ value: match.id, label: `${tournamentRound(locale, match.round)} · ${copy.common.match} ${match.matchNumber}` }))} />
          <FieldSelect label={copy.admin.schedule.judge} value={selection.judgeId} onChange={(value) => setSelection((current) => ({ ...current, judgeId: value }))} options={judges.map((judge) => ({ value: judge.id, label: judgeName(judge) }))} optional />
          <DashboardField label={copy.admin.schedule.plannedStart} id="planned-start" hint={copy.admin.schedule.optional}>
            <Input id="planned-start" className={formControlClassName} type="datetime-local" value={selection.plannedStartAt} onChange={(fieldEvent) => setSelection((current) => ({ ...current, plannedStartAt: fieldEvent.target.value }))} />
          </DashboardField>
        </form>
      </DashboardModal>
    </AdminShell>
  );
}

function CourtQueue({
  busy,
  court,
  courts,
  judges,
  locked,
  onAssign,
  onMoveToCourt,
  onNudge,
}: {
  busy: string;
  court: CourtDto;
  courts: CourtDto[];
  judges: EventJudge[];
  locked: boolean;
  onAssign: (court: CourtDto, judgeId: string) => void;
  onMoveToCourt: (item: ScheduleItemDto, targetCourtId: string) => void;
  onNudge: (court: CourtDto, item: ScheduleItemDto, delta: number) => void;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const currentJudge = court.judgeAssignments[0]?.judge;
  const finished = isQueueFinished(court);
  const { setNodeRef } = useDroppable({ id: `${COURT_DROPPABLE_PREFIX}${court.id}`, disabled: locked || finished });
  const itemIds = court.scheduleItems.map((item) => item.id);

  return (
    <TournamentPanel className="overflow-hidden border-[var(--dash-border)] bg-white">
      <TournamentSectionHeader
        title={court.name}
        description={court.location || fillTemplate(copy.admin.schedule.queuedMatches, { count: court.scheduleItems.length })}
        actions={(
          <div className="flex flex-wrap items-end gap-3">
            {finished ? <span className="inline-flex min-h-7 items-center rounded-full border border-[rgba(22,128,106,0.25)] bg-[var(--dash-teal-soft)] px-2.5 text-xs font-semibold text-[var(--dash-teal)]">{copy.admin.schedule.queueFinished}</span> : null}
            <div className="min-w-[12rem]">
              <Label htmlFor={`judge-${court.id}`} className="mb-1.5 block text-xs text-[var(--dash-muted)]">{copy.admin.schedule.assignedJudge}</Label>
              <select
                id={`judge-${court.id}`}
                aria-label={`${copy.admin.schedule.assignJudge}: ${court.name}`}
                className={`${selectControlClassName} h-10 bg-white`}
                value={currentJudge?.id ?? ''}
                disabled={locked || busy === `judge-${court.id}`}
                onChange={(fieldEvent) => onAssign(court, fieldEvent.target.value)}
              >
                <option value="">{copy.admin.schedule.assignJudge}</option>
                {judges.map((judge) => <option key={judge.id} value={judge.id}>{judgeName(judge)}</option>)}
              </select>
            </div>
          </div>
        )}
      />
      {court.scheduleItems.length ? (
        <div ref={setNodeRef}>
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            <ol className="divide-y divide-[var(--dash-border)]">
              {court.scheduleItems.map((item, index) => (
                <QueueRow
                  key={item.id}
                  busy={busy}
                  court={court}
                  courts={courts}
                  index={index}
                  item={item}
                  locked={locked || finished}
                  onMoveToCourt={onMoveToCourt}
                  onNudge={onNudge}
                  total={court.scheduleItems.length}
                />
              ))}
            </ol>
          </SortableContext>
        </div>
      ) : (
        <div ref={setNodeRef}>
          <EmptyTournamentState title={copy.admin.schedule.emptyQueue} detail={copy.admin.schedule.emptyQueueDetail} />
        </div>
      )}
    </TournamentPanel>
  );
}

function QueueRow({
  busy,
  court,
  courts,
  index,
  item,
  locked,
  onMoveToCourt,
  onNudge,
  total,
}: {
  busy: string;
  court: CourtDto;
  courts: CourtDto[];
  index: number;
  item: ScheduleItemDto;
  locked: boolean;
  onMoveToCourt: (item: ScheduleItemDto, targetCourtId: string) => void;
  onNudge: (court: CourtDto, item: ScheduleItemDto, delta: number) => void;
  total: number;
}) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale];
  const frozen = isFrozen(item);
  const movable = !locked && !frozen;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !movable });
  const lowestPosition = firstMovablePosition(court.scheduleItems);
  const otherCourts = courts.filter((candidate) => candidate.id !== court.id && !isQueueFinished(candidate));

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`flex flex-col gap-3 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex min-w-0 gap-3">
        {movable ? (
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 cursor-grab items-center justify-center rounded-lg text-[var(--dash-faint)] hover:bg-[#f7ede9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--dash-primary)]"
            aria-label={fillTemplate(copy.admin.schedule.dragHandle, { number: item.match.matchNumber })}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center text-[var(--dash-faint)]" title={copy.admin.schedule.frozenItem}>
            <Lock className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{copy.admin.schedule.frozenItem}</span>
          </span>
        )}
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${index === 0 ? 'bg-[var(--dash-primary-soft)] text-[var(--dash-primary)]' : 'bg-[#f7ede9] text-[var(--dash-muted)]'}`}>{item.queuePosition}</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--dash-text)]">{tournamentRound(locale, item.match.round)} · {copy.common.match} {item.match.matchNumber}</p>
          <p className="mt-1 text-sm text-[var(--dash-muted)]">{matchPair(item.match, copy.common.tbd, copy.common.versus)}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <ScheduleStatus status={item.status} />
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--dash-muted)]">
          <CalendarClock className="h-3.5 w-3.5" />
          {item.plannedStartAt ? formatDate(item.plannedStartAt, { hour: 'numeric', minute: '2-digit' }) : copy.admin.schedule.timeNotSet}
        </span>
        {movable ? (
          <>
            <CommandButton
              className="min-h-11 w-11 px-0"
              aria-label={fillTemplate(copy.admin.schedule.moveUp, { number: item.match.matchNumber, court: court.name })}
              disabled={item.queuePosition <= lowestPosition || busy === `reorder-${court.id}`}
              onClick={() => onNudge(court, item, -1)}
            >
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            </CommandButton>
            <CommandButton
              className="min-h-11 w-11 px-0"
              aria-label={fillTemplate(copy.admin.schedule.moveDown, { number: item.match.matchNumber, court: court.name })}
              disabled={index >= total - 1 || busy === `reorder-${court.id}`}
              onClick={() => onNudge(court, item, 1)}
            >
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </CommandButton>
            {otherCourts.length ? (
              <select
                className={`${selectControlClassName} h-11 w-auto bg-white text-xs`}
                aria-label={fillTemplate(copy.admin.schedule.moveToCourtLabel, { number: item.match.matchNumber })}
                value=""
                disabled={busy === `move-${item.id}`}
                onChange={(fieldEvent) => { if (fieldEvent.target.value) onMoveToCourt(item, fieldEvent.target.value); }}
              >
                <option value="">{copy.admin.schedule.moveToCourt}</option>
                {otherCourts.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
              </select>
            ) : null}
          </>
        ) : null}
      </div>
    </li>
  );
}

function ScheduleMetric({ icon: Icon, label, value, detail, tone = 'default' }: { icon: typeof CalendarClock; label: string; value: string; detail?: string; tone?: 'default' | 'success' | 'warning' }) {
  const toneClass = tone === 'success' ? 'bg-[var(--dash-teal-soft)] text-[var(--dash-teal)]' : tone === 'warning' ? 'bg-[var(--dash-amber-soft)] text-[var(--dash-amber)]' : 'bg-[var(--dash-primary-soft)] text-[var(--dash-primary)]';
  return <div className="rounded-xl border border-[var(--dash-border)] bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--dash-faint)]">{label}</p><p className="mt-2 text-lg font-semibold text-[var(--dash-text)]">{value}</p>{detail ? <p className="mt-1 text-xs text-[var(--dash-muted)]">{detail}</p> : null}</div><span className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneClass}`}><Icon className="h-4 w-4" /></span></div></div>;
}

function ScheduleStatus({ status }: { status: CourtDto['scheduleItems'][number]['status'] }) {
  const { locale } = useI18n();
  const styles = status === 'IN_PROGRESS' ? 'border-[rgba(61,103,150,0.25)] bg-[var(--dash-info-soft)] text-[var(--dash-info)]' : status === 'COMPLETED' ? 'border-[rgba(22,128,106,0.25)] bg-[var(--dash-teal-soft)] text-[var(--dash-teal)]' : status === 'CANCELLED' ? 'border-[rgba(194,65,59,0.25)] bg-[var(--dash-coral-soft)] text-[var(--dash-coral)]' : 'border-[rgba(168,103,18,0.25)] bg-[var(--dash-amber-soft)] text-[var(--dash-amber)]';
  return <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-semibold ${styles}`}>{tournamentStatus(locale, status)}</span>;
}

function matchPair(match: MatchDto, tbd: string, versus: string) {
  const name = (entry: MatchDto['participantA']) => entry ? `${entry.owner.fullName} / ${entry.teammate.fullName}` : tbd;
  return `${name(match.participantA)} ${versus} ${name(match.participantB)}`;
}

function FieldSelect({ label, value, onChange, options, optional = false, disabled = false }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; optional?: boolean; disabled?: boolean }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].admin.schedule;
  const id = label.toLowerCase().replaceAll(' ', '-');
  return <div><Label htmlFor={id}>{label}</Label><select id={id} disabled={disabled} className={`${selectControlClassName} mt-2 bg-white`} value={value} onChange={(fieldEvent) => onChange(fieldEvent.target.value)}><option value="">{optional ? copy.notAssigned : fillTemplate(copy.select, { label: label.toLowerCase() })}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>;
}
