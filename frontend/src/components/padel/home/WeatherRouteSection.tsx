'use client';

import { ArrowUpRight, Navigation } from 'lucide-react';
import { useI18n } from '@/components/shared/I18nProvider';
import { Magnetic, Parallax, Reveal, Stagger, StaggerItem } from './motion';
import { ScrollSection, SectionIntro } from './scroll';
import { usePublicEvents } from './hooks';

export function WeatherRouteSection() {
  const { dictionary, formatDate } = useI18n();
  const { payload } = usePublicEvents();
  const visit = dictionary.home.visit;
  const upcoming = payload.upcoming;
  const venueName = upcoming?.location || 'KUS TBA Padel Courts';
  const arrivalTime = upcoming?.arrivalTime ?? null;
  const arrivalDateLine = arrivalTime
    ? formatDate(arrivalTime, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    : '';
  const arrivalClockLine = arrivalTime
    ? formatDate(arrivalTime, {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueName)}`;

  return (
    <ScrollSection
      className="section-pad relative overflow-hidden px-5 md:px-10"
    >
      <div className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-12">
        <Reveal>
          <Parallax speed={0.18}>
          <div>
            <SectionIntro
              index={visit.index}
              kicker={visit.kicker}
              title={visit.title}
              accent={visit.accent}
              copy={visit.copy}
            />
            <Stagger className="mt-6 grid gap-2.5" delay={0.1} stagger={0.08}>
              {visit.cards.map((item) => (
                <StaggerItem key={item.day}>
                  <div className="glass-card border border-[var(--padel-line)] p-4">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--padel-gold)]">
                      {item.day}
                    </p>
                    <h3 className="font-display mt-1 text-lg font-semibold text-[var(--padel-ivory)] md:text-xl">
                      {item.status}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-[var(--padel-muted)]">
                      {item.note}
                    </p>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
          </Parallax>
        </Reveal>

        <Reveal delay={0.08}>
          <Parallax speed={0.22}>
          <div className="court-card bg-[var(--padel-parchment)] p-5 text-[var(--padel-ink)] md:p-7">
            <div className="court-card__diagram opacity-40" aria-hidden>
              <span className="court-card__baseline court-card__baseline--top" />
              <span className="court-card__baseline court-card__baseline--bottom" />
              <span className="court-card__net" />
              <span className="court-card__service court-card__service--left" />
              <span className="court-card__service court-card__service--right" />
            </div>
            <p className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[var(--padel-red)]">
              <Navigation className="h-3.5 w-3.5" />
              {visit.maps}
            </p>
            <h3 className="font-display mt-2 text-2xl font-semibold leading-tight md:text-3xl">
              {venueName}
            </h3>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--padel-ink)]/70">
              {visit.routeCopy}
            </p>

            <div className={`mt-5 grid gap-3 ${arrivalTime ? 'sm:grid-cols-2' : ''}`}>
              <div className="border border-[#dacbb9] p-3.5">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--padel-red)]">
                  01
                </p>
                <p className="font-display mt-1 text-lg font-semibold">{visit.addressLabel}</p>
                <p className="mt-1 text-sm leading-6 text-[var(--padel-ink)]/75">
                  {upcoming?.location || visit.addressValue}
                </p>
              </div>

              {arrivalTime ? (
                <div className="border border-[#dacbb9] p-3.5">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--padel-red)]">
                    02
                  </p>
                  <p className="font-display mt-1 text-lg font-semibold">{visit.arrivalLabel}</p>
                  <p className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-[var(--padel-ink)]/55">
                    {arrivalDateLine}
                  </p>
                  <p className="font-display mt-1 text-2xl font-semibold leading-none text-[var(--padel-red)]">
                    {arrivalClockLine}
                  </p>
                </div>
              ) : null}
            </div>

            <Magnetic className="mt-5" strength={0.16}>
              <a
                href={mapsHref}
                target="_blank"
                rel="noreferrer"
                className="btn-premium btn-premium--dark inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[var(--padel-red)] px-5 py-2.5 text-sm font-semibold text-[var(--padel-ivory)] hover:bg-[#6f1210] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-ink)]"
              >
                {visit.routeOpen}
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </Magnetic>
          </div>
          </Parallax>
        </Reveal>
      </div>
    </ScrollSection>
  );
}
