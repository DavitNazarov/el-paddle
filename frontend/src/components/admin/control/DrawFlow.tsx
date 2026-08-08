'use client';

import type { BracketDto } from '@/types/tournament';
import { EmptyTournamentState } from '@/components/tournament/TournamentUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy, tournamentRound } from '@/lib/i18n/tournament';
import { activeRounds } from '../bracket/bracketModel';
import { MatchLine } from './MatchLine';
import type { ControlMatch } from './runBoard';
import styles from './MatchControl.module.css';

/**
 * The draw, kept for the one question the court views cannot answer: where a
 * winner goes. Rounds read left to right, so progression is the shape of the
 * screen rather than something to be worked out — and the rows are the same
 * rows as everywhere else, only grouped by round instead of by court.
 */
export function DrawFlow({
  brackets,
  entries,
  onOpen,
}: {
  brackets: BracketDto[];
  entries: ControlMatch[];
  onOpen: (entry: ControlMatch) => void;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const control = copy.admin.control;
  const visible = new Set(entries.map((entry) => entry.match.id));
  const byMatchId = new Map(entries.map((entry) => [entry.match.id, entry]));

  const draws = brackets
    .filter((bracket) => bracket.matches.some((match) => visible.has(match.id)))
    .map((bracket) => ({ bracket, rounds: activeRounds(bracket.matches.filter((match) => visible.has(match.id))) }));

  if (!draws.length) {
    return <EmptyTournamentState title={control.noMatchesTitle} detail={control.noMatchesDetail} />;
  }

  return (
    <div className={styles.draws}>
      {draws.map(({ bracket, rounds }) => (
        <section key={bracket.id} className={styles.draw}>
          <header className={styles.drawHead}>
            <h3 className={styles.drawName}>{bracket.eventCategory?.category.name}</h3>
            <p className={styles.drawHint}>
              {fillTemplate(control.drawProgress, {
                done: bracket.matches.filter((match) => match.status === 'COMPLETED').length,
                total: bracket.matches.length,
              })}
              {' · '}
              {control.drawFlowHint}
            </p>
          </header>
          <div className={styles.rounds}>
            {rounds.map((round) => (
              <div key={round} className={styles.round}>
                <h4 className={styles.roundName}>{tournamentRound(locale, round)}</h4>
                <ul className={styles.roundList}>
                  {bracket.matches
                    .filter((match) => match.round === round && visible.has(match.id))
                    .sort((left, right) => left.roundPosition - right.roundPosition)
                    .map((match) => {
                      const entry = byMatchId.get(match.id)!;
                      return (
                        <MatchLine
                          key={match.id}
                          entry={entry}
                          onOpen={onOpen}
                          show={{ court: true, round: false }}
                        />
                      );
                    })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
