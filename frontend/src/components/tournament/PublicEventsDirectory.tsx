'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowRight, CalendarDays, Clock, CreditCard, MapPin, Search, Tag } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy, tournamentStatus } from '@/lib/i18n/tournament';
import { cn } from '@/lib/utils';
import type { EventDto } from '@/types/dashboard';
import { LiveBadge, FilterChips, panelSurface } from './PublicEventSections';
import { PublicPageShell } from './PublicDirectoryClients';
import { EmptyTournamentState, StatusLabel } from './TournamentUI';
import {
  calendarPulse,
  categoryOptions,
  countdownOf,
  eventSectionHref,
  filterEvents,
  groupByYear,
  isLive,
  publishedSections,
  shelveEvents,
  type Countdown,
} from './eventsDirectoryModel';

/**
 * The public tournament calendar. Three shelves rather than one grid: the next
 * tournament gets the whole width and a countdown, the rest of the published
 * schedule is a compact list, and finished events sit in a searchable archive
 * grouped by year. Every card links to the event page and, where the organiser
 * has published them, straight to its teams, schedule, or results tab.
 */
export function PublicEventsDirectory({ upcoming, previous }: { upcoming: EventDto[]; previous: EventDto[] }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].directories.events;
  const shelves = useMemo(() => shelveEvents(upcoming, previous), [upcoming, previous]);
  const pulse = useMemo(() => calendarPulse(upcoming, previous), [upcoming, previous]);
  const total = upcoming.length + previous.length;

  return (
    <PublicPageShell>
      <Badge variant="gold">{copy.badge}</Badge>
      <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <h1 className="font-display text-5xl font-semibold md:text-7xl">{copy.title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--padel-muted)]">{copy.description}</p>
        </div>
        {total ? <CalendarPulse scheduled={pulse.scheduled} live={pulse.live} played={pulse.played} /> : null}
      </div>

      {total ? (
        <>
          <Shelf id="next-up" title={copy.nextUp}>
            {shelves.featured ? (
              <FeaturedEvent event={shelves.featured} />
            ) : (
              <EmptyTournamentState title={copy.nextUpEmpty} detail={copy.nextUpEmptyDetail} />
            )}
          </Shelf>

          {shelves.scheduled.length ? (
            <Shelf id="also-scheduled" title={copy.alsoScheduled} description={copy.alsoScheduledDescription} meta={shelves.scheduled.length}>
              <ul className="grid gap-3">
                {shelves.scheduled.map((event) => <EventRow key={event.id} event={event} />)}
              </ul>
            </Shelf>
          ) : null}

          <ArchiveShelf events={shelves.archive} />
        </>
      ) : (
        <div className="mt-10">
          <EmptyTournamentState title={copy.empty} detail={copy.nextUpEmptyDetail} />
        </div>
      )}
    </PublicPageShell>
  );
}

