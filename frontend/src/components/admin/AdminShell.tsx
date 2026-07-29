'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Gavel,
  GitBranch,
  Handshake,
  Home,
  LayoutDashboard,
  LogOut,
  Settings,
  Shield,
  ShieldCheck,
  Tags,
  Trophy,
  UserCog,
  Users,
} from 'lucide-react';
import { useI18n } from '@/components/shared/I18nProvider';
import { DashboardShell, SidebarLink } from '@/components/shared/dashboard/DashboardUI';
import { useAdminCounts } from '@/hooks/useAdminCounts';
import { useViewer } from '@/hooks/useViewer';
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

type NavGroup = {
  key: string;
  label?: string;
  items: NavItem[];
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
  const { viewer } = useViewer();
  const { logout } = useLogout();
  const eventId = getEventId(pathname);

  // Organisers run events; accounts, clubs and platform setup stay with admins,
  // so those entries are hidden rather than shown and refused.
  const isOrganiser = viewer?.role === 'ORGANISER';

  // Every step of the tournament lifecycle is always in the sidebar, so the
  // navigation never changes shape underneath the user. When an event is open
  // the step links point straight into it; otherwise they open the picker that
  // asks which event to work on.
  const scoped = (suffix: string, index: string) => (eventId ? `/admin/events/${eventId}/${suffix}` : index);

  const operationsItems: NavItem[] = [
    { href: '/admin/events', label: nav.events, icon: CalendarDays, badge: isOrganiser ? undefined : counts.drafts || undefined },
    { href: eventId ? `/admin/events/${eventId}` : '/admin/workspace', label: nav.eventWorkspace, icon: Trophy },
    // The unscoped registrations index is admin-only; organisers reach the same
    // review screen through the event they were handed.
    ...(eventId || !isOrganiser
      ? [
          {
            href: scoped('registrations', '/admin/registrations'),
            label: nav.registrations,
            icon: ClipboardList,
            badge: eventId ? undefined : counts.pending || undefined,
          },
        ]
      : []),
    { href: scoped('opponent-requests', '/admin/opponent-requests'), label: nav.opponentRequests, icon: Handshake },
    { href: scoped('bracket', '/admin/brackets'), label: nav.brackets, icon: GitBranch },
    { href: scoped('schedule', '/admin/schedule'), label: nav.schedule, icon: CalendarClock },
  ];

  // Accounts get one screen per role: their powers and required fields differ,
  // so a single list forced every column to mean "sometimes".
  const peopleItems: NavItem[] = isOrganiser
    ? []
    : [
        { href: '/admin/users/admins', label: nav.admins, icon: Shield },
        { href: '/admin/users/organisers', label: nav.organisers, icon: UserCog },
        { href: '/admin/users/judges', label: nav.judges, icon: Gavel },
        { href: '/admin/users/players', label: nav.players, icon: Users },
        { href: '/admin/clubs', label: nav.clubs, icon: Building2 },
        { href: '/admin/applications', label: nav.applications, icon: ClipboardCheck, badge: counts.applications || undefined },
      ];

  const platformItems: NavItem[] = isOrganiser
    ? []
    : [{ href: '/admin/categories', label: nav.categories, icon: Tags, badge: counts.categories || undefined }];

  // The signed-in person's own screen, so it stays in the sidebar for every
  // role that has this workspace — it is not a platform-administration tool.
  const accountItems: NavItem[] = [{ href: '/admin/settings', label: nav.settings, icon: Settings }];

  const groups: NavGroup[] = [
    { key: 'root', items: [{ href: '/admin', label: nav.overview, icon: LayoutDashboard }] },
    { key: 'operations', label: nav.groupOperations, items: operationsItems },
    { key: 'people', label: nav.groupPeople, items: peopleItems },
    { key: 'platform', label: nav.groupPlatform, items: platformItems },
    { key: 'account', label: nav.groupAccount, items: accountItems },
  ].filter((group) => group.items.length);

  const shell = dictionary.dashboard.admin.shell;

  return (
    <DashboardShell
      eyebrow={eyebrow ?? (isOrganiser ? shell.organiserEyebrow : shell.eyebrow)}
      title={title}
      description={description}
      sidebarSubtitle={isOrganiser ? shell.organiserSidebarSubtitle : shell.sidebarSubtitle}
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
                    active={isNavItemActive(pathname, item.href)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      }
      sidebarFooter={<SidebarLink href="/" icon={Home} label={nav.publicSite} />}
      headerBell={{ href: '/notifications', label: nav.notifications }}
      profile={{
        name: viewer?.fullName,
        email: viewer?.email,
        items: [
          { label: nav.settings, href: '/admin/settings#profile', icon: Settings },
          { label: dictionary.dashboard.account.sectionSecurity, href: '/admin/settings#security', icon: ShieldCheck },
          { label: t('common.logout'), onClick: logout, icon: LogOut, danger: true },
        ],
      }}
    >
      {children}
    </DashboardShell>
  );
}
