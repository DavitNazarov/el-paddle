'use client';

import { Plus } from 'lucide-react';
import { CommandButton, TournamentPanel, TournamentSectionHeader } from '@/components/tournament/TournamentUI';
import { Notice } from '@/components/shared/dashboard/Feedback';
import { useI18n } from '@/components/shared/I18nProvider';
import { tournamentCopy } from '@/lib/i18n/tournament';
import { judgeName, type EventJudge } from './scheduleModel';
import styles from './Schedule.module.css';

/**
 * The pool a court's judge must come from. It stays beside the board because
 * "no judge available" is discovered while staffing a court, not before.
 */
export function EventJudgePanel({
  busy,
  judges,
  locked,
  notice,
  onAdd,
  onRemove,
}: {
  busy: string;
  judges: EventJudge[];
  locked: boolean;
  notice: string;
  onAdd: () => void;
  onRemove: (judge: EventJudge) => void;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].admin.judges;

  return (
    <TournamentPanel className="border-[var(--dash-border)] bg-white" labelledBy="event-judges">
      <TournamentSectionHeader
        id="event-judges"
        title={copy.title}
        description={copy.description}
        actions={locked ? undefined : (
          <CommandButton tone="primary" busy={busy === 'judge-add'} onClick={onAdd}>
            <Plus aria-hidden="true" /> {copy.add}
          </CommandButton>
        )}
      />
      <div className={styles.judgeBody}>
        {notice ? <Notice tone="success">{notice}</Notice> : null}
        {judges.length ? (
          <ul className={styles.judgeList}>
            {judges.map((judge) => (
              <li key={judge.id} className={styles.judgeRow}>
                <span className={styles.judgeName}>
                  {judgeName(judge)}
                  <span className={styles.judgeEmail}>{judge.email}</span>
                </span>
                {locked ? null : (
                  <CommandButton
                    tone="danger"
                    busy={busy === `judge-remove-${judge.id}`}
                    onClick={() => onRemove(judge)}
                  >
                    {copy.remove}
                  </CommandButton>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.judgeEmpty}>{copy.none}</p>
        )}
      </div>
    </TournamentPanel>
  );
}