/** How big the calendar is, said in numbers before a visitor scrolls. */
function CalendarPulse({ scheduled, live, played }: { scheduled: number; live: number; played: number }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].directories.events;
  const entries: Array<{ label: string; value: number }> = [
    { label: copy.pulse.scheduled, value: scheduled },
    ...(live ? [{ label: copy.pulse.live, value: live }] : []),
    { label: copy.pulse.played, value: played },
  ];
  return (
    <dl className="flex flex-wrap gap-3">
      {entries.map((entry) => (
        <div key={entry.label} className={cn(panelSurface, 'min-w-[7rem] border p-4')}>
          <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--padel-gold)]">{entry.label}</dt>
          <dd className="font-display mt-1 text-3xl font-semibold tabular-nums">{entry.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Shelf({ id, title, description, meta, children }: { id: string; title: string; description?: string; meta?: number; children: ReactNode }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].directories.events;
  const headingId = `shelf-${id}`;
  return (
    <section aria-labelledby={headingId} className="mt-14 border-t border-[var(--padel-line)] pt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id={headingId} className="font-display text-3xl font-semibold md:text-4xl">{title}</h2>
        {meta !== undefined ? (
          <span className="text-sm font-semibold text-[var(--padel-gold)]">
            <span className="tabular-nums">{meta}</span> {meta === 1 ? copy.singular : copy.plural}
          </span>
        ) : null}
      </div>
      {description ? <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--padel-muted)]">{description}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/* ---- The lead tournament ---- */

function FeaturedEvent({ event }: { event: EventDto }) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale];
  const eventCopy = copy.directories.events;
  const facts: Array<{ icon: LucideIcon; label: string; value: string }> = [
    { icon: CalendarDays, label: copy.common.date, value: formatDate(event.date, { dateStyle: 'long', timeStyle: 'short' }) },
    ...(event.arrivalTime ? [{ icon: Clock, label: copy.publicEvent.facts.arrival, value: formatDate(event.arrivalTime, { timeStyle: 'short' }) }] : []),
    { icon: MapPin, label: copy.common.location, value: event.location },
    {
      icon: CreditCard,
      label: copy.publicEvent.facts.fee,
      value: event.participationFee > 0 ? fillTemplate(copy.publicEvent.facts.feeAmount, { amount: event.participationFee }) : copy.publicEvent.facts.feeFree,
    },
  ];

  return (
    <article className={cn(panelSurface, 'border p-5 md:p-8')}>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <StatusLabel icon={event.status === 'COMPLETED' ? 'check' : 'dot'}>{tournamentStatus(locale, event.status)}</StatusLabel>
            {isLive(event) ? <LiveBadge /> : null}
          </div>
          <h3 className="font-display mt-4 text-4xl font-semibold leading-tight md:text-5xl">{event.title}</h3>
          {event.description ? <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--padel-muted)]">{event.description}</p> : null}

          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            {facts.map((fact) => (
              <div key={fact.label} className="border-l border-[var(--padel-line-strong)] pl-3">
                <dt className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--padel-gold)]">
                  <fact.icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {fact.label}
                </dt>
                <dd className="mt-1 text-sm font-semibold leading-6 text-[var(--padel-ivory)]">{fact.value}</dd>
              </div>
            ))}
          </dl>

          {event.categories.length ? (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Tag className="h-3.5 w-3.5 text-[var(--padel-gold)]" aria-hidden="true" />
              <span className="sr-only">{copy.common.categories}</span>
              {event.categories.map((category) => <Badge key={category.id} variant="gold">{category.name}</Badge>)}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-5 lg:border-l lg:border-[var(--padel-line)] lg:pl-6">
          <CountdownBlock countdown={countdownOf(event)} />
          <Link
            href={`/events/${event.id}`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--padel-gold)]/60 bg-[var(--padel-gold)]/12 px-5 text-sm font-semibold text-[var(--padel-ivory)] transition-colors hover:bg-[var(--padel-gold)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]"
          >
            {eventCopy.open}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <SectionLinks event={event} />
        </div>
      </div>
    </article>
  );
}

/** The one number a competitor is checking: how long until the first ball. */
function CountdownBlock({ countdown }: { countdown: Countdown }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].directories.events.countdown;
  if (countdown.kind !== 'days') {
    return (
      <p className="font-display text-2xl font-semibold leading-tight text-[var(--padel-ivory)]">
        {countdown.kind === 'today' ? copy.today : countdown.kind === 'tomorrow' ? copy.tomorrow : copy.underWay}
      </p>
    );
  }
  return (
    <p className="flex items-baseline gap-3 lg:flex-col lg:gap-0">
      <span className="font-display text-6xl font-semibold leading-none tabular-nums text-[var(--padel-ivory)]">{countdown.days}</span>
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--padel-gold)] lg:mt-2">{copy.days}</span>
    </p>
  );
}

/**
 * Deep links to the parts of the event page that are already public. Nothing is
 * offered before the organiser publishes it, so a chip here is a promise the
 * event page keeps.
 */
