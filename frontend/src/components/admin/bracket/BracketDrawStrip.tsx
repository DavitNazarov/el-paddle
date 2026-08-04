'use client';

import type { LucideIcon } from 'lucide-react';
import { ArrowDown, CircleDashed, CircleDot, Eye, GitBranch, LockKeyhole, Trophy } from 'lucide-react';
import { QueueMeter, StageDots, type RailState } from '@/components/shared/dashboard/DashboardSignals';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy, tournamentStatus } from '@/lib/i18n/tournament';
import { drawStages, type DrawSummary } from './bracketModel';
import styles from './BracketDrawStrip.module.css';

type Tone = 'neutral' | 'amber' | 'teal';

function stageMark(stageIndex: number, actionable: boolean): { icon: LucideIcon; tone: Tone } {
  if (stageIndex < 0) return { icon: CircleDashed, tone: actionable ? 'amber' : 'neutral' };
  if (stageIndex === 0) return { icon: CircleDot, tone: actionable ? 'amber' : 'neutral' };
  if (stageIndex === 1) return { icon: LockKeyhole, tone: 'neutral' };
  return { icon: Eye, tone: 'teal' };
}

/**
 * The screen's first answer: for every category, how far its draw has got and
 * how much of it has actually been played. A reader arriving here asks "which
 * draws still need me?", and previously had to open each panel to find out.
 */
export function BracketDrawStrip({
  draws,
  isCompleted,
}: {
  draws: DrawSummary[];
  /** A completed event is read-only, so nothing on it is asking for the reader. */
  isCompleted: boolean;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].admin.bracket;
  const locked = draws.filter((draw) => draw.stageIndex >= 1).length;
  const published = draws.filter((draw) => draw.stageIndex >= 2).length;

  return (
    <section className={styles.strip} aria-label={copy.stripLabel}>
      <div className={styles.intro}>
        <span className={styles.introIcon}>
          {isCompleted ? <Trophy aria-hidden="true" /> : <GitBranch aria-hidden="true" />}
        </span>
        <div className={styles.introCopy}>
          <p>{isCompleted ? copy.finalDraw : copy.workspace}</p>
          <span>{isCompleted ? copy.readOnly : copy.workspaceDescription}</span>
        </div>
        <p className={styles.summary}>
          {fillTemplate(copy.drawsSummary, { locked, total: draws.length, published })}
        </p>
      </div>

      <ul className={styles.cards}>
        {draws.map((draw) => {
          const { icon: Icon, tone } = stageMark(draw.stageIndex, !isCompleted);
          const stageLabel = draw.created
            ? tournamentStatus(locale, drawStages[draw.stageIndex])
            : copy.notCreated;
          return (
            <li key={draw.categoryId} className={styles.card}>
              <div className={styles.cardHead}>
                <h3 className={styles.cardTitle}>{draw.categoryName}</h3>
                <span className={styles.stateChip} data-tone={tone}>
                  <Icon aria-hidden="true" />
                  {stageLabel}
                </span>
              </div>

              <StageDots
                states={drawStages.map((_, index): RailState =>
                  index < draw.stageIndex ? 'done' : index === draw.stageIndex ? 'current' : 'upcoming')}
                label={draw.created ? fillTemplate(copy.entryDraw, { count: draw.entries }) : copy.noDrawYet}
                srLabel={draw.created
                  ? fillTemplate(copy.drawStageOf, {
                    current: draw.stageIndex + 1,
                    total: drawStages.length,
                    label: stageLabel,
                  })
                  : copy.notCreatedDetail}
              />

              {draw.matchCount > 0 ? (
                <QueueMeter
                  label={copy.matchesPlayed}
                  done={draw.completedCount}
                  total={draw.matchCount}
                  valueLabel={fillTemplate(copy.playedValue, { done: draw.completedCount, total: draw.matchCount })}
                />
              ) : (
                <p className={styles.quiet}>{draw.created ? copy.emptyDetail : copy.notCreatedDetail}</p>
              )}

              {draw.champion ? (
                <p className={styles.champion}>
                  <Trophy aria-hidden="true" />
                  <span>
                    <small>{copy.champion}</small>
                    {draw.champion}
                  </span>
                </p>
              ) : null}

              {/* A jump link, not the command itself — it lands on the panel the
                  category's own controls live in, which for an uncreated draw is
                  the create button rather than a draw. */}
              <a className={styles.open} href={`#category-${draw.categoryId}`}>
                {draw.created ? copy.openDraw : copy.createBracket}
                <ArrowDown aria-hidden="true" />
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
