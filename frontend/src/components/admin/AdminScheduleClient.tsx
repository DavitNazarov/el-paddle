'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, CircleAlert, MapPin, Plus, Timer, UsersRound } from 'lucide-react';
import { apiFetch, createCommandId } from '@/lib/api';
import type { AdminUserDto, EventDto } from '@/types/admin';
import type { BracketDto, CourtDto, MatchDto } from '@/types/tournament';
import { AdminShell } from './AdminShell';
import { BackLink, CommandButton, EmptyTournamentState, InlineNotice, TournamentPanel, TournamentSectionHeader } from '@/components/tournament/TournamentUI';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DashboardField, DashboardModal, formControlClassName, selectControlClassName } from '@/components/shared/dashboard/DashboardUI';
import { ModalFormFooter } from '@/components/shared/ModalFormFooter';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy, tournamentRound, tournamentStatus } from '@/lib/i18n/tournament';

export function AdminScheduleClient({ eventId }: { eventId: string }) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale];
  const [event, setEvent] = useState<EventDto | null>(null);
  const [courts, setCourts] = useState<CourtDto[]>([]);
  const [brackets, setBrackets] = useState<BracketDto[]>([]);
  const [judges, setJudges] = useState<AdminUserDto[]>([]);
  const [courtName, setCourtName] = useState('');
  const [selection, setSelection] = useState({ courtId: '', matchId: '', judgeId: '', plannedStartAt: '' });
  const [createCourtOpen, setCreateCourtOpen] = useState(false);
  const [addMatchOpen, setAddMatchOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const isCompleted = event?.status === 'COMPLETED';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, b, c, d] = await Promise.all([apiFetch(`/api/events/${eventId}`, { cache: 'no-store' }), apiFetch(`/api/admin/events/${eventId}/schedule`, { cache: 'no-store' }), apiFetch(`/api/admin/events/${eventId}/brackets`, { cache: 'no-store' }), apiFetch('/api/admin/judges', { cache: 'no-store' })]);
      const eventData = await a.json() as { event?: EventDto; error?: string };
      const scheduleData = await b.json() as { courts?: CourtDto[]; error?: string };
      const bracketData = await c.json() as { brackets?: BracketDto[] };
      const userData = await d.json() as { judges?: AdminUserDto[] };
      if (!a.ok || !b.ok) setError(eventData.error ?? scheduleData.error ?? copy.admin.schedule.loadError);
      else { setEvent(eventData.event ?? null); setCourts(scheduleData.courts ?? []); setBrackets(bracketData.brackets ?? []); setJudges(userData.judges ?? []); }
    } catch {
      setError(copy.admin.schedule.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.admin.schedule.loadError, eventId]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const unscheduledMatches = useMemo(() => {
    const scheduled = new Set(courts.flatMap((court) => court.scheduleItems.map((item) => item.matchId)));
    return brackets.flatMap((bracket) => bracket.matches).filter((match) => !scheduled.has(match.id) && match.status !== 'COMPLETED');
  }, [brackets, courts]);

  const scheduledMatches = courts.reduce((total, court) => total + court.scheduleItems.length, 0);
  const staffedCourts = courts.filter((court) => court.judgeAssignments.length > 0).length;

  async function createCourt() {
    if (!courtName.trim()) return;
    setBusy('court'); setError('');
    const response = await apiFetch(`/api/admin/events/${eventId}/courts`, { method: 'POST', body: JSON.stringify({ name: courtName }) });
    const data = await response.json() as { error?: string };
    setBusy(''); if (!response.ok) setError(data.error ?? copy.admin.schedule.createError); else { setCourtName(''); setCreateCourtOpen(false); void load(); }
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
          {!loading && courts.map((court) => <CourtQueue key={court.id} court={court} judges={judges} busy={busy} locked={isCompleted} onAssign={assignJudge} />)}
          {!loading && !courts.length ? <TournamentPanel className="border-[var(--dash-border)] bg-white"><EmptyTournamentState title={copy.admin.schedule.noCourts} detail={copy.admin.schedule.noCourtsDetail} /></TournamentPanel> : null}
        </div>
        <div className="space-y-4">
          <TournamentPanel className="border-[var(--dash-border)] bg-white">
            <TournamentSectionHeader title={copy.admin.schedule.actions} description={copy.admin.schedule.actionsDescription} />
            <div className="space-y-3 p-4">
              <CommandButton tone="primary" className="w-full" disabled={isCompleted} onClick={() => setCreateCourtOpen(true)}><Plus /> {copy.admin.schedule.createCourt}</CommandButton>
              <CommandButton className="w-full border-[var(--dash-border)] bg-white text-[var(--dash-text)] hover:bg-[#f8fbff] hover:text-[var(--dash-text)]" disabled={isCompleted || !courts.length || !unscheduledMatches.length} onClick={() => setAddMatchOpen(true)}><CalendarClock /> {copy.admin.schedule.addMatch}</CommandButton>
              {!courts.length ? <p className="text-xs leading-5 text-[var(--dash-muted)]">{copy.admin.schedule.createBeforeMatches}</p> : !unscheduledMatches.length ? <p className="text-xs leading-5 text-[var(--dash-muted)]">{copy.admin.schedule.allScheduled}</p> : null}
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
        <form id="create-court-form" onSubmit={(event) => { event.preventDefault(); void createCourt(); }}>
          <DashboardField label={copy.admin.schedule.courtName} id="court-name">
            <Input id="court-name" autoFocus required value={courtName} onChange={(event) => setCourtName(event.target.value)} placeholder={copy.admin.schedule.courtPlaceholder} className={formControlClassName} />
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
        <form id="add-match-form" onSubmit={(event) => { event.preventDefault(); void addMatch(); }} className="space-y-4">
          <FieldSelect label={copy.admin.schedule.court} disabled={!courts.length} value={selection.courtId} onChange={(value) => setSelection((current) => ({ ...current, courtId: value }))} options={courts.map((court) => ({ value: court.id, label: court.name }))} />
          <FieldSelect label={copy.admin.schedule.match} disabled={!unscheduledMatches.length} value={selection.matchId} onChange={(value) => setSelection((current) => ({ ...current, matchId: value }))} options={unscheduledMatches.map((match) => ({ value: match.id, label: `${tournamentRound(locale, match.round)} · ${copy.common.match} ${match.matchNumber}` }))} />
          <FieldSelect label={copy.admin.schedule.judge} value={selection.judgeId} onChange={(value) => setSelection((current) => ({ ...current, judgeId: value }))} options={judges.map((judge) => ({ value: judge.id, label: judge.fullName }))} optional />
          <DashboardField label={copy.admin.schedule.plannedStart} id="planned-start" hint={copy.admin.schedule.optional}>
            <Input id="planned-start" className={formControlClassName} type="datetime-local" value={selection.plannedStartAt} onChange={(event) => setSelection((current) => ({ ...current, plannedStartAt: event.target.value }))} />
          </DashboardField>
        </form>
      </DashboardModal>
    </AdminShell>
  );
}

