'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  CalendarDays,
  Home,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Settings,
  Building2,
  History,
} from 'lucide-react';
import { useI18n } from '@/components/shared/I18nProvider';
import { DashboardShell, SidebarLink } from '@/components/shared/dashboard/DashboardUI';
import { useLogout } from '@/hooks/useLogout';
import type { PublicUser } from '@/types/auth';

type PlayerShellProps = {
  title: string;
  description: string;
  eyebrow?: string;
  pendingCount?: number;
  user: PublicUser;
  children: ReactNode;
};

export function PlayerShell({
  title,
  description,
  eyebrow,
  pendingCount = 0,
  user,
  children,
}: PlayerShellProps) {
  const pathname = usePathname();
  const { dictionary, t } = useI18n();
  const player = dictionary.dashboard.player;
  const { logout } = useLogout();

  const items = [
    { href: '/dashboard', label: player.sidebar.overview, icon: LayoutDashboard, exact: true },
    { href: '/dashboard/club', label: player.sidebar.club, icon: Building2 },
    { href: '/dashboard/events', label: player.sidebar.events, icon: CalendarDays },
    {
      href: '/dashboard/entries',
      label: player.sidebar.entries,
      icon: ListChecks,
      badge: pendingCount || undefined,
    },
    { href: '/dashboard/matches', label: player.sidebar.matches, icon: History },
    { href: '/dashboard/settings', label: player.sidebar.settings, icon: Settings },
  ];

  return (
    <DashboardShell
      eyebrow={eyebrow ?? player.eyebrow}
      title={title}
      description={description}
      sidebarSubtitle={player.sidebarSubtitle}
      sidebarContent={
        <div className="grid gap-0.5">
          {items.map((item) => (
            <SidebarLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              badge={'badge' in item ? item.badge : undefined}
              active={
                'exact' in item && item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`)
              }
            />
          ))}
          <div className="my-3 h-px bg-[var(--dash-border)]" />
          <SidebarLink href="/" icon={Home} label={player.sidebar.publicSite} />
        </div>
      }
      sidebarFooter={
        <div className="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-tint)] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--dash-faint)]">
            {player.signedIn}
          </p>
          <p className="mt-2 truncate text-sm font-medium text-[var(--dash-text)]">{user.fullName}</p>
          <p className="mt-0.5 truncate text-xs text-[var(--dash-muted)]">{user.email}</p>
          {user.club ? (
            <p className="mt-1 truncate text-xs text-[var(--dash-muted)]">{user.club.name}</p>
          ) : null}
        </div>
      }
      mobileNavigation={
        <nav className="dash-mobile-nav" aria-label={player.sidebarSubtitle}>
          {items.map((item) => {
            const active =
              'exact' in item && item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
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
                {'badge' in item && item.badge ? (
                  <span className="dash-nav-badge !ml-1">{item.badge}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      }
      headerBell={{ href: '/notifications', label: player.sidebar.notifications }}
      profile={{
        name: user.fullName,
        email: user.email,
        items: [
          { label: player.sidebar.settings, href: '/dashboard/settings', icon: Settings },
          { label: t('common.logout'), onClick: logout, icon: LogOut, danger: true },
        ],
      }}
    >
      {children}
    </DashboardShell>
  );
}
