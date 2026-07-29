'use client';

import type { LucideIcon } from 'lucide-react';
import { CalendarClock, GitBranch, Radio, Trophy, Users } from 'lucide-react';
import { CommandButton, StatusLabel, TournamentPanel, TournamentSectionHeader } from '@/components/tournament/TournamentUI';
import { ManageLink, StateRow } from '@/components/shared/dashboard/DashboardSignals';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import type { EventWorkspaceSignals } from '@/hooks/useEventWorkspaceSignals';
import type { EventDto } from '@/types/admin';

export type PublicationField = 'publicLiveScoringEnabled' | 'resultsPublished';

type PublicationRow = {
  key: string;
  icon: LucideIcon;
  label: string;
  hint: string;
  live: boolean;
  /** Where the switch for this surface actually lives, when it is not here. */
  manageHref?: string;
  toggle?: { field: PublicationField; label: string };
};

/**
 * Every public surface of an event, in one list. The five surfaces publish
 * independently, so the workspace states each one rather than implying that the
 * two switches it owns are the whole story.
 */
export function EventPublicationBoard({
  event,
  signals,
  busy,
  onToggle,
}: {
  event: EventDto;
  signals: EventWorkspaceSignals;
  busy: boolean;
  onToggle: (field: PublicationField) => void;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].admin.event;
  const locked = event.status === 'COMPLETED';
  const base = `/admin/events/${event.id}`;
  const draws = signals.brackets;

  const rows: PublicationRow[] = [
    {
      key: 'roster',
      icon: Users,
      label: copy.registeredTeams,
      hint: copy.rosterHint,
      live: Boolean(event.registrationRosterPublishedAt),
      manageHref: `${base}/registrations`,
    },
    {
      key: 'bracket',
      icon: GitBranch,
      label: copy.bracket,
      hint: draws?.total ? fillTemplate(copy.drawsPublished, draws) : copy.bracketHint,
      live: Boolean(draws?.published),
      manageHref: `${base}/bracket`,
    },
    {
      key: 'schedule',
      icon: CalendarClock,
      label: copy.publicSchedule,
      hint: copy.scheduleHint,
      live: Boolean(event.schedulePublishedAt),
      manageHref: `${base}/schedule`,
    },
    {
      key: 'live-scores',
      icon: Radio,
      label: copy.liveScores,
      hint: copy.liveScoresHint,
      live: event.publicLiveScoringEnabled,
      toggle: {
        field: 'publicLiveScoringEnabled',
        label: event.publicLiveScoringEnabled ? copy.disableScores : copy.enableScores,
      },
    },
    {
      key: 'results',
      icon: Trophy,
      label: copy.finalResults,
      hint: copy.finalResultsHint,
      live: Boolean(event.resultsPublishedAt),
      toggle: {
        field: 'resultsPublished',
        label: event.resultsPublishedAt ? copy.unpublishResults : copy.publishResults,
      },
    },
  ];

  const liveCount = rows.filter((row) => row.live).length;

  return (
    <TournamentPanel labelledBy="event-publication">
      <TournamentSectionHeader
        id="event-publication"
        title={copy.visibility}
        description={locked ? copy.visibilityLocked : copy.visibilityDescription}
        actions={
          <StatusLabel icon={liveCount === rows.length ? 'check' : 'dot'}>
            {fillTemplate(copy.publicationSummary, { published: liveCount, total: rows.length })}
          </StatusLabel>
        }
      />
      <ul>
        {rows.map((row) => (
          <StateRow
            key={row.key}
            icon={row.icon}
            label={row.label}
            hint={row.hint}
            live={row.live}
            state={
              /* "Not published" would be scored as a success by StatusLabel's
                 wording heuristic — it contains "publish". "Hidden" states the
                 same fact and keeps the tone honest. */
              <StatusLabel icon={row.live ? 'check' : 'dot'}>
                {row.live ? copy.published : copy.hidden}
              </StatusLabel>
            }
            actions={
              <>
                {row.toggle ? (
                  <CommandButton busy={busy} disabled={locked} onClick={() => onToggle(row.toggle!.field)}>
                    {row.toggle.label}
                  </CommandButton>
                ) : null}
                {row.manageHref ? <ManageLink href={row.manageHref}>{copy.manage}</ManageLink> : null}
              </>
            }
          />
        ))}
      </ul>
    </TournamentPanel>
  );
}
