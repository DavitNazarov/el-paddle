'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Bell, CheckCircle2, ChevronDown, CircleDashed, PanelLeftClose, PanelLeftOpen, XCircle } from 'lucide-react';
import { motion, useReducedMotion, useScroll, useSpring } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { useI18n } from '@/components/shared/I18nProvider';
import { DashboardStyles } from './DashboardStyles';

type ProfileItem = {
  label: string;
  href?: string;
  icon?: LucideIcon;
  onClick?: () => void;
  danger?: boolean;
};

type DashboardShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  headerBell?: { href: string; label: string; unread?: number };
  profile?: { name?: string; email?: string; items: ProfileItem[] };
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
  badge?: number;
  compact?: boolean;
};

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  id?: string;
};

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
};

type DashboardModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
  className?: string;
};

type SurfaceCardProps = {
  className?: string;
  children?: ReactNode;
  featured?: boolean;
  interactive?: boolean;
} & React.HTMLAttributes<HTMLDivElement>;

export const formControlClassName =
  'dashboard-form-control min-h-11 min-w-0 border-[var(--dash-border)] bg-white text-[var(--dash-text)] placeholder:text-[var(--dash-faint)] focus-visible:ring-[var(--padel-focus-ring)]';

export const selectControlClassName = cn(
  formControlClassName,
  'h-11 w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50',
);

export const softButtonClassName = 'dash-soft-btn border';

/** Outline control for parchment dialogs / light surfaces */
export const modalSoftButtonClassName =
  'dashboard-modal-soft-button border-[#e0d4d0] bg-white text-[#2a1f1e] hover:border-[#c6b5b0] hover:bg-[#f7ede9] hover:text-[#2a1f1e] focus-visible:ring-[#a4161a]/35';

function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.2 });
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;
  return <motion.div className="dash-progress" style={{ scaleX }} />;
}

function HeaderBell({ href, label, unread = 0 }: { href: string; label: string; unread?: number }) {
  return (
    <Link
      href={href}
      aria-label={unread > 0 ? `${label} (${unread})` : label}
      title={label}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--dash-border)] bg-white text-[var(--dash-muted)] transition-colors hover:border-[var(--dash-border-strong)] hover:text-[var(--dash-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-focus-ring)]"
    >
      <Bell className="h-4 w-4" />
      {unread > 0 ? (
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--dash-coral)] ring-2 ring-white" aria-hidden />
      ) : null}
    </Link>
  );
}

