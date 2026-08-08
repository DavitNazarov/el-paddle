'use client';

import { useI18n } from '@/components/shared/I18nProvider';
import { tournamentCopy } from '@/lib/i18n/tournament';
import { MatchLine } from './MatchLine';
import { byRunOrder, type ControlMatch } from './runBoard';
import styles from './MatchControl.module.css';

/**
 * The day as a single list, in the order it is due to be played. The court view
 * answers "what is happening on three"; this one answers "what happens next",
 * across every court and category at once — the question asked from the desk
 * rather than from the courtside.
 *
 * Matches with no planned time gather at the end, because an unset time is not
 * a time of zero: it is work still to be placed.
 */
export function RunOrder({
  entries,
  onOpen,
}: {
  entries: ControlMatch[];
  onOpen: (entry: ControlMatch) => void;
}) {
  const { locale, formatDate } = useI18n();
  const control = tournamentCopy[locale].admin.control;
  const ordered = [...entries].sort(byRunOrder);
  const spansDays = new Set(
    ordered.map((entry) => (entry.plannedStartAt ? entry.plannedStartAt.slice(0, 10) : '')).filter(Boolean),
  ).size > 1;

  // Bucketed to the minute, so two matches called for the same time share one
  // heading even when their stored instants differ by milliseconds. The key is
  // a truncated instant and is never formatted — the group keeps the full ISO
  // for that, because a truncated one would be read back as local time.
  const groups = new Map<string, { iso: string | null; entries: ControlMatch[] }>();
  for (const entry of ordered) {
    const key = entry.plannedStartAt?.slice(0, 16) ?? '';
    const bucket = groups.get(key);
    if (bucket) bucket.entries.push(entry);
    else groups.set(key, { iso: entry.plannedStartAt, entries: [entry] });
  }

  return (
    <div className={styles.runOrder}>
      {[...groups.entries()].map(([key, group]) => (
        <section key={key || 'unplanned'} className={styles.runGroup}>
          <h3 className={styles.runTime}>
            {group.iso
              ? formatDate(group.iso, spansDays
                ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
                : { hour: '2-digit', minute: '2-digit' })
              : control.runOrderUnplanned}
          </h3>
          <ul className={styles.runList}>
            {group.entries.map((entry) => (
              <MatchLine
                key={entry.match.id}
                entry={entry}
                onOpen={onOpen}
                show={{ court: true, category: true, time: false }}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
