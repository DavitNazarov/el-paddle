'use client';

import Link from 'next/link';
import { ArrowRight, Check, CircleAlert, Radio } from 'lucide-react';
import { CommandButton } from '@/components/tournament/TournamentUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import { controlFocus } from './controlFocus';
import type { RunBoard } from './runBoard';
import styles from './MatchControl.module.css';

/**
 * What the day needs next, and the command for it.
 *
 * This replaced five metric tiles. Four of them reported; only one — courts
 * standing free — described time being lost, and it was the one an operator had
 * to translate into a search before they could act on it. The bar names that
 * court, says which match it is waiting on, and offers Start where the server
 * would allow it, so the most common move on a tournament day is one press from
 * the top of the screen.
 */
export function ControlFocusBar({
  board,
  busy,
  eventId,
  locked,
  onStart,
}: {
  board: RunBoard;
  busy: string;
  eventId: string;
  locked: boolean;
  onStart: (matchId: string) => void;
}) {
  const { locale } = useI18n();
  const control = tournamentCopy[locale].admin.control;
  const focus = controlFocus(board);

  const otherCourts = (count: number) =>
    count <= 0
      ? null
      : count === 1
        ? control.focusOtherCourtsOne
        : fillTemplate(control.focusOtherCourtsMany, { count });

  if (focus.kind === 'start' || focus.kind === 'court') {
    const { lane, otherIdleCourts } = focus;
    const next = lane.next!;
    return (
      <section className={styles.focus} data-tone="urgent" aria-label={control.focusLabel}>
        <CircleAlert className={styles.focusIcon} aria-hidden="true" />
        <p className={styles.focusText}>
          <span className={styles.focusHeadline}>
            {fillTemplate(control.focusCourtFree, { court: lane.court.name })}{' '}
            {fillTemplate(control.focusNextIs, { number: next.match.matchNumber })}
          </span>
          {otherIdleCourts > 0 ? (
            <span className={styles.focusAside}>{otherCourts(otherIdleCourts)}</span>
          ) : null}
        </p>
        {locked ? null : focus.kind === 'start' ? (
          <CommandButton
            tone="primary"
            className={styles.focusAction}
            busy={busy === `start-${next.match.id}`}
            onClick={() => onStart(next.match.id)}
          >
            <Radio aria-hidden="true" />
            {fillTemplate(control.focusStart, { number: next.match.matchNumber })}
          </CommandButton>
        ) : (
          <Link
            className={styles.focusLink}
            href={`/admin/events/${eventId}/control/courts/${lane.court.id}`}
          >
            {fillTemplate(control.focusOpenCourt, { court: lane.court.name })}
            <ArrowRight aria-hidden="true" />
          </Link>
        )}
      </section>
    );
  }

  if (focus.kind === 'no-court') {
    return (
      <section className={styles.focus} data-tone="urgent" aria-label={control.focusLabel}>
        <CircleAlert className={styles.focusIcon} aria-hidden="true" />
        <p className={styles.focusText}>
          <span className={styles.focusHeadline}>
            {focus.count === 1
              ? control.focusNoCourtOne
              : fillTemplate(control.focusNoCourtMany, { count: focus.count })}
          </span>
        </p>
        <Link className={styles.focusLink} href={`/admin/events/${eventId}/schedule`}>
          {control.goToSchedule}
          <ArrowRight aria-hidden="true" />
        </Link>
      </section>
    );
  }

  if (focus.kind === 'done') {
    return (
      <section className={styles.focus} data-tone="clear" aria-label={control.focusLabel}>
        <Check className={styles.focusIcon} aria-hidden="true" />
        <p className={styles.focusText}>
          <span className={styles.focusHeadline}>{control.focusDone}</span>
        </p>
      </section>
    );
  }

  if (focus.kind === 'idle') {
    return (
      <section className={styles.focus} data-tone="quiet" aria-label={control.focusLabel}>
        <p className={styles.focusText}>
          <span className={styles.focusHeadline}>{control.focusIdle}</span>
        </p>
      </section>
    );
  }

  return (
    <section className={styles.focus} data-tone="running" aria-label={control.focusLabel}>
      <Radio className={styles.focusIcon} aria-hidden="true" />
      <p className={styles.focusText}>
        <span className={styles.focusHeadline}>
          {focus.live > 0
            ? fillTemplate(control.focusRunning, {
                live: focus.live,
                done: focus.completed,
                total: focus.total,
              })
            : control.focusWaiting}
        </span>
      </p>
    </section>
  );
}