function SectionLinks({ event, compact = false }: { event: EventDto; compact?: boolean }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].directories.events;
  const sections = publishedSections(event);
  if (!sections.length) {
    return compact ? null : <p className="text-xs text-[var(--padel-muted)]">{copy.nothingPublished}</p>;
  }
  return (
    <div>
      {compact ? null : <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--padel-gold)]">{copy.openSections}</p>}
      <ul className={cn('flex flex-wrap gap-2', compact ? '' : 'mt-2')}>
        {sections.map((section) => (
          <li key={section}>
            <Link
              href={eventSectionHref(event, section)}
              className="relative z-20 inline-flex min-h-11 items-center rounded-full border border-[var(--padel-line-strong)] px-3.5 text-xs font-semibold text-[var(--padel-ivory)] transition-colors hover:border-[var(--padel-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]"
            >
              {copy.sections[section]}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---- Compact rows ---- */

/**
 * One event as a row: the date reads as a calendar tile on the left so a column
 * of rows can be scanned by date alone, the title and place sit in the middle,
 * and the whole row is one link with the published-section chips layered above
 * it — the same overlay pattern the player directory uses.
 */
function EventRow({ event }: { event: EventDto }) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale].directories.events;
  return (
    <li className={cn(panelSurface, 'group relative border transition-colors hover:border-[var(--padel-gold)] focus-within:border-[var(--padel-gold)]')}>
      <Link
        href={`/events/${event.id}`}
        aria-label={`${copy.open}: ${event.title}`}
        className="absolute inset-0 z-10 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--padel-red)]"
      />
      <div className="flex flex-wrap items-start gap-4 p-4 sm:flex-nowrap">
        <DateTile date={event.date} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusLabel icon={event.status === 'COMPLETED' ? 'check' : 'dot'}>{tournamentStatus(locale, event.status)}</StatusLabel>
            {isLive(event) ? <LiveBadge /> : null}
          </div>
          <h3 className="font-display mt-2 text-2xl font-semibold leading-7">{event.title}</h3>
          <p className="mt-1.5 flex items-center gap-2 text-sm text-[var(--padel-muted)]">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--padel-gold)]" aria-hidden="true" />
            <span className="truncate">{event.location}</span>
            {/* The tile beside this row carries the day and month but no year or
                time, and it is hidden from assistive tech; this states both. */}
            <span aria-hidden="true" className="shrink-0 tabular-nums">· {formatDate(event.date, { timeStyle: 'short' })}</span>
            <span className="sr-only">{formatDate(event.date, { dateStyle: 'long', timeStyle: 'short' })}</span>
          </p>
          {event.categories.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {event.categories.map((category) => <Badge key={category.id} variant="gold">{category.name}</Badge>)}
            </div>
          ) : null}
        </div>
        <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end sm:self-center">
          <SectionLinks event={event} compact />
          <ArrowRight className="h-4 w-4 shrink-0 text-[var(--padel-gold)] transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </div>
      </div>
    </li>
  );
}

/** Day and month as a tile, so a list of rows can be read down the date column. */
function DateTile({ date }: { date: string }) {
  const { formatDate } = useI18n();
  return (
    <p
      aria-hidden="true"
      className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-sm border border-[var(--padel-line-strong)] bg-[var(--padel-ivory)]/[0.06]"
    >
      <span className="font-display text-xl font-semibold leading-none tabular-nums">{formatDate(date, { day: 'numeric' })}</span>
      <span className="mt-1 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-[var(--padel-gold)]">{formatDate(date, { month: 'short' })}</span>
    </p>
  );
}

/* ---- Archive ---- */

function ArchiveShelf({ events }: { events: EventDto[] }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].directories.events;
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const categories = useMemo(() => categoryOptions(events), [events]);
  const filtered = useMemo(() => filterEvents(events, { query, categoryId }), [events, query, categoryId]);
  const groups = useMemo(() => groupByYear(filtered), [filtered]);

  return (
    <Shelf id="archive" title={copy.archive} description={copy.archiveDescription} meta={events.length}>
      {events.length ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="relative block w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--padel-gold)]" aria-hidden="true" />
              <Input
                aria-label={copy.search}
                placeholder={copy.search}
                value={query}
                onChange={(input) => setQuery(input.target.value)}
                className="min-h-11 w-full rounded-full border-[var(--padel-line)] bg-[var(--padel-red)]/35 pl-10 text-[var(--padel-ivory)] placeholder:text-[var(--padel-muted)]"
              />
            </label>
            <p className="text-sm text-[var(--padel-muted)]" aria-live="polite">
              {fillTemplate(copy.shown, { shown: filtered.length, total: events.length })}
            </p>
          </div>

          {categories.length > 1 ? (
            <div className="mt-4">
              <FilterChips
                label={copy.categoryFilter}
                value={categoryId}
                onChange={setCategoryId}
                options={[{ id: '', label: copy.allCategories }, ...categories.map((category) => ({ id: category.id, label: category.name, count: category.count }))]}
              />
            </div>
          ) : null}

          {groups.length ? (
            <div className="mt-6 grid gap-8">
              {groups.map((group) => (
                <section key={group.year} aria-label={String(group.year)}>
                  <div className="flex items-center gap-4">
                    <h3 className="font-display text-xl font-semibold tabular-nums text-[var(--padel-gold)]">{group.year}</h3>
                    <span className="h-px flex-1 bg-[var(--padel-line)]" aria-hidden="true" />
                    <span className="text-xs font-semibold tabular-nums text-[var(--padel-muted)]">{group.events.length}</span>
                  </div>
                  <ul className="mt-4 grid gap-3">
                    {group.events.map((event) => <EventRow key={event.id} event={event} />)}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <div className="mt-6"><EmptyTournamentState title={copy.searchEmpty} /></div>
          )}
        </>
      ) : (
        <EmptyTournamentState title={copy.archiveEmpty} />
      )}
    </Shelf>
  );
}
