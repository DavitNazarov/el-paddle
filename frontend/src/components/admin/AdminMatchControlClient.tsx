'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AdminShell } from './AdminShell';
import {
  BackLink,
  EmptyTournamentState,
  InlineNotice,
  TournamentPanel,
  TournamentSectionHeader,
} from '@/components/tournament/TournamentUI';
import { SkeletonCards } from '@/components/shared/dashboard/Feedback';
import { useI18n } from '@/components/shared/I18nProvider';
import { tournamentCopy } from '@/lib/i18n/tournament';
import { ControlFilterBar, type ControlView } from './control/ControlFilterBar';
import { ControlFocusBar } from './control/ControlFocusBar';
import { CourtLane } from './control/CourtLane';
import { DrawFlow } from './control/DrawFlow';
import { MatchActionLayer } from './control/MatchActionLayer';
import { MatchLine } from './control/MatchLine';
import { RunOrder } from './control/RunOrder';
import { emptyFilters, laneIsVisible, matchesFilters, type ControlFilters } from './control/controlFilters';
import { useControlConsole } from './control/useControlConsole';
import styles from './control/MatchControl.module.css';

/**
 * The match-day console.
 *
 * A tournament day is not a bracket; it is a handful of courts, each working
 * through a queue somebody decided in advance. So the console is built court
 * first — one lane per surface, what is on it, what it is waiting to start,
 * what is behind that — and the draw becomes one of three ways to look at the
 * same set of matches rather than the shape of the whole screen. A sixteen-entry
 * draw in three categories is forty-five matches; with no court to group them by
 * and no way to narrow to the one being asked about, that is a wall.
 *
 * Order and time belong to the schedule and are only reflected here. Anything
 * already started or finished is pinned where it is, because the order a match
 * was played in is a fact rather than a setting.
 */
export function AdminMatchControlClient({ eventId }: { eventId: string }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const control = copy.admin.control;
  const desk = useControlConsole(eventId);
  const { board, busy, commands, courts, locked } = desk;

  const [filters, setFilters] = useState<ControlFilters>(emptyFilters);
  const [view, setView] = useState<ControlView>('courts');
  const [openMatchId, setOpenMatchId] = useState<string | null>(null);

  const filtered = useMemo(
    () => board.matches.filter((entry) => matchesFilters(entry, filters)),
    [board.matches, filters],
  );
  const lanes = board.lanes.filter((lane) => laneIsVisible(filters, lane));
  const waiting = board.waiting.filter((entry) => matchesFilters(entry, filters));
  const hasDraw = board.matches.length > 0;

  return (
    <AdminShell title={control.title} description={control.description} eyebrow={desk.event?.title}>
      <div className="mb-4">
        <BackLink href={`/admin/events/${eventId}`}>{copy.admin.common.eventWorkspace}</BackLink>
      </div>

      {/* Only a failure to load the day stays on the page: it describes the
          screen itself. Command outcomes are toasts, so they are readable over
          the match sheet that sent them. */}
      {desk.error ? <div className="mb-4"><InlineNotice kind="error" onDismiss={desk.clearError}>{desk.error}</InlineNotice></div> : null}
      {locked ? <div className="mb-4"><InlineNotice kind="info">{control.readOnly}</InlineNotice></div> : null}

      <div className={styles.page}>
        {/* One instruction, not five reports. Matches with nowhere to be played
            are named here too, so the day has a single place to look. */}
        <ControlFocusBar
          board={board}
          busy={busy}
          eventId={eventId}
          locked={locked}
          onStart={(matchId) => {
            const entry = board.byMatchId.get(matchId);
            if (entry) void commands.start(entry.match);
          }}
        />

        {desk.loading && !hasDraw ? (
          <SkeletonCards count={3} columns={2} label={control.loading} />
        ) : !hasDraw ? (
          <TournamentPanel>
            <EmptyTournamentState title={control.empty} detail={control.emptyDetail} />
          </TournamentPanel>
        ) : (
          <>
            <ControlFilterBar
              courts={courts}
              entries={board.matches}
              filters={filters}
              onChange={setFilters}
              onViewChange={setView}
              shown={filtered.length}
              view={view}
            />

            {view === 'courts' ? (
              <div className={styles.lanes}>
                {lanes.map((lane) => (
                  <CourtLane
                    key={lane.court.id}
                    busy={busy}
                    eventId={eventId}
                    filters={filters}
                    lane={lane}
                    locked={locked}
                    onMove={commands.move}
                    onOpen={(entry) => setOpenMatchId(entry.match.id)}
                    onStart={(entry) => { void commands.start(entry.match); }}
                  />
                ))}

                {waiting.length ? (
                  <section className={styles.lane} data-state="waiting" aria-label={control.waitingTitle}>
                    <header className={styles.laneHead}>
                      <div className={styles.laneIdentity}>
                        <h3 className={styles.laneName}>{control.waitingTitle}</h3>
                        <p className={styles.laneState}>{control.waitingDetail}</p>
                      </div>
                      <Link className={styles.laneLink} href={`/admin/events/${eventId}/schedule`}>{control.goToSchedule}</Link>
                    </header>
                    <ul className={styles.laneList}>
                      {waiting.map((entry) => (
                        <MatchLine
                          key={entry.match.id}
                          entry={entry}
                          onOpen={() => setOpenMatchId(entry.match.id)}
                          show={{ category: true }}
                        />
                      ))}
                    </ul>
                  </section>
                ) : null}

                {!lanes.length && !waiting.length ? (
                  <TournamentPanel>
                    <EmptyTournamentState
                      title={courts.length ? control.noMatchesTitle : control.noCourtsTitle}
                      detail={courts.length ? control.noMatchesDetail : control.noCourtsDetail}
                    />
                  </TournamentPanel>
                ) : null}
              </div>
            ) : null}

            {view === 'run' ? (
              <TournamentPanel>
                <TournamentSectionHeader title={control.viewRunOrder} description={control.viewRunOrderHint} />
                <div className={styles.panelBody}>
                  {filtered.length ? (
                    <RunOrder entries={filtered} onOpen={(entry) => setOpenMatchId(entry.match.id)} />
                  ) : (
                    <EmptyTournamentState title={control.noMatchesTitle} detail={control.noMatchesDetail} />
                  )}
                </div>
              </TournamentPanel>
            ) : null}

            {view === 'draw' ? (
              <TournamentPanel>
                <TournamentSectionHeader title={control.viewDraw} description={control.viewDrawHint} />
                <div className={styles.panelBody}>
                  <DrawFlow brackets={desk.brackets} entries={filtered} onOpen={(entry) => setOpenMatchId(entry.match.id)} />
                </div>
              </TournamentPanel>
            ) : null}
          </>
        )}
      </div>

      <MatchActionLayer desk={desk} eventId={eventId} openMatchId={openMatchId} onClose={() => setOpenMatchId(null)} />
    </AdminShell>
  );
}
