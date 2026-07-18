'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Bell, Gavel, Home, LogOut, Rows3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DashboardShell, SidebarLink, softButtonClassName } from '@/components/shared/dashboard/DashboardUI';
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
  const items = [{ href: '/judge', label: shell.assignments, icon: Rows3 }, { href: '/notifications', label: shell.notifications, icon: Bell }];
  return <DashboardShell eyebrow={shell.eyebrow} title={title} description={description} sidebarSubtitle={shell.subtitle} sidebarContent={<div className="grid gap-1">{items.map((item) => <SidebarLink key={item.href} href={item.href} icon={item.icon} label={item.label} active={pathname === item.href} />)}<SidebarLink href="/" icon={Home} label={copy.common.publicSite} /></div>} sidebarFooter={<div className="p-1"><p className="truncate text-sm font-semibold text-[var(--padel-ivory)]">{user.fullName}</p><p className="mt-1 truncate text-xs text-[rgba(213,201,177,0.5)]">{shell.account}</p></div>} mobileNavigation={<nav className="dash-mobile-nav" aria-label={shell.navigation}><Link href="/judge" className="dash-mobile-link" data-active={pathname === '/judge'}><Gavel className="h-4 w-4" />{shell.assignments}</Link><Link href="/notifications" className="dash-mobile-link" data-active={pathname === '/notifications'}><Bell className="h-4 w-4" />{shell.notifications}</Link></nav>} actions={<Button variant="outline" className={`${softButtonClassName} min-h-11 rounded-md`} onClick={logout}><LogOut className="h-4 w-4" />{shell.logout}</Button>}>{children}</DashboardShell>;
}
