'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Bell,
  CalendarDays,
  Home,
  ListChecks,
  LogOut,
  Settings,
  ShieldCheck,
  Building2,
  History,
  LayoutDashboard,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useI18n } from '@/components/shared/I18nProvider';
import { DashboardShell, SidebarLink } from '@/components/shared/dashboard/DashboardUI';
import { useLogout } from '@/hooks/useLogout';
import type { PublicUser } from '@/types/auth';

type PlayerShellProps = {
  title: string;
  description: string;
  eyebrow?: string;
  user: PublicUser;
  children: ReactNode;
};

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  exact?: boolean;
};

type NavGroup = {
  key: string;
  label?: string;
  items: NavItem[];
};

/**
 * The two counts the shell shows on every page: unread notifications on the
 * bell, and entries waiting on the player on "My entries". Fetched here, once
 * per navigation, so no page has to remember to pass them — and refreshed on
 * route change so a decision read on one page clears its badge on the next.
 * Fails soft: a badge that cannot load simply does not show.
 */
function useShellCounts(pathname: string) {
  const [counts, setCounts] = useState({
    unreadNotifications: 0,
    attentionEntries: 0,
    pendingOpponentRequests: 0,
  });

  useEffect(() => {
    let cancelled = false;
    void apiFetch('/api/me/summary', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then(
        (data: {
          unreadNotifications?: number;
          attentionEntries?: number;
          pendingOpponentRequests?: number;
        } | null) => {
          if (cancelled || !data) return;
          setCounts({
            unreadNotifications: data.unreadNotifications ?? 0,
            attentionEntries: data.attentionEntries ?? 0,
            pendingOpponentRequests: data.pendingOpponentRequests ?? 0,
          });
        },
      )
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return counts;
}

function isNavItemActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  // Event detail and the draw sit under Events — keep that section lit so the
  // player always knows which part of the journey they are in.
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function PlayerShell({ title, description, eyebrow, user, children }: PlayerShellProps) {
  const pathname = usePathname();
  const { dictionary, t } = useI18n();
  const player = dictionary.dashboard.player;
  const { logout } = useLogout();
  const { unreadNotifications, attentionEntries, pendingOpponentRequests } = useShellCounts(pathname);

  // Play first (the arrival questions), then account. Nested pages — event
  // detail, draw — live under Events and do not need their own top-level link.
  const groups: NavGroup[] = [
    {
      key: 'play',
      label: player.sidebar.groupPlay,
      items: [
        { href: '/dashboard', label: player.sidebar.overview, icon: LayoutDashboard, exact: true },
        {
          href: '/dashboard/events',
          label: player.sidebar.events,
          icon: CalendarDays,
          badge: pendingOpponentRequests || undefined,
        },
        {
          href: '/dashboard/entries',
          label: player.sidebar.entries,
          icon: ListChecks,
          badge: attentionEntries || undefined,
        },
        { href: '/dashboard/matches', label: player.sidebar.matches, icon: History },
      ],
    },
    {
      key: 'account',
      label: player.sidebar.groupAccount,
      items: [
        { href: '/dashboard/profile', label: player.sidebar.profile, icon: UserRound },
        { href: '/dashboard/club', label: player.sidebar.club, icon: Building2 },
        {
          href: '/notifications',
          label: player.sidebar.notifications,
          icon: Bell,
          badge: unreadNotifications || undefined,
        },
        { href: '/dashboard/settings', label: player.sidebar.settings, icon: Settings },
      ],
    },
  ];

  const flatItems = groups.flatMap((group) => group.items);
  // Club name in the subtitle makes the shell theirs; the generic fallback is
  // for players who have not joined a club yet.
  const sidebarSubtitle = user.club?.name ?? player.sidebarSubtitle;

  return (
    <DashboardShell
      eyebrow={eyebrow ?? player.eyebrow}
      title={title}
      description={description}
      sidebarSubtitle={sidebarSubtitle}
      sidebarContent={
        <div className="grid gap-1">
          {groups.map((group) => (
            <div key={group.key} className="dash-nav-group">
              {group.label ? <p className="dash-sidebar-label dash-nav-group__label">{group.label}</p> : null}
              <div className="grid gap-0.5">
                {group.items.map((item) => (
                  <SidebarLink
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    label={item.label}
                    badge={item.badge}
                    active={isNavItemActive(pathname, item)}
                  />
                ))}
              </div>
            </div>
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
            <Link
              href={`/clubs/${user.club.slug}`}
              className="mt-2 inline-flex min-h-11 max-w-full items-center gap-2 truncate text-xs font-medium text-[var(--dash-muted)] hover:text-[var(--dash-text)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-focus-ring)]"
            >
              {user.club.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.club.logoUrl}
                  alt=""
                  className="h-6 w-6 shrink-0 rounded-sm object-cover"
                />
              ) : (
                <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              )}
              <span className="truncate">{user.club.name}</span>
            </Link>
          ) : null}
        </div>
      }
      mobileNavigation={
        <nav className="dash-mobile-nav" aria-label={sidebarSubtitle}>
          {flatItems.map((item) => {
            const active = isNavItemActive(pathname, item);
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
      headerBell={{ href: '/notifications', label: player.sidebar.notifications, unread: unreadNotifications }}
      profile={{
        name: user.fullName,
        email: user.email,
        items: [
          { label: player.sidebar.profile, href: '/dashboard/profile', icon: UserRound },
          { label: player.sidebar.settings, href: '/dashboard/settings', icon: Settings },
          { label: dictionary.dashboard.account.sectionSecurity, href: '/dashboard/settings#security', icon: ShieldCheck },
          { label: t('common.logout'), onClick: logout, icon: LogOut, danger: true },
        ],
      }}
    >
      {children}
    </DashboardShell>
  );
}
