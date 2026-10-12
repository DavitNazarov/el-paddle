'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, CalendarDays, Check, CircleAlert, Clock3, MapPin } from 'lucide-react';
import { EmptyTournamentState, TournamentPanel, TournamentSectionHeader, StatusLabel } from '@/components/tournament/TournamentUI';
import { SkeletonRows } from '@/components/shared/dashboard/Feedback';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy, tournamentStatus } from '@/lib/i18n/tournament';
import { lifecycleOrder } from './event-workspace/EventHeaderBand';
import { agendaAllClear, eventAgenda } from './event-workspace/eventAgenda';
import { operationsAsSignals } from './event-workspace/operationsSignals';
import type { EventDto, EventOperationsDto } from '@/types/admin';
import styles from './AdminOverview.module.css';

/**
 * Events sorted by how likely they are to need the reader right now: whatever
 * is running, then whatever is being prepared, then registration, and finished
 * events last. Date breaks ties inside a stage.
 */
const stageWeight: Record<EventDto['status'], number> = {
  ONGOING: 0,
  REGISTRATION_CLOSED: 1,
  REGISTRATION_OPEN: 2,
  COMPLETED: 3,
};

export function sortEventsByUrgency(events: EventDto[]) {
  return [...events].sort((left, right) =>
    stageWeight[left.status] - stageWeight[right.status]
    || new Date(left.date).getTime() - new Date(right.date).getTime());
}

/**
 * The season, as a board.
 *
 * Each row answers one question: should I open this event? It used to answer it
 * with up to five chips — live, pending, awaiting, draws, queued — side by side
 * and equally weighted, which is a reading exercise rather than an answer. Now
 * every row states the single most pressing thing that event is waiting on, in
 * the same words the event's own workspace would use for it, so the board and
 * the screen behind it never describe the same situation differently.
 *
 * The same board serves the role home and the five event pickers behind the
 * sidebar's lifecycle steps; those only differ in where a row leads, so they
 * pass a `hrefSuffix` and their own action label rather than a second design.
 */
export function AdminEventBoard({
  events,
  operations,
  loading,
  isOrganiser,
  title,
  description,
  hrefSuffix = '',
  actionLabel,
  headerActions,
  renderActions,
  emptyAction,
  order = sortEventsByUrgency,
}: {
  events: EventDto[];
  operations: Map<string, EventOperationsDto>;
  loading: boolean;
  isOrganiser: boolean;
  title?: string;
  description?: string;
  /** Path appended to the event, e.g. "bracket". Empty opens the workspace. */
  hrefSuffix?: string;
  actionLabel?: string;
  /** Replaces the count chip, for a board that owns a create button. */
  headerActions?: ReactNode;
  /** Per-row controls beside the open link. The events list uses it for edit, publish and delete. */
  renderActions?: (event: EventDto) => ReactNode;
  emptyAction?: ReactNode;
  /** Overrides the urgency sort; the events list groups by publication instead. */
  order?: (events: EventDto[]) => EventDto[];
}) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale].admin.board;
  const eventCopy = tournamentCopy[locale].admin.event;
  const common = tournamentCopy[locale].common;
  const ordered = order(events);

  return (
    <TournamentPanel labelledBy="admin-event-board">
      <TournamentSectionHeader
        id="admin-event-board"
        title={title ?? (isOrganiser ? copy.organiserTitle : copy.title)}
        description={description ?? (isOrganiser ? copy.organiserDescription : copy.description)}
        actions={headerActions ?? (ordered.length ? <StatusLabel>{fillTemplate(copy.countEvents, { count: ordered.length })}</StatusLabel> : undefined)}
      />
      {ordered.length ? (
        <div className={styles.board}>
          {ordered.map((event) => {
            const stageIndex = lifecycleOrder.indexOf(event.status);
            const operation = operations.get(event.id);
            // No counts yet means the board cannot speak for this event; it says
            // so rather than reporting a quiet event that may not be quiet.
            const agenda = operation ? eventAgenda(event, operationsAsSignals(operation), eventCopy) : [];
            const lead = agenda[0] ?? null;

            return (
              <div key={event.id} className={styles.row} data-live={(operation?.matches.live ?? 0) > 0}>
                <div className="min-w-0">
                  <div className={styles.rowTop}>
                    <h3 className={styles.title}>{event.title}</h3>
                    <span className={styles.stage}>
                      {tournamentStatus(locale, event.status)}
                      <span className="sr-only">
                        {` — ${fillTemplate(copy.stageOf, {
                          current: stageIndex + 1,
                          total: lifecycleOrder.length,
                          label: tournamentStatus(locale, event.status),
                        })}`}
                      </span>
                    </span>
                  </div>
                  <div className={styles.meta}>
                    <span>
                      <CalendarDays aria-hidden="true" />
                      {formatDate(event.date, { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                    <span>
                      <MapPin aria-hidden="true" />
                      {event.location}
                    </span>
                  </div>
                </div>

                <div className={styles.rowFoot}>
                  <p className={styles.need} data-tone={lead ? lead.tone : operation ? 'clear' : 'unknown'}>
                    {lead ? (
                      lead.tone === 'urgent' ? <CircleAlert aria-hidden="true" /> : <Clock3 aria-hidden="true" />
                    ) : operation ? (
                      <Check aria-hidden="true" />
                    ) : null}
                    <span className={styles.needText}>
                      {lead
                        ? lead.headline
                        : operation
                          ? agendaAllClear(event, eventCopy)
                          : loading ? common.loading : copy.quiet}
                    </span>
                    {agenda.length > 1 ? (
                      <span className={styles.needMore}>
                        {fillTemplate(copy.alsoWaiting, { count: agenda.length - 1 })}
                      </span>
                    ) : null}
                  </p>

                  <div className={styles.rowActions}>
                    {renderActions?.(event)}
                    <Link
                      href={`/admin/events/${event.id}${hrefSuffix ? `/${hrefSuffix}` : ''}`}
                      className={styles.open}
                    >
                      {actionLabel ?? copy.open}
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : loading ? (
        <SkeletonRows rows={3} label={common.loading} />
      ) : (
        <EmptyTournamentState
          title={isOrganiser ? copy.organiserEmpty : copy.empty}
          detail={isOrganiser ? copy.organiserEmptyDetail : copy.emptyDetail}
          action={emptyAction}
        />
      )}
    </TournamentPanel>
  );
}
