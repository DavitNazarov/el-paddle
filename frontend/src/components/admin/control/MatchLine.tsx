'use client';

import type { ReactNode } from 'react';
import { Check, Clock, Hourglass, MapPin, Play, Radio, TriangleAlert } from 'lucide-react';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy, tournamentRound } from '@/lib/i18n/tournament';
import { SIDES, pairName, participantOf } from './matchModel';
import { bandOf, type ControlMatch, type MatchBand } from './runBoard';
import styles from './MatchControl.module.css';

/**
 * One match, read-only, in the four lines an operator scans: what state it is
 * in, where and when, and the two pairs with their set tallies. It is the same
 * row in every view — court lane, run order, draw — so the whole console is one
 * thing learned once, and acting on a match always means opening it.
 *
 * The row is a button all the way across. Anything that has to sit beside it
 * (a start command, a queue nudge) is a sibling, never a nested control.
 */

const bandIcons: Record<MatchBand, typeof Radio> = {
  live: Radio,
  ready: Play,
  upcoming: Hourglass,
  done: Check,
};

/** State is never carried by the icon alone, so each band names itself in words too. */
const bandLabels = {
  live: 'bandLive',
  ready: 'bandReady',
  upcoming: 'bandUpcoming',
  done: 'bandDone',
} as const satisfies Record<MatchBand, string>;

export type MatchLineProps = {
  entry: ControlMatch;
  onOpen: (entry: ControlMatch) => void;
  /** `now` is the live match on a court; `next` is the one it is waiting on. */
  emphasis?: 'now' | 'next' | 'plain';
  show?: { court?: boolean; category?: boolean; time?: boolean; round?: boolean };
  actions?: ReactNode;
};

export function MatchLine({ entry, onOpen, emphasis = 'plain', show = {}, actions }: MatchLineProps) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale];
  const control = copy.admin.control;
  const { match } = entry;
  const band = bandOf(match);
  const BandIcon = bandIcons[band];
  const decided = match.status === 'COMPLETED';
  const scored = decided || band === 'live';

  const meta = [
    show.time !== false && entry.plannedStartAt
      ? { key: 'time', icon: Clock, text: formatDate(entry.plannedStartAt, { hour: '2-digit', minute: '2-digit' }) }
      : null,
    show.court && entry.court ? { key: 'court', icon: MapPin, text: entry.court.name } : null,
    show.round !== false ? { key: 'round', icon: null, text: tournamentRound(locale, match.round) } : null,
    show.category && entry.categoryName ? { key: 'category', icon: null, text: entry.categoryName } : null,
  ].filter(Boolean) as Array<{ key: string; icon: typeof Clock | null; text: string }>;

  return (
    <li className={styles.line} data-emphasis={emphasis} data-band={band}>
      <button
        type="button"
        className={styles.lineOpen}
        onClick={() => onOpen(entry)}
        aria-label={fillTemplate(control.openMatchLabel, {
          number: match.matchNumber,
          a: pairName(match.participantA, copy.common.tbd),
          b: pairName(match.participantB, copy.common.tbd),
        })}
      >
        <span className={styles.lineHead}>
          <span className={styles.lineBand}>
            <BandIcon aria-hidden="true" />
            {control[bandLabels[band]]}
          </span>
          <span className={styles.lineNumber}>
            {copy.common.match} {match.matchNumber}
          </span>
        </span>

        <span className={styles.linePairs}>
          {SIDES.map((side) => {
            const entrySide = participantOf(match, side);
            const won = decided && match.winnerEntryId === entrySide?.id;
            return (
              <span key={side} className={styles.linePair} data-winner={won}>
                <span className={styles.linePairName}>{pairName(entrySide, copy.common.tbd)}</span>
                {scored ? (
                  <span className={styles.linePairScore}>{side === 'A' ? match.scoreA : match.scoreB}</span>
                ) : null}
              </span>
            );
          })}
        </span>

        {meta.length ? (
          <span className={styles.lineMeta}>
            {meta.map((item) => (
              <span key={item.key} className={styles.lineMetaItem}>
                {item.icon ? <item.icon aria-hidden="true" /> : null}
                {item.text}
              </span>
            ))}
            {entry.lateBy !== null ? (
              <span className={styles.lineLate}>
                <TriangleAlert aria-hidden="true" />
                {fillTemplate(control.lateBy, { count: entry.lateBy })}
              </span>
            ) : null}
          </span>
        ) : null}
      </button>

      {actions ? <div className={styles.lineActions}>{actions}</div> : null}
    </li>
  );
}
