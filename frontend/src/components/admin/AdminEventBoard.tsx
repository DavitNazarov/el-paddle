'use client';

import Link from 'next/link';
import { ArrowRight, CalendarDays, MapPin, Radio } from 'lucide-react';
import { EmptyTournamentState, TournamentPanel, TournamentSectionHeader, StatusLabel } from '@/components/tournament/TournamentUI';
import { StageDots, type RailState } from '@/components/shared/dashboard/DashboardSignals';
import { SkeletonRows } from '@/components/shared/dashboard/Feedback';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy, tournamentStatus } from '@/lib/i18n/tournament';
import { lifecycleOrder } from './event-workspace/EventLifecycleHero';
import type { EventDto, EventOperationsDto } from '@/types/admin';
import styles from './AdminOverview.module.css';

type Chip = { key: string; label: string; tone?: 'warning' | 'live' };

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
 * The events board. Each row states where the event has reached and what it is
 * waiting on — the two facts that decide whether the reader opens it.
 *
 * The same board serves the role home and the four event pickers behind the
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
}) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale].admin.board;
  const common = tournamentCopy[locale].common;
  const ordered = sortEventsByUrgency(events);

  return (
    <TournamentPanel labelledBy="admin-event-board">
      <TournamentSectionHeader
        id="admin-event-board"
        title={title ?? (isOrganiser ? copy.organiserTitle : copy.title)}
        description={description ?? (isOrganiser ? copy.organiserDescription : copy.description)}
        actions={ordered.length ? <StatusLabel>{fillTemplate(copy.countEvents, { count: ordered.length })}</StatusLabel> : undefined}
      />
      {ordered.length ? (
        <div className={styles.board}>
          {ordered.map((event) => {
            const stageIndex = lifecycleOrder.indexOf(event.status);
            const operation = operations.get(event.id);
            const chips: Chip[] = [];
            const readOnly = event.status === 'COMPLETED';

            if (operation) {
              if (operation.matches.live > 0) {
                chips.push({ key: 'live', label: fillTemplate(copy.live, { count: operation.matches.live }), tone: 'live' });
              }
              if (!readOnly && operation.registrations.pending > 0) {
                chips.push({ key: 'pending', label: fillTemplate(copy.pending, { count: operation.registrations.pending }), tone: 'warning' });
              }
              if (!readOnly && operation.requests.awaiting > 0) {
                chips.push({ key: 'awaiting', label: fillTemplate(copy.awaiting, { count: operation.requests.awaiting }), tone: 'warning' });
              }
              if (operation.brackets.total > 0) {
                chips.push({ key: 'draws', label: fillTemplate(copy.draws, operation.brackets) });
              }
              if (operation.schedule.queued > 0) {
                chips.push({ key: 'queued', label: fillTemplate(copy.queued, { count: operation.schedule.queued }) });
              }
            }

            return (
              <div key={event.id} className={styles.row} data-live={(operation?.matches.live ?? 0) > 0}>
                <div className="min-w-0">
                  <div className={styles.rowTop}>
                    <h3 className={styles.title}>{event.title}</h3>
                    <StageDots
                      states={lifecycleOrder.map((_, index): RailState =>
                        index < stageIndex ? 'done' : index === stageIndex ? 'current' : 'upcoming')}
                      label={tournamentStatus(locale, event.status)}
                      srLabel={fillTemplate(copy.stageOf, {
                        current: stageIndex + 1,
                        total: lifecycleOrder.length,
                        label: tournamentStatus(locale, event.status),
                      })}
                    />
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
                  {chips.length ? (
                    <div className={styles.chips}>
                      {chips.map((chip) => (
                        <span key={chip.key} className={styles.chip} data-tone={chip.tone}>
                          {chip.tone === 'live' ? <Radio aria-hidden="true" /> : null}
                          {chip.label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className={styles.quiet}>{loading ? common.loading : copy.quiet}</span>
                  )}
                  <Link
                    href={`/admin/events/${event.id}${hrefSuffix ? `/${hrefSuffix}` : ''}`}
                    className={styles.open}
                  >
                    {actionLabel ?? copy.open}
                    <ArrowRight aria-hidden="true" />
                  </Link>
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
        />
      )}
    </TournamentPanel>
  );
}
