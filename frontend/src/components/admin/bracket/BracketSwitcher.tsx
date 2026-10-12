'use client';

import { Check, CircleDot, Trophy } from 'lucide-react';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import type { DrawSummary } from './bracketModel';
import styles from './BracketSwitcher.module.css';

/**
 * Which draw is on screen.
 *
 * The page used to render every category's draw stacked, with a strip of
 * summary cards above repeating the same categories and a jump link down to
 * each. Two representations of one thing, and a three-category event was three
 * full bracket trees deep before the last one could be reached.
 *
 * One draw is on screen at a time, and this is how the other draws are reached
 * — with enough of each one's state on the tab to know whether it needs opening
 * at all, which is what the summary cards were really for.
 */
export function BracketSwitcher({
  draws,
  selectedCategoryId,
  onSelect,
}: {
  draws: DrawSummary[];
  selectedCategoryId: string;
  onSelect: (categoryId: string) => void;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].admin.bracket;

  // A single-category event has nothing to switch between, and a row of one tab
  // is a control that answers a question nobody asked.
  if (draws.length < 2) return null;

  return (
    <div className={styles.switcher} role="tablist" aria-label={copy.switcherLabel}>
      {draws.map((draw) => {
        const selected = draw.categoryId === selectedCategoryId;
        const finished = draw.matchCount > 0 && draw.completedCount >= draw.matchCount;
        return (
          <button
            key={draw.categoryId}
            type="button"
            role="tab"
            id={`draw-tab-${draw.categoryId}`}
            aria-selected={selected}
            aria-controls={`draw-panel-${draw.categoryId}`}
            className={styles.tab}
            data-selected={selected}
            onClick={() => onSelect(draw.categoryId)}
          >
            <span className={styles.tabName}>{draw.categoryName}</span>
            <span className={styles.tabState}>
              {!draw.created ? (
                copy.drawTabEmpty
              ) : draw.matchCount === 0 ? (
                copy.drawTabDraft
              ) : (
                <>
                  {finished ? (
                    <Trophy className={styles.tabIcon} aria-hidden="true" />
                  ) : draw.completedCount > 0 ? (
                    <CircleDot className={styles.tabIcon} aria-hidden="true" />
                  ) : (
                    <Check className={styles.tabIcon} aria-hidden="true" />
                  )}
                  {fillTemplate(copy.drawTabState, { played: draw.completedCount, total: draw.matchCount })}
                </>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
