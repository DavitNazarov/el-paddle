'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CircleDashed, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

type DashboardShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  sidebarTitle?: string;
  sidebarSubtitle?: string;
  sidebarContent?: ReactNode;
  sidebarFooter?: ReactNode;
  mobileNavigation?: ReactNode;
  children: ReactNode;
};

type SidebarLinkProps = {
  href: string;
  icon: LucideIcon;
  label: string;
  active?: boolean;
};

type StatCardProps = {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  description?: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
};

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
};

export const formControlClassName =
  'min-h-11 border-[rgba(19,2,2,0.14)] bg-white text-[var(--padel-ink)] placeholder:text-[rgba(19,2,2,0.42)] focus-visible:ring-[var(--padel-focus-ring)]';

export const selectControlClassName = cn(
  formControlClassName,
  'h-11 w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50',
);

export const sidebarTabTriggerClassName =
  'dashboard-sidebar-button flex min-h-11 w-full justify-start gap-3 rounded-md px-3 text-sm font-semibold text-[var(--padel-muted)] transition-colors hover:bg-white/8 hover:text-[var(--padel-ivory)] focus-visible:ring-1 focus-visible:ring-[rgba(231,194,93,0.46)] focus-visible:ring-offset-0 data-[state=active]:bg-[var(--padel-ivory)] data-[state=active]:text-[var(--padel-red)] data-[state=active]:shadow-none data-[state=active]:ring-0';

export const mobileTabTriggerClassName =
  'min-h-10 flex-1 rounded-md px-3 text-sm font-semibold text-[var(--padel-muted)] data-[state=active]:bg-[var(--padel-ivory)] data-[state=active]:text-[var(--padel-red)]';

export function DashboardShell({
  eyebrow,
  title,
  description,
  actions,
  sidebarTitle = 'El Padel',
  sidebarSubtitle = 'Tournament operations',
  sidebarContent,
  sidebarFooter,
  mobileNavigation,
  children,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const hasSidebar = Boolean(sidebarContent || sidebarFooter);

  return (
    <main className="min-h-dvh bg-[#f5efe3] text-[var(--padel-ink)]">
      <div
        className={cn(
          'grid min-h-dvh transition-[grid-template-columns] duration-300 ease-out',
          hasSidebar && sidebarOpen && 'lg:grid-cols-[18rem_1fr]',
          hasSidebar && !sidebarOpen && 'lg:grid-cols-[5.25rem_1fr]',
          !hasSidebar && 'lg:grid-cols-1',
        )}
      >
        {hasSidebar ? (
          <aside
            className={cn(
              'hidden border-r border-white/10 bg-[var(--padel-ink)] text-[var(--padel-ivory)] lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col',
              !sidebarOpen && 'items-center',
            )}
          >
            <div
              className={cn(
                'flex w-full items-center gap-3 border-b border-white/10 py-5',
                sidebarOpen ? 'justify-between px-5' : 'justify-center px-3',
              )}
            >
              {sidebarOpen ? (
                <div className="min-w-0">
                  <Link href="/" className="font-display text-2xl font-semibold tracking-normal">
                    {sidebarTitle}
                  </Link>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--padel-gold)]">
                    {sidebarSubtitle}
                  </p>
                </div>
              ) : null}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                aria-expanded={sidebarOpen}
                onClick={() => setSidebarOpen((current) => !current)}
                className="h-10 w-10 shrink-0 rounded-md text-[var(--padel-ivory)] hover:bg-white/10 hover:text-[var(--padel-ivory)] focus-visible:ring-1 focus-visible:ring-[rgba(231,194,93,0.56)] focus-visible:ring-offset-0"
              >
                {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
              </Button>
            </div>
            {sidebarContent ? (
              <div
                className={cn(
                  'flex-1 py-4',
                  sidebarOpen ? 'w-full px-3' : 'w-full px-2 [&_.dashboard-sidebar-button]:justify-center [&_.dashboard-sidebar-label]:sr-only',
                )}
              >
                {sidebarContent}
              </div>
            ) : null}
            {sidebarFooter && sidebarOpen ? <div className="w-full border-t border-white/10 p-4">{sidebarFooter}</div> : null}
          </aside>
        ) : null}

        <section className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-[rgba(19,2,2,0.08)] bg-[#f5efe3]/92 backdrop-blur-xl">
            <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--padel-red)]">
                    {eyebrow}
                  </p>
                  <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-normal text-[var(--padel-ink)] sm:text-3xl">
                    {title}
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[rgba(19,2,2,0.62)]">
                    {description}
                  </p>
                </div>
                {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
              </div>
              {mobileNavigation ? <div className="mt-4 lg:hidden">{mobileNavigation}</div> : null}
            </div>
          </header>

          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </section>
      </div>
    </main>
  );
}

