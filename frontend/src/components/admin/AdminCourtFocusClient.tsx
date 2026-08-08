'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AdminShell } from './AdminShell';
import { BackLink, EmptyTournamentState, InlineNotice, TournamentPanel } from '@/components/tournament/TournamentUI';
import { SkeletonCards } from '@/components/shared/dashboard/Feedback';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import { CourtLane } from './control/CourtLane';
import { MatchActionLayer } from './control/MatchActionLayer';
import { emptyFilters } from './control/controlFilters';
import { useControlConsole } from './control/useControlConsole';
import styles from './control/MatchControl.module.css';

/**
 * One court, on its own screen.
 *
 * A tablet left at the desk — or carried to the court itself — should not be
 * showing seven other lanes. This is the same lane the console draws, given the
 * whole width, with a link of its own so it can be opened and left open. The
 * neighbouring courts stay one tap away, because whoever is holding it is
 * walking between them.
 */
export function AdminCourtFocusClient({ courtId, eventId }: { courtId: string; eventId: string }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const control = copy.admin.control;
  const desk = useControlConsole(eventId);
  const { board, busy, commands, locked } = desk;
  const [openMatchId, setOpenMatchId] = useState<string | null>(null);

  const index = board.lanes.findIndex((candidate) => candidate.court.id === courtId);
  const lane = index >= 0 ? board.lanes[index]! : null;
  const step = (delta: number) => board.lanes[(index + delta + board.lanes.length) % board.lanes.length] ?? null;
  const previous = board.lanes.length > 1 ? step(-1) : null;
  const nextCourt = board.lanes.length > 1 ? step(1) : null;

  return (
    <AdminShell
      title={lane ? lane.court.name : control.courtFocusTitle}
      description={control.courtFocusDescription}
      eyebrow={desk.event?.title}
    >
      <div className="mb-4">
        <BackLink href={`/admin/events/${eventId}/control`}>{control.title}</BackLink>
      </div>

      {desk.error ? <div className="mb-4"><InlineNotice kind="error" onDismiss={desk.clearError}>{desk.error}</InlineNotice></div> : null}
      {desk.notice ? <div className="mb-4"><InlineNotice kind="success" onDismiss={desk.clearNotice}>{desk.notice}</InlineNotice></div> : null}
      {locked ? <div className="mb-4"><InlineNotice kind="info">{control.readOnly}</InlineNotice></div> : null}

      <div className={styles.page}>
        {desk.loading && !lane ? (
          <SkeletonCards count={1} columns={2} label={control.loading} />
        ) : !lane ? (
          <TournamentPanel>
            <EmptyTournamentState title={control.courtGoneTitle} detail={control.courtGoneDetail} />
          </TournamentPanel>
        ) : (
          <>
            {board.lanes.length > 1 ? (
              <nav className={styles.courtSwitch} aria-label={control.courtSwitchLabel}>
                <Link className={styles.courtStep} href={`/admin/events/${eventId}/control/courts/${previous!.court.id}`}>
                  <ChevronLeft aria-hidden="true" />
                  {previous!.court.name}
                </Link>
                <span className={styles.courtPosition}>
                  {fillTemplate(control.courtOf, { current: index + 1, total: board.lanes.length })}
                </span>
                <Link className={styles.courtStep} href={`/admin/events/${eventId}/control/courts/${nextCourt!.court.id}`}>
                  {nextCourt!.court.name}
                  <ChevronRight aria-hidden="true" />
                </Link>
              </nav>
            ) : null}

            <div className={styles.focusLane}>
              <CourtLane
                busy={busy}
                eventId={eventId}
                filters={emptyFilters}
                lane={lane}
                locked={locked}
                onMove={commands.move}
                onOpen={(entry) => setOpenMatchId(entry.match.id)}
                onStart={(entry) => { void commands.start(entry.match); }}
                showOpenLink={false}
              />
            </div>
          </>
        )}
      </div>

      <MatchActionLayer desk={desk} eventId={eventId} openMatchId={openMatchId} onClose={() => setOpenMatchId(null)} />
    </AdminShell>
  );
}
