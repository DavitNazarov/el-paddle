'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  CalendarDays,
  ClipboardList,
  Home,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Tags,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/shared/I18nProvider';
import { useAdminCounts } from '@/hooks/useAdminCounts';
import { useLogout } from '@/hooks/useLogout';

type AdminShellProps = {
  title: string;
  description: string;
  eyebrow?: string;
  children: ReactNode;
};

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

export function AdminShell({ title, description, eyebrow, children }: AdminShellProps) {
  const pathname = usePathname();
  const { dictionary, t } = useI18n();
  const nav = dictionary.dashboard.admin.nav;
  const { counts } = useAdminCounts();
  const { logout } = useLogout();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const items: NavItem[] = [
    { href: '/admin', label: nav.overview, icon: LayoutDashboard },
    { href: '/admin/categories', label: nav.categories, icon: Tags, badge: counts.categories || undefined },
    { href: '/admin/events', label: nav.events, icon: CalendarDays, badge: counts.drafts || undefined },
    { href: '/admin/registrations', label: nav.registrations, icon: ClipboardList, badge: counts.pending || undefined },
    { href: '/admin/clubs', label: nav.clubs, icon: Building2 },
  ];

  const sidebarToggleLabel = sidebarOpen ? t('dashboard.shell.collapse') : t('dashboard.shell.expand');

  return (
    <main className="min-h-dvh bg-[#f0e9dd] text-[var(--padel-ink)]">
      <div
        className={cn(
          'grid min-h-dvh transition-[grid-template-columns] duration-300 ease-out',
          sidebarOpen ? 'lg:grid-cols-[16.5rem_1fr]' : 'lg:grid-cols-[4.5rem_1fr]',
        )}
      >
        <aside
          className={cn(
            'hidden border-r border-white/10 bg-[var(--padel-ink)] text-[var(--padel-ivory)] lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col',
            !sidebarOpen && 'items-center',
          )}
        >
          <div
            className={cn(
              'flex w-full items-center gap-3 border-b border-white/10 py-5',
              sidebarOpen ? 'justify-between px-4' : 'justify-center px-2',
            )}
          >
            {sidebarOpen ? (
              <div className="min-w-0">
                <Link href="/admin" className="font-display text-xl font-semibold tracking-normal">
                  El Padel
                </Link>
                <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--padel-gold)]">
                  {dictionary.dashboard.admin.shell.sidebarSubtitle}
                </p>
              </div>
            ) : null}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              title={sidebarToggleLabel}
              aria-label={sidebarToggleLabel}
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen((current) => !current)}
              className="h-9 w-9 shrink-0 rounded-md text-[var(--padel-ivory)] hover:bg-white/10"
            >
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </Button>
          </div>

          <nav
            aria-label={dictionary.dashboard.admin.shell.sidebarSubtitle}
            className={cn(
              'flex-1 overflow-y-auto py-3',
              sidebarOpen ? 'w-full px-2' : 'w-full px-1.5 [&_.admin-nav-label]:sr-only [&_.admin-nav-link]:justify-center',
            )}
          >
            <div className="grid gap-1">
              {items.map((item) => (
                <AdminNavLink
                  key={item.href}
                  item={item}
                  active={item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)}
                  compact={!sidebarOpen}
                />
              ))}
            </div>
          </nav>

          {sidebarOpen ? (
            <div className="border-t border-white/10 p-3">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--padel-gold)]">
                  {dictionary.dashboard.admin.shell.snapshot}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <SnapshotItem label={dictionary.dashboard.admin.counts.pending} value={counts.pending} highlight={counts.pending > 0} />
                  <SnapshotItem label={dictionary.dashboard.admin.counts.published} value={counts.published} />
                  <SnapshotItem label={dictionary.dashboard.admin.counts.events} value={counts.events} />
                  <SnapshotItem label={dictionary.dashboard.admin.counts.clubs} value={counts.clubs} />
                </div>
              </div>
              <Button asChild variant="ghost" className="admin-nav-link mt-2 h-10 w-full justify-start px-3 text-[var(--padel-muted)] hover:bg-white/8 hover:text-[var(--padel-ivory)]">
                <Link href="/">
                  <Home className="h-4 w-4" />
                  <span className="admin-nav-label">{nav.publicSite}</span>
                </Link>
              </Button>
            </div>
          ) : null}
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-[rgba(19,2,2,0.08)] bg-[#f0e9dd]/95 backdrop-blur-xl">
            <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  {eyebrow ? (
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--padel-red)]">{eyebrow}</p>
                  ) : null}
                  <h1 className={cn('font-semibold tracking-normal text-[var(--padel-ink)]', eyebrow ? 'mt-2 text-2xl sm:text-3xl' : 'text-2xl sm:text-3xl')}>
                    {title}
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[rgba(19,2,2,0.62)]">{description}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <LanguageSwitcher tone="light" />
                  <Button variant="red" onClick={logout}>
                    <LogOut className="h-4 w-4" />
                    {t('common.logout')}
                  </Button>
                </div>
              </div>

              <nav className="mt-4 flex gap-1 overflow-x-auto pb-1 lg:hidden" aria-label={nav.mobile}>
                {items.map((item) => (
                  <AdminNavLink
                    key={item.href}
                    item={item}
                    active={item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)}
                    mobile
                  />
                ))}
              </nav>
            </div>
          </header>

          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</div>
        </section>
      </div>
    </main>
  );
}

function AdminNavLink({
  item,
  active,
  mobile = false,
  compact = false,
}: {
  item: NavItem;
  active: boolean;
  mobile?: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      href={item.href}
      title={item.label}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'admin-nav-link relative inline-flex items-center gap-2.5 rounded-md font-semibold transition-colors',
        mobile
          ? 'min-h-10 shrink-0 px-3 py-2 text-xs'
          : 'min-h-10 w-full px-3 text-sm',
        active
          ? 'bg-[var(--padel-ivory)] text-[var(--padel-red)]'
          : 'text-[var(--padel-muted)] hover:bg-white/8 hover:text-[var(--padel-ivory)]',
        compact && 'justify-center px-2',
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      <span className={cn('admin-nav-label truncate', mobile && 'whitespace-nowrap')}>{item.label}</span>
      {item.badge ? (
        <span
          className={cn(
            'ml-auto inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
            active ? 'bg-[var(--padel-red)]/12 text-[var(--padel-red)]' : 'bg-[var(--padel-red)] text-[var(--padel-ivory)]',
            compact && 'absolute -right-0.5 -top-0.5 ml-0 min-w-4 px-1',
          )}
        >
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

function SnapshotItem({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div>
      <p className={cn('text-base font-semibold', highlight ? 'text-[var(--padel-gold)]' : 'text-[var(--padel-ivory)]')}>{value}</p>
      <p className="mt-0.5 text-[10px] text-[var(--padel-muted)]">{label}</p>
    </div>
  );
}
