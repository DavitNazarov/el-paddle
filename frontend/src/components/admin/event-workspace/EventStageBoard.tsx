'use client';

import type { LucideIcon } from 'lucide-react';
import { CalendarClock, ClipboardList, GitBranch, Swords } from 'lucide-react';
import { SignalCard, SignalGrid } from '@/components/shared/dashboard/DashboardSignals';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import type { EventWorkspaceSignals } from '@/hooks/useEventWorkspaceSignals';
import type { EventDto } from '@/types/admin';

type StageKey = 'registrations' | 'requests' | 'bracket' | 'schedule';

type Stage = {
  key: StageKey;
  href: string;
  icon: LucideIcon;
  title: string;
  detail: string;
  /** Null while the counts are still loading or the reader cannot see them. */
  signal: string | null;
  quiet: boolean;
  /** Set when this stage is holding a queue that only a decision can clear. */
  attention: boolean;
};

/**
 * Which stage the lifecycle is currently sitting on. A completed event has no
 * focus: nothing on this board is the next thing to do until it is reopened.
 */
const focusByStatus: Partial<Record<EventDto['status'], StageKey>> = {
  REGISTRATION_OPEN: 'registrations',
  REGISTRATION_CLOSED: 'requests',
  ONGOING: 'schedule',
};

/** The four operational stages of an event, each carrying its own live count. */
export function EventStageBoard({ event, signals }: { event: EventDto; signals: EventWorkspaceSignals }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].admin.event;
  const focus = focusByStatus[event.status];
  const base = `/admin/events/${event.id}`;
  // A completed event is read-only, so a queue that is still open is history,
  // not something the administrator is being asked to clear.
  const actionable = event.status !== 'COMPLETED';

  const stages: Stage[] = [
    {
      key: 'registrations',
      href: `${base}/registrations`,
      icon: ClipboardList,
      title: copy.registrations,
      detail: copy.registrationsDetail,
      signal: signals.registrations ? fillTemplate(copy.registrationsSignal, signals.registrations) : null,
      quiet: false,
      attention: actionable && (signals.registrations?.pending ?? 0) > 0,
    },
    {
      key: 'requests',
      href: `${base}/opponent-requests`,
      icon: Swords,
      title: copy.requests,
      detail: copy.requestsDetail,
      signal: signals.requests
        ? signals.requests.total
          ? fillTemplate(copy.requestsSignal, signals.requests)
          : copy.nothingYet
        : null,
      quiet: signals.requests?.total === 0,
      attention: actionable && (signals.requests?.awaiting ?? 0) > 0,
    },
    {
      key: 'bracket',
      href: `${base}/bracket`,
      icon: GitBranch,
      title: copy.bracket,
      detail: copy.bracketDetail,
      signal: signals.brackets
        ? signals.brackets.total
          ? fillTemplate(copy.bracketSignal, signals.brackets)
          : copy.nothingYet
        : null,
      quiet: signals.brackets?.total === 0,
      attention: false,
    },
    {
      key: 'schedule',
      href: `${base}/schedule`,
      icon: CalendarClock,
      title: copy.schedule,
      detail: copy.scheduleDetail,
      signal: signals.schedule
        ? signals.schedule.courts
          ? fillTemplate(copy.scheduleSignal, signals.schedule)
          : copy.nothingYet
        : null,
      quiet: signals.schedule?.courts === 0,
      attention: false,
    },
  ];

  return (
    <SignalGrid columns={4}>
      {stages.map((stage, index) => (
        <SignalCard
          key={stage.key}
          href={stage.href}
          icon={stage.icon}
          index={`0${index + 1}`}
          title={stage.title}
          detail={stage.detail}
          signal={stage.signal}
          loadingLabel={copy.loadingSignal}
          quiet={stage.quiet}
          attention={stage.attention ? copy.actionNeeded : undefined}
          focus={focus === stage.key}
        />
      ))}
    </SignalGrid>
  );
}
