'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, CalendarDays, Home, LoaderCircle, RotateCcw, Trophy, UserRound, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/components/shared/I18nProvider';
import { tournamentCopy } from '@/lib/i18n/tournament';
import { cn } from '@/lib/utils';
import { PublicPageShell } from './PublicDirectoryClients';
import { panelSurface } from './PublicEventSections';

/**
 * The screens Next.js reaches for on its own — a 404, a thrown render, a
 * pending navigation.
 *
 * They live here rather than inside each route file because the framework
 * renders them without asking, and its own defaults are unstyled white pages.
 * A visitor following a stale link to a club is still a visitor: the brand
 * chrome, the language, and a way back have to survive the failure.
 */

const destinations: Array<{ key: 'events' | 'players' | 'clubs' | 'matches'; href: string; icon: LucideIcon }> = [
  { key: 'events', href: '/events', icon: CalendarDays },
  { key: 'players', href: '/players', icon: UserRound },
  { key: 'clubs', href: '/clubs', icon: Users },
  { key: 'matches', href: '/matches', icon: Trophy },
];

/** The shared frame: badge, headline, explanation, then whatever gets you out. */
function RouteMessage({ badge, title, description, aside, children }: { badge: string; title: string; description: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
      <div className="min-w-0">
        <Badge variant="gold">{badge}</Badge>
        <h1 className="font-display mt-5 text-5xl font-semibold leading-tight md:text-7xl">{title}</h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--padel-muted)]">{description}</p>
        <div className="mt-8 flex flex-wrap items-center gap-3">{children}</div>
      </div>
      {aside}
    </div>
  );
}

function PrimaryAction({ href, onClick, icon: Icon, children }: { href?: string; onClick?: () => void; icon: LucideIcon; children: ReactNode }) {
  const className =
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--padel-gold)]/60 bg-[var(--padel-gold)]/12 px-5 text-sm font-semibold text-[var(--padel-ivory)] transition-colors hover:bg-[var(--padel-gold)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]';
  const body = (
    <>
      <Icon className="h-4 w-4" aria-hidden="true" />
      {children}
    </>
  );
  if (href) return <Link href={href} className={className}>{body}</Link>;
  return <button type="button" onClick={onClick} className={className}>{body}</button>;
}

/**
 * Where to go instead. A 404 that only apologises leaves the visitor at a dead
 * end, so the four public sections are offered as the next click.
 */
function Destinations() {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].routeErrors;
  return (
    <nav aria-label={copy.notFound.whereToGo} className={cn(panelSurface, 'border p-5 lg:w-72')}>
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--padel-gold)]">{copy.notFound.whereToGo}</p>
      <ul className="mt-4 grid gap-2">
        {destinations.map((destination) => (
          <li key={destination.key}>
            <Link
              href={destination.href}
              className="group flex min-h-11 items-center gap-3 rounded-sm border border-transparent px-3 text-sm font-semibold text-[var(--padel-ivory)] transition-colors hover:border-[var(--padel-line-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]"
            >
              <destination.icon className="h-4 w-4 shrink-0 text-[var(--padel-gold)]" aria-hidden="true" />
              <span className="flex-1">{copy.links[destination.key]}</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-[var(--padel-gold)] transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function RouteNotFound() {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].routeErrors.notFound;
  return (
    <PublicPageShell>
      <p aria-hidden="true" className="font-display text-[5rem] font-semibold leading-none tabular-nums text-[var(--padel-ivory)]/15 md:text-[8rem]">
        {copy.code}
      </p>
      <div className="mt-4">
        <RouteMessage badge={copy.badge} title={copy.title} description={copy.description} aside={<Destinations />}>
          <PrimaryAction href="/" icon={Home}>{copy.home}</PrimaryAction>
        </RouteMessage>
      </div>
    </PublicPageShell>
  );
}

/**
 * A render that threw. `digest` is the only handle the visitor and the operator
 * share when the real message is server-side, so it is shown rather than
 * swallowed — but only when Next.js produced one.
 */
export function RouteFailure({ digest, onRetry }: { digest?: string; onRetry: () => void }) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].routeErrors.failure;
  return (
    <PublicPageShell>
      <RouteMessage badge={copy.badge} title={copy.title} description={copy.description} aside={<Destinations />}>
        <PrimaryAction onClick={onRetry} icon={RotateCcw}>{copy.retry}</PrimaryAction>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-sm font-semibold text-[var(--padel-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]"
        >
          {copy.home}
        </Link>
      </RouteMessage>
      {digest ? (
        <p className="mt-8 text-xs text-[var(--padel-muted)]">
          {copy.reference} <code className="font-mono tabular-nums">{digest}</code>
        </p>
      ) : null}
    </PublicPageShell>
  );
}

/**
 * The gap between a click and the server's first byte. Blocks of the page's own
 * shape rather than a spinner alone, so the layout does not jump when the real
 * content lands.
 */
export function RouteLoading() {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].routeErrors.loading;
  return (
    <PublicPageShell>
      <div role="status" aria-live="polite" className="animate-pulse">
        <span className="sr-only">{copy.announce}</span>
        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--padel-line)] bg-[var(--padel-gold)]/12 px-2.5 py-0.5 text-xs font-semibold text-[var(--padel-gold)]">
          <LoaderCircle className="h-3 w-3 animate-spin" aria-hidden="true" />
          {copy.label}
        </span>
        <div aria-hidden="true">
          <div className="mt-6 h-12 w-3/4 rounded-sm bg-[var(--padel-ivory)]/10 md:h-16 md:w-1/2" />
          <div className="mt-5 h-4 w-full max-w-2xl rounded-sm bg-[var(--padel-ivory)]/[0.07]" />
          <div className="mt-2.5 h-4 w-2/3 max-w-xl rounded-sm bg-[var(--padel-ivory)]/[0.07]" />
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <div key={index} className={cn(panelSurface, 'border p-5')}>
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 shrink-0 rounded-full bg-[var(--padel-ivory)]/10" />
                  <div className="min-w-0 flex-1">
                    <div className="h-5 w-3/4 rounded-sm bg-[var(--padel-ivory)]/10" />
                    <div className="mt-2 h-3.5 w-1/2 rounded-sm bg-[var(--padel-ivory)]/[0.07]" />
                  </div>
                </div>
                <div className="mt-6 h-10 rounded-sm border-t border-[var(--padel-line)] bg-[var(--padel-ivory)]/[0.04]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </PublicPageShell>
  );
}