function CourtQueue({ court, judges, busy, locked, onAssign }: { court: CourtDto; judges: AdminUserDto[]; busy: string; locked: boolean; onAssign: (court: CourtDto, judgeId: string) => void }) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale];
  const currentJudge = court.judgeAssignments[0]?.judge;
  return <TournamentPanel className="overflow-hidden border-[var(--dash-border)] bg-white"><TournamentSectionHeader title={court.name} description={court.location || fillTemplate(copy.admin.schedule.queuedMatches, { count: court.scheduleItems.length })} actions={<div className="min-w-[12rem]"><Label htmlFor={`judge-${court.id}`} className="mb-1.5 block text-xs text-[var(--dash-muted)]">{copy.admin.schedule.assignedJudge}</Label><select id={`judge-${court.id}`} aria-label={`${copy.admin.schedule.assignJudge}: ${court.name}`} className={`${selectControlClassName} h-10 bg-white`} value={currentJudge?.id ?? ''} disabled={locked || busy === `judge-${court.id}`} onChange={(event) => onAssign(court, event.target.value)}><option value="">{copy.admin.schedule.assignJudge}</option>{judges.map((judge) => <option key={judge.id} value={judge.id}>{judge.fullName}</option>)}</select></div>} />{court.scheduleItems.length ? <ol className="divide-y divide-[var(--dash-border)]">{court.scheduleItems.map((item, index) => <li key={item.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 gap-3"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${index === 0 ? 'bg-[var(--dash-sky-soft)] text-[var(--dash-sky)]' : 'bg-[#f1f5fa] text-[var(--dash-muted)]'}`}>{item.queuePosition}</span><div className="min-w-0"><p className="text-sm font-semibold text-[var(--dash-text)]">{tournamentRound(locale, item.match.round)} · {copy.common.match} {item.match.matchNumber}</p><p className="mt-1 text-sm text-[var(--dash-muted)]">{matchPair(item.match, copy.common.tbd, copy.common.versus)}</p></div></div><div className="flex shrink-0 flex-wrap items-center gap-2"><ScheduleStatus status={item.status} /><span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--dash-muted)]"><CalendarClock className="h-3.5 w-3.5" />{item.plannedStartAt ? formatDate(item.plannedStartAt, { hour: 'numeric', minute: '2-digit' }) : copy.admin.schedule.timeNotSet}</span></div></li>)}</ol> : <EmptyTournamentState title={copy.admin.schedule.emptyQueue} detail={copy.admin.schedule.emptyQueueDetail} />}</TournamentPanel>;
}

