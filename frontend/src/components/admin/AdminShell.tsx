'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  GitBranch,
  Handshake,
  Home,
  LayoutDashboard,
  LogOut,
  Settings,
  Tags,
  Trophy,
  Users,
  Bell,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/shared/I18nProvider';
import {
  DashboardShell,
  SidebarLink,
  softButtonClassName,
} from '@/components/shared/dashboard/DashboardUI';
import { useAdminCounts } from '@/hooks/useAdminCounts';
import { useLogout } from '@/hooks/useLogout';
import { cn } from '@/lib/utils';

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

function getEventId(pathname: string) {
  return pathname.match(/^\/admin\/events\/([^/]+)/)?.[1];
}

function isNavItemActive(pathname: string, href: string) {
  if (href === '/admin') return pathname === href;
  if (href === '/admin/events') return pathname === href;
  if (/^\/admin\/events\/[^/]+$/.test(href)) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ title, description, eyebrow, children }: AdminShellProps) {
  const pathname = usePathname();
  const { dictionary, t } = useI18n();
  const nav = dictionary.dashboard.admin.nav;
  const { counts } = useAdminCounts();
  const { logout } = useLogout();
  const eventId = getEventId(pathname);

  const items: NavItem[] = [
    { href: '/admin', label: nav.overview, icon: LayoutDashboard },
    { href: '/admin/categories', label: nav.categories, icon: Tags, badge: counts.categories || undefined },
    { href: '/admin/events', label: nav.events, icon: CalendarDays, badge: counts.drafts || undefined },
    { href: '/admin/registrations', label: nav.registrations, icon: ClipboardList, badge: counts.pending || undefined },
    { href: '/admin/brackets', label: nav.brackets, icon: GitBranch },
    { href: '/admin/opponent-requests', label: nav.opponentRequests, icon: Handshake },
    { href: '/admin/schedule', label: nav.schedule, icon: CalendarClock },
    { href: '/admin/clubs', label: nav.clubs, icon: Building2 },
    { href: '/admin/users', label: nav.users, icon: Users },
    { href: '/notifications', label: nav.notifications, icon: Bell },
    { href: '/admin/settings', label: nav.settings, icon: Settings },
  ];

  const eventItems: NavItem[] = eventId
    ? [
        { href: `/admin/events/${eventId}`, label: nav.eventWorkspace, icon: Trophy },
        { href: `/admin/events/${eventId}/registrations`, label: nav.eventRegistrations, icon: ClipboardList },
        { href: `/admin/events/${eventId}/opponent-requests`, label: nav.opponentRequests, icon: Handshake },
        { href: `/admin/events/${eventId}/bracket`, label: nav.bracket, icon: GitBranch },
        { href: `/admin/events/${eventId}/schedule`, label: nav.schedule, icon: CalendarClock },
      ]
    : [];

  const mobileItems = eventItems.length ? [...eventItems, ...items] : items;

  return (
    <DashboardShell
      eyebrow={eyebrow ?? dictionary.dashboard.admin.shell.eyebrow}
      title={title}
      description={description}
      sidebarSubtitle={dictionary.dashboard.admin.shell.sidebarSubtitle}
      sidebarContent={
        <div className="grid gap-0.5">
          {items.map((item) => (
            <SidebarLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              badge={item.badge}
              active={isNavItemActive(pathname, item.href)}
            />
          ))}
          {eventItems.length ? (
            <div className="mt-4 border-t border-[rgba(213,201,177,0.1)] pt-3">
              <p className="dash-sidebar-label mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgba(213,201,177,0.42)]">
                {nav.eventTools}
              </p>
              <div className="grid gap-0.5">
                {eventItems.map((item) => (
                  <SidebarLink
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    label={item.label}
                    active={isNavItemActive(pathname, item.href)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      }
      sidebarFooter={
        <div className="space-y-3">
          <div className="rounded-lg border border-[rgba(213,201,177,0.1)] bg-[rgba(213,201,177,0.03)] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[rgba(213,201,177,0.42)]">
              {dictionary.dashboard.admin.shell.snapshot}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <SnapshotItem label={dictionary.dashboard.admin.counts.pending} value={counts.pending} highlight={counts.pending > 0} />
              <SnapshotItem label={dictionary.dashboard.admin.counts.published} value={counts.published} />
              <SnapshotItem label={dictionary.dashboard.admin.counts.events} value={counts.events} />
              <SnapshotItem label={dictionary.dashboard.admin.counts.clubs} value={counts.clubs} />
            </div>
          </div>
          <SidebarLink href="/" icon={Home} label={nav.publicSite} />
        </div>
      }
      mobileNavigation={
        <nav className="dash-mobile-nav" aria-label={nav.mobile}>
          {mobileItems.map((item) => {
            const active = isNavItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                data-active={active}
                className="dash-mobile-link"
                aria-current={active ? 'page' : undefined}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
                {item.badge ? <span className="dash-nav-badge !ml-1">{item.badge}</span> : null}
              </Link>
            );
          })}
        </nav>
      }
      actions={
        <Button variant="outline" className={cn(softButtonClassName, 'rounded-md')} onClick={logout}>
          <LogOut className="h-4 w-4" />
          {t('common.logout')}
        </Button>
      }
    >
      {children}
    </DashboardShell>
  );
}

function SnapshotItem({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div>
      <p className={cn('text-lg font-semibold tabular-nums text-[var(--padel-ivory)]', highlight && 'text-[var(--padel-ivory)]')}>
        {value}
      </p>
      <p className="mt-0.5 text-[10px] text-[rgba(213,201,177,0.42)]">{label}</p>
    </div>
  );
}
