'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowUp, ArrowDown, ChevronRight, Lock, Radio, TriangleAlert } from 'lucide-react';
import { CommandButton } from '@/components/tournament/TournamentUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import { isFrozen } from '../schedule/scheduleModel';
import { MatchLine } from './MatchLine';
import { canStart } from './matchModel';
import type { ControlFilters } from './controlFilters';
import { matchesFilters } from './controlFilters';
import type { ControlMatch, CourtLane as Lane, LaneEntry } from './runBoard';
import styles from './MatchControl.module.css';

/**
 * One court, read top to bottom the way the court itself runs: what is on it,
 * what it is waiting to start, then the queue behind that, then what it has
 * already played. A court is the unit an operator navigates a tournament day
 * by — a draw of any size is still only ever played on these few surfaces.
 *
 * Order here is the schedule's order and nothing else. The nudges send the same
 * reorder command the schedule board sends, and a started or finished match
 * carries a lock instead, because its place in the day has already happened.
 */

export type CourtLaneProps = {
  busy: string;
  eventId: string;
  filters: ControlFilters;
  lane: Lane;
  locked: boolean;
  onMove: (lane: Lane, itemId: string, delta: number) => void;
  onOpen: (entry: ControlMatch) => void;
  onStart: (entry: ControlMatch) => void;
  /** The single-court screen already is one court, so it hides its own link. */
  showOpenLink?: boolean;
};

export function CourtLane({
  busy,
  eventId,
  filters,
  lane,
  locked,
  onMove,
  onOpen,
  onStart,
  showOpenLink = true,
}: CourtLaneProps) {
  const { locale } = useI18n();
  const control = tournamentCopy[locale].admin.control;

  const visible = (entry: LaneEntry | null) => (entry && matchesFilters(entry, filters) ? entry : null);
  const live = visible(lane.live);
  const next = visible(lane.next);
  const later = lane.later.filter((entry) => matchesFilters(entry, filters));
  const played = lane.played.filter((entry) => matchesFilters(entry, filters));
  const empty = !live && !next && !later.length && !played.length;

  return (
    <section className={styles.lane} data-state={lane.state} aria-label={lane.court.name}>
      <header className={styles.laneHead}>
        <div className={styles.laneIdentity}>
          <h3 className={styles.laneName}>{lane.court.name}</h3>
          <p className={styles.laneState}>
            {lane.state === 'live' ? <Radio aria-hidden="true" /> : null}
            {control[laneStateLabels[lane.state]]}
            {lane.court.scheduleItems.length ? (
              <span className={styles.laneProgress}>
                {fillTemplate(control.laneProgress, { done: lane.played.length, total: lane.court.scheduleItems.length })}
              </span>
            ) : null}
          </p>
        </div>
        {showOpenLink ? (
          <Link className={styles.laneLink} href={`/admin/events/${eventId}/control/courts/${lane.court.id}`}>
            {control.openCourt}
            <ChevronRight aria-hidden="true" />
          </Link>
        ) : null}
      </header>

      {lane.lateBy !== null ? (
        <p className={styles.laneLate}>
          <TriangleAlert aria-hidden="true" />
          {fillTemplate(control.laneLate, { count: lane.lateBy })}
        </p>
      ) : null}

      {empty ? (
        <p className={styles.laneEmpty}>{lane.court.scheduleItems.length ? control.laneFiltered : control.laneEmpty}</p>
      ) : null}

      {live ? (
        <LaneGroup title={control.laneNow}>
          <MatchLine entry={live} emphasis="now" onOpen={onOpen} show={{ category: true }} />
        </LaneGroup>
      ) : null}

      {next ? (
        <LaneGroup title={control.laneNext}>
          <MatchLine
            entry={next}
            emphasis="next"
            onOpen={onOpen}
            show={{ category: true }}
            actions={locked ? null : (
              <>
                {canStart(next.match) ? (
                  <CommandButton
                    tone="primary"
                    className={styles.laneStart}
                    busy={busy === `start-${next.match.id}`}
                    onClick={() => onStart(next)}
                  >
                    {control.start}
                  </CommandButton>
                ) : null}
                <QueueMoves busy={busy} entry={next} lane={lane} onMove={onMove} />
              </>
            )}
          />
        </LaneGroup>
      ) : null}

      {later.length ? (
        <LaneGroup title={control.laneLater} scroll>
          {later.map((entry) => (
            <MatchLine
              key={entry.match.id}
              entry={entry}
              onOpen={onOpen}
              show={{ category: true }}
              actions={locked ? null : <QueueMoves busy={busy} entry={entry} lane={lane} onMove={onMove} />}
            />
          ))}
        </LaneGroup>
      ) : null}

      {played.length ? (
        <details className={styles.lanePlayed}>
          <summary>{fillTemplate(control.lanePlayed, { count: played.length })}</summary>
          <ul className={styles.laneList}>
            {played.map((entry) => (
              <MatchLine key={entry.match.id} entry={entry} onOpen={onOpen} show={{ category: true }} />
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

const laneStateLabels = {
  live: 'courtLive',
  open: 'courtOpen',
  done: 'courtDone',
  empty: 'courtEmpty',
} as const satisfies Record<Lane['state'], string>;

/** `scroll` caps the rest-of-queue group, so one long court cannot push the next off the screen. */
function LaneGroup({ title, children, scroll }: { title: string; children: ReactNode; scroll?: boolean }) {
  return (
    <div className={styles.laneGroup}>
      <h4 className={styles.laneGroupTitle}>{title}</h4>
      <ul className={styles.laneList} data-scroll={scroll}>{children}</ul>
    </div>
  );
}

/**
 * The two moves a queued match has. A started or finished match shows a lock
 * instead: its order is settled, and the server would refuse to change it.
 */
function QueueMoves({
  busy,
  entry,
  lane,
  onMove,
}: {
  busy: string;
  entry: LaneEntry;
  lane: Lane;
  onMove: (lane: Lane, itemId: string, delta: number) => void;
}) {
  const { locale } = useI18n();
  const control = tournamentCopy[locale].admin.control;

  if (isFrozen(entry.item)) {
    return (
      <span className={styles.queueLock} title={control.queueLocked}>
        <Lock aria-hidden="true" />
        <span className="sr-only">{control.queueLocked}</span>
      </span>
    );
  }

  const working = busy === `move-${entry.item.id}`;
  return (
    <span className={styles.queueMoves}>
      <button
        type="button"
        className={styles.queueMove}
        disabled={!entry.canMoveEarlier || working}
        onClick={() => onMove(lane, entry.item.id, -1)}
        aria-label={fillTemplate(control.moveEarlier, { number: entry.match.matchNumber })}
      >
        <ArrowUp aria-hidden="true" />
      </button>
      <button
        type="button"
        className={styles.queueMove}
        disabled={!entry.canMoveLater || working}
        onClick={() => onMove(lane, entry.item.id, 1)}
        aria-label={fillTemplate(control.moveLater, { number: entry.match.matchNumber })}
      >
        <ArrowDown aria-hidden="true" />
      </button>
    </span>
  );
}