function ScheduleMetric({ icon: Icon, label, value, detail, tone = 'default' }: { icon: typeof CalendarClock; label: string; value: string; detail?: string; tone?: 'default' | 'success' | 'warning' }) {
  const toneClass = tone === 'success' ? 'bg-[var(--dash-teal-soft)] text-[var(--dash-teal)]' : tone === 'warning' ? 'bg-[var(--dash-amber-soft)] text-[var(--dash-amber)]' : 'bg-[var(--dash-sky-soft)] text-[var(--dash-sky)]';
  return <div className="rounded-xl border border-[var(--dash-border)] bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--dash-faint)]">{label}</p><p className="mt-2 text-lg font-semibold text-[var(--dash-text)]">{value}</p>{detail ? <p className="mt-1 text-xs text-[var(--dash-muted)]">{detail}</p> : null}</div><span className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneClass}`}><Icon className="h-4 w-4" /></span></div></div>;
}

function ScheduleStatus({ status }: { status: CourtDto['scheduleItems'][number]['status'] }) {
  const { locale } = useI18n();
  const styles = status === 'IN_PROGRESS' ? 'border-[rgba(47,111,237,0.25)] bg-[var(--dash-sky-soft)] text-[var(--dash-sky)]' : status === 'COMPLETED' ? 'border-[rgba(22,128,106,0.25)] bg-[var(--dash-teal-soft)] text-[var(--dash-teal)]' : status === 'CANCELLED' ? 'border-[rgba(194,65,59,0.25)] bg-[var(--dash-coral-soft)] text-[var(--dash-coral)]' : 'border-[rgba(168,103,18,0.25)] bg-[var(--dash-amber-soft)] text-[var(--dash-amber)]';
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
  return <div><Label htmlFor={id}>{label}</Label><select id={id} disabled={disabled} className={`${selectControlClassName} mt-2 bg-white`} value={value} onChange={(event) => onChange(event.target.value)}><option value="">{optional ? copy.notAssigned : fillTemplate(copy.select, { label: label.toLowerCase() })}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>;
}
