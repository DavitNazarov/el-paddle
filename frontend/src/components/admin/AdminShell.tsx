'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  CalendarDays,
  ClipboardList,
  Home,
  LayoutDashboard,
  LogOut,
  Settings,
  Tags,
  Users,
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

export function AdminShell({ title, description, eyebrow, children }: AdminShellProps) {
  const pathname = usePathname();
  const { dictionary, t } = useI18n();
  const nav = dictionary.dashboard.admin.nav;
  const { counts } = useAdminCounts();
  const { logout } = useLogout();

  const items: NavItem[] = [
    { href: '/admin', label: nav.overview, icon: LayoutDashboard },
    { href: '/admin/categories', label: nav.categories, icon: Tags, badge: counts.categories || undefined },
    { href: '/admin/events', label: nav.events, icon: CalendarDays, badge: counts.drafts || undefined },
    { href: '/admin/registrations', label: nav.registrations, icon: ClipboardList, badge: counts.pending || undefined },
    { href: '/admin/clubs', label: nav.clubs, icon: Building2 },
    { href: '/admin/users', label: nav.users, icon: Users },
    { href: '/admin/settings', label: nav.settings, icon: Settings },
  ];

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
              active={item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)}
            />
          ))}
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
          {items.map((item) => {
            const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
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