function ProfileMenu({ name, email, items }: { name?: string; email?: string; items: ProfileItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const initial = (name?.trim()?.charAt(0) ?? 'U').toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[var(--dash-border)] bg-white pl-1 pr-2 text-[var(--dash-text)] transition-colors hover:border-[var(--dash-border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-focus-ring)]"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--dash-primary)] font-display text-sm font-semibold text-white">
          {initial}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-[var(--dash-faint)]" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-56 rounded-lg border border-[var(--dash-border)] bg-white p-1.5 shadow-[0_12px_32px_rgba(43,26,24,0.14)]"
        >
          {name || email ? (
            <div className="border-b border-[var(--dash-border)] px-2.5 pb-2 pt-1.5">
              {name ? <p className="truncate text-sm font-medium text-[var(--dash-text)]">{name}</p> : null}
              {email ? <p className="truncate text-xs text-[var(--dash-muted)]">{email}</p> : null}
            </div>
          ) : null}
          <div className="grid gap-0.5 pt-1">
            {items.map((item, index) => {
              const Icon = item.icon;
              const itemClass = cn(
                'flex min-h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors',
                item.danger
                  ? 'text-[var(--dash-coral)] hover:bg-[var(--dash-coral-soft)]'
                  : 'text-[var(--dash-text)] hover:bg-[var(--dash-tint)]',
              );
              return item.href ? (
                <Link key={index} href={item.href} role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
                  {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
                  {item.label}
                </Link>
              ) : (
                <button
                  key={index}
                  type="button"
                  role="menuitem"
                  className={itemClass}
                  onClick={() => {
                    setOpen(false);
                    item.onClick?.();
                  }}
                >
                  {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function DashboardShell({
  eyebrow,
  title,
  description,
  actions,
  headerBell,
  profile,
  sidebarTitle = 'El Padel',
  sidebarSubtitle = 'Tournament operations',
  sidebarContent,
  sidebarFooter,
  mobileNavigation,
  children,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const hasSidebar = Boolean(sidebarContent || sidebarFooter);
  const { t } = useI18n();
  const sidebarToggleLabel = sidebarOpen ? t('dashboard.shell.collapse') : t('dashboard.shell.expand');
  const reduceMotion = useReducedMotion();

  return (
    <main className="dash-app">
      <DashboardStyles />
      <ScrollProgress />
      <div
        className={cn(
          'grid min-h-dvh transition-[grid-template-columns] duration-300 ease-out',
          hasSidebar && sidebarOpen && 'lg:grid-cols-[17rem_1fr]',
          hasSidebar && !sidebarOpen && 'lg:grid-cols-[4.75rem_1fr]',
          !hasSidebar && 'lg:grid-cols-1',
        )}
      >
        {hasSidebar ? (
          <aside
            className={cn(
              'dash-sidebar hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col',
              !sidebarOpen && 'items-center',
            )}
          >
            <div
              className={cn(
                'flex w-full items-center gap-3 border-b border-[var(--dash-border)] py-5',
                sidebarOpen ? 'justify-between px-5' : 'justify-center px-3',
              )}
            >
              {sidebarOpen ? (
                <div className="min-w-0">
                  <Link href="/" className="font-display text-xl font-semibold tracking-normal text-[var(--dash-text)]">
                    {sidebarTitle}
                  </Link>
                  <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--dash-faint)]">
                    {sidebarSubtitle}
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
                className="h-9 w-9 shrink-0 rounded-md text-[var(--dash-text)] hover:bg-[var(--dash-tint)] hover:text-[var(--dash-text)] focus-visible:ring-1 focus-visible:ring-[var(--dash-border-strong)] focus-visible:ring-offset-0"
              >
                {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
              </Button>
            </div>
            {sidebarContent ? (
              <nav
                aria-label={sidebarSubtitle}
                className={cn(
                  'flex-1 overflow-y-auto py-4',
                  sidebarOpen
                    ? 'w-full px-3'
                    : 'w-full px-2 [&_.dash-sidebar-label]:sr-only [&_.dash-sidebar-link]:justify-center [&_.dash-nav-badge]:absolute [&_.dash-nav-badge]:-right-0.5 [&_.dash-nav-badge]:-top-0.5',
                )}
              >
                {sidebarContent}
              </nav>
            ) : null}
            {sidebarFooter && sidebarOpen ? <div className="w-full border-t border-[var(--dash-border)] p-4">{sidebarFooter}</div> : null}
          </aside>
        ) : null}

        <section className="min-w-0">
          <header className="dash-header sticky top-0 z-20">
            <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <motion.div
                  className="min-w-0"
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                >
                  <p className="dash-kicker">{eyebrow}</p>
                  <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-normal text-[var(--dash-text)] sm:text-[1.75rem]">
                    {title}
                  </h1>
                  <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--dash-muted)] sm:line-clamp-none line-clamp-2">
                    {description}
                  </p>
                </motion.div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <LanguageSwitcher
                    tone="light"
                    className="border-[var(--dash-border)] bg-white shadow-[0_1px_2px_rgba(43,26,24,0.04)]"
                  />
                  {headerBell ? <HeaderBell {...headerBell} /> : null}
                  {actions}
                  {profile ? <ProfileMenu {...profile} /> : null}
                </div>
              </div>
              {mobileNavigation ? <div className="mt-3 lg:hidden">{mobileNavigation}</div> : null}
            </div>
          </header>

          <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8">{children}</div>
        </section>
      </div>
    </main>
  );
}

export function SidebarLink({ href, icon: Icon, label, active = false, badge, compact = false }: SidebarLinkProps) {
  return (
    <Link
      href={href}
      title={label}
      aria-current={active ? 'page' : undefined}
      data-active={active}
      className={cn('dash-sidebar-link', compact && 'justify-center px-2')}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="dash-sidebar-label truncate">{label}</span>
      {typeof badge === 'number' && badge > 0 ? <span className="dash-nav-badge">{badge}</span> : null}
    </Link>
  );
}

export function SurfaceCard({ className, children, featured = false, interactive = false, ...props }: SurfaceCardProps) {
  return (
    <div
      className={cn(
        'dash-glass',
        featured && 'dash-glass--featured',
        interactive && 'cursor-pointer',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  actions,
  className,
  id,
}: SectionHeadingProps) {
  return (
    <div id={id} className={cn('flex scroll-mt-28 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div>
        {eyebrow ? <p className="dash-kicker">{eyebrow}</p> : null}
        <h2 className={cn('text-lg font-semibold tracking-normal text-[var(--dash-text)]', eyebrow ? 'mt-1.5' : '')}>
          {title}
        </h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-5 text-[var(--dash-muted)]">{description}</p>
        ) : null}
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
    <div className="dash-field min-w-0 space-y-2">
      <Label htmlFor={id} className="dashboard-field-label block text-xs font-semibold uppercase leading-5 tracking-[0.16em] text-[#6d5f5c]">
        {label}
      </Label>
      {children}
      {hint ? <p className="dashboard-field-hint text-xs leading-5 text-[#7a6c69]">{hint}</p> : null}
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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [children, kind]);

  return (
    <Alert
      ref={ref}
      variant={kind === 'error' ? 'destructive' : 'default'}
      className={cn(
        'mb-5 rounded-xl border',
        kind === 'success' &&
          'border-[rgba(22,128,106,0.28)] bg-[var(--dash-teal-soft)] text-[var(--dash-teal)]',
        kind === 'error' &&
          'border-[rgba(194,65,59,0.28)] bg-[var(--dash-coral-soft)] text-[var(--dash-coral)]',
      )}
    >
      <div className="flex items-start gap-3">
        {kind === 'success' ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--dash-teal)]" />
        ) : (
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--dash-coral)]" />
        )}
        <AlertDescription className="text-inherit">{children}</AlertDescription>
      </div>
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
    <SurfaceCard className="border-dashed border-[var(--dash-border)] bg-[var(--dash-tint)]">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="dash-empty-icon">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-semibold text-[var(--dash-text)]">{title}</h3>
            {description ? (
              <p className="mt-1 text-sm leading-6 text-[var(--dash-muted)]">{description}</p>
            ) : null}
          </div>
        </div>
        {action}
      </div>
    </SurfaceCard>
  );
}

export function FilterChip({
  active,
  count,
  children,
  onClick,
}: {
  active?: boolean;
  count?: number;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} data-active={active} className="dash-chip">
      <span>{children}</span>
      {typeof count === 'number' ? <span className="dash-chip__count">{count}</span> : null}
    </button>
  );
}

export function DashboardModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'lg',
  className,
}: DashboardModalProps) {
  const sizeClass = size === 'xl' ? 'sm:max-w-4xl' : size === 'md' ? 'sm:max-w-lg' : 'sm:max-w-2xl';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(sizeClass, className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="dashboard-dialog-scroll min-h-0 flex-1 overscroll-contain overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {children}
        </div>
        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}

export function RegistrationStatusBadge({
  status,
}: {
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'NEEDS_CHANGES' | 'WAITLISTED' | 'WITHDRAWN' | 'CANCELLED';
}) {
  const { t } = useI18n();
  const translated = status === 'APPROVED' || status === 'DECLINED' || status === 'PENDING'
    ? t(`dashboard.status.${status}`)
    : status.replaceAll('_', ' ');
  return (
    <Badge className={cn('dash-status', `dash-status--${status.toLowerCase().replaceAll('_', '-')}`)}>
      {translated}
    </Badge>
  );
}

export function Metric({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}) {
  return (
    <div className="dash-metric" data-tone={tone}>
      <p className="dash-metric__label">{label}</p>
      <p className="dash-metric__value">{value}</p>
      {hint ? <p className="text-xs text-[var(--dash-faint)]">{hint}</p> : null}
    </div>
  );
}

export function AttentionRow({
  title,
  detail,
  action,
  urgent = false,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
  urgent?: boolean;
}) {
  return (
    <div className="dash-attention">
      <span className={cn('dash-attention__dot', urgent && 'dash-attention__dot--urgent')} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--dash-text)]">{title}</p>
        {detail ? <p className="mt-0.5 text-xs leading-5 text-[var(--dash-muted)]">{detail}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function MetaRow({
  icon: Icon,
  children,
  className,
}: {
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm text-[var(--dash-muted)]', className)}>
      <Icon className="h-4 w-4 shrink-0 text-[var(--dash-faint)]" />
      {children}
    </span>
  );
}
