'use client';

import {
  ArrowRight,
  CalendarDays,
  MapPin,
  Trophy,
  Users,
} from 'lucide-react';
import { useI18n } from '@/components/shared/I18nProvider';
import { Parallax, Reveal } from './motion';
import { ScrollSection, SectionIntro } from './scroll';
import { usePublicEvents, type PublicEvent } from './hooks';

export function CompetitionSection() {
  const { payload, loading } = usePublicEvents();
  const { dictionary, formatDate } = useI18n();
  const eventCopy = dictionary.home.event;
  const fallbackUpcomingEvent: PublicEvent = {
    id: 'fallback-upcoming',
    title: eventCopy.fallbackTitle,
    date: new Date('2026-07-24T18:00:00').toISOString(),
    location: 'KUS TBA Padel Courts',
    description: eventCopy.fallbackDescription,
    arrivalTime: null,
    categories: eventCopy.fallbackCategories.map((name, index) => ({
      id: `fallback-${index}`,
      name,
      description: '',
    })),
  };
  const event = payload.upcoming ?? fallbackUpcomingEvent;
  const eventDate = payload.upcoming
    ? formatDate(event.date, {
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : eventCopy.dateSoon;

  return (
    <ScrollSection
      id="competition"
      className="section-pad relative overflow-hidden px-5 md:px-10"
    >
      <div className="relative mx-auto max-w-7xl">
        <Reveal>
          <Parallax speed={0.22}>
            <SectionIntro
              index={eventCopy.index}
              kicker={eventCopy.kicker}
              title={eventCopy.title}
              accent={eventCopy.accent}
              copy={eventCopy.copy}
              align="center"
            />
          </Parallax>
        </Reveal>

        <Reveal delay={0.08}>
          <Parallax speed={0.16} className="mt-10">
            <article className="upcoming-event-card grid overflow-hidden border border-[var(--padel-line-strong)] bg-[var(--padel-ink)]/32 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="relative min-h-0 p-5 md:p-7">
                <div className="court-card__diagram opacity-30" aria-hidden>
                  <span className="court-card__baseline court-card__baseline--top" />
                  <span className="court-card__baseline court-card__baseline--bottom" />
                  <span className="court-card__net" />
                  <span className="court-card__service court-card__service--left" />
                  <span className="court-card__service court-card__service--right" />
                </div>
                <span className="live-badge mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--padel-line)] px-2.5 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.22em] text-[var(--padel-ivory)]">
                  <span className="live-badge__dot" aria-hidden />
                  {loading ? eventCopy.checking : payload.upcoming ? eventCopy.published : eventCopy.pending}
                </span>
                <h3 className="font-display max-w-2xl text-2xl font-semibold leading-tight text-[var(--padel-ivory)] md:text-3xl">
                  {event.title}
                </h3>
                <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--padel-muted)]">
                  {event.description}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {event.categories.map((category) => (
                    <span key={category.id} className="flow-card__tag">
                      {category.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="border-t border-[var(--padel-line)] bg-[var(--padel-parchment)] p-5 text-[var(--padel-ink)] md:p-7 lg:border-l lg:border-t-0">
                <div className="grid gap-3">
                  {[
                    { icon: CalendarDays, label: eventCopy.details.date, value: eventDate },
                    { icon: MapPin, label: eventCopy.details.location, value: event.location },
                    { icon: Trophy, label: eventCopy.details.format, value: eventCopy.details.formatValue },
                    { icon: Users, label: eventCopy.details.team, value: eventCopy.details.teamValue },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="border-b border-[#dacbb9] pb-3 last:border-b-0">
                      <p className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--padel-red)]">
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </p>
                      <p className="font-display mt-1 text-lg font-semibold leading-snug md:text-xl">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex flex-col gap-2 sm:flex-row lg:flex-col">
                  <a
                    href="/register"
                    className="btn-premium inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[var(--padel-red)] px-5 py-2.5 text-sm font-semibold text-[var(--padel-ivory)] hover:bg-[var(--padel-red-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-red)]"
                  >
                    {dictionary.common.register}
                    <ArrowRight className="h-4 w-4" />
                  </a>
                  <a
                    href="/login"
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[var(--padel-ink)]/20 px-5 py-2.5 text-sm font-semibold text-[var(--padel-ink)] hover:border-[var(--padel-red)] hover:text-[var(--padel-red)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-red)]"
                  >
                    {dictionary.common.login}
                  </a>
                </div>
              </div>
            </article>
          </Parallax>
        </Reveal>
      </div>
    </ScrollSection>
  );
}
