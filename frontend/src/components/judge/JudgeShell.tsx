'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Gavel, Home, LogOut, Rows3 } from 'lucide-react';
import { DashboardShell, SidebarLink } from '@/components/shared/dashboard/DashboardUI';
import { useLogout } from '@/hooks/useLogout';
import type { PublicUser } from '@/types/auth';
import { useI18n } from '@/components/shared/I18nProvider';
import { tournamentCopy } from '@/lib/i18n/tournament';

export function JudgeShell({ user, title, description, children }: { user: PublicUser; title: string; description: string; children: ReactNode }) {
  const pathname = usePathname();
  const { logout } = useLogout();
  const { locale } = useI18n();
  const copy = tournamentCopy[locale];
  const shell = copy.judge.shell;
  const items = [{ href: '/judge', label: shell.assignments, icon: Rows3 }];
  return <DashboardShell eyebrow={shell.eyebrow} title={title} description={description} sidebarSubtitle={shell.subtitle} sidebarContent={<div className="grid gap-1">{items.map((item) => <SidebarLink key={item.href} href={item.href} icon={item.icon} label={item.label} active={pathname === item.href} />)}<SidebarLink href="/" icon={Home} label={copy.common.publicSite} /></div>} sidebarFooter={<div className="p-1"><p className="truncate text-sm font-semibold text-[var(--dash-text)]">{user.fullName}</p><p className="mt-1 truncate text-xs text-[var(--dash-muted)]">{shell.account}</p></div>} mobileNavigation={<nav className="dash-mobile-nav" aria-label={shell.navigation}><Link href="/judge" className="dash-mobile-link" data-active={pathname === '/judge'}><Gavel className="h-4 w-4" />{shell.assignments}</Link></nav>} headerBell={{ href: '/notifications', label: shell.notifications }} profile={{ name: user.fullName, email: user.email, items: [{ label: shell.logout, onClick: logout, icon: LogOut, danger: true }] }}>{children}</DashboardShell>;
}