export function SidebarLink({ href, icon: Icon, label, active = false }: SidebarLinkProps) {
  return (
    <Button
      asChild
      variant="ghost"
      title={label}
      className={cn(
        'dashboard-sidebar-button h-11 w-full justify-start rounded-md px-3 text-sm font-semibold text-[var(--padel-muted)] hover:bg-white/8 hover:text-[var(--padel-ivory)] focus-visible:ring-1 focus-visible:ring-[rgba(231,194,93,0.46)] focus-visible:ring-offset-0',
        active && 'bg-[var(--padel-ivory)] text-[var(--padel-red)] ring-0 hover:bg-[var(--padel-ivory)] hover:text-[var(--padel-red)]',
      )}
    >
      <Link href={href}>
        <Icon className="h-4 w-4" />
        <span className="dashboard-sidebar-label">{label}</span>
      </Link>
    </Button>
  );
}

export function SurfaceCard({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Card>) {
  return (
    <Card
      className={cn(
        'rounded-lg border-[rgba(19,2,2,0.08)] bg-white/82 text-[var(--padel-ink)] shadow-[0_18px_70px_rgba(19,2,2,0.08)] backdrop-blur',
        className,
      )}
      {...props}
    />
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  description,
  tone = 'neutral',
}: StatCardProps) {
  const toneClass = {
    neutral: 'bg-[var(--padel-red)] text-[var(--padel-ivory)]',
    success: 'bg-emerald-700 text-white',
    warning: 'bg-[var(--padel-gold)] text-[var(--padel-ink)]',
    danger: 'bg-[var(--padel-red-2)] text-[var(--padel-ivory)]',
  }[tone];

  return (
    <SurfaceCard>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(19,2,2,0.5)]">
              {label}
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-normal text-[var(--padel-ink)]">
              {value}
            </p>
          </div>
          {Icon ? (
            <span className={cn('inline-flex h-10 w-10 items-center justify-center rounded-md', toneClass)}>
              <Icon className="h-5 w-5" />
            </span>
          ) : null}
        </div>
        {description ? <p className="mt-4 text-sm leading-6 text-[rgba(19,2,2,0.58)]">{description}</p> : null}
      </CardContent>
    </SurfaceCard>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  actions,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div>
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--padel-red)]">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-1 text-xl font-semibold tracking-normal text-[var(--padel-ink)]">
          {title}
        </h2>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-[rgba(19,2,2,0.6)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function DashboardField({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-[0.16em] text-[rgba(19,2,2,0.62)]">
          {label}
        </Label>
        {hint ? <span className="text-xs text-[rgba(19,2,2,0.46)]">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function FeedbackBanner({
  kind,
  children,
}: {
  kind: 'success' | 'error';
  children: ReactNode;
}) {
  return (
    <Alert
      variant={kind === 'error' ? 'destructive' : 'default'}
      className={cn(
        'mb-5 rounded-lg',
        kind === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-950',
      )}
    >
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

export function EmptyState({
  title,
  description,
  icon: Icon = CircleDashed,
  action,
}: EmptyStateProps) {
  return (
    <SurfaceCard className="border-dashed bg-white/58">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[var(--padel-red)]/8 text-[var(--padel-red)]">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-semibold text-[var(--padel-ink)]">{title}</h3>
            {description ? <p className="mt-1 text-sm leading-6 text-[rgba(19,2,2,0.58)]">{description}</p> : null}
          </div>
        </div>
        {action}
      </CardContent>
    </SurfaceCard>
  );
}

export function RegistrationStatusBadge({
  status,
}: {
  status: 'PENDING' | 'APPROVED' | 'DECLINED';
}) {
  if (status === 'APPROVED') {
    return <Badge className="border-transparent bg-emerald-700 text-white">Approved</Badge>;
  }

  if (status === 'DECLINED') {
    return <Badge variant="destructive">Declined</Badge>;
  }

  return <Badge className="border-[var(--padel-gold)]/40 bg-[var(--padel-gold)]/18 text-[var(--padel-red)]">Pending</Badge>;
}
