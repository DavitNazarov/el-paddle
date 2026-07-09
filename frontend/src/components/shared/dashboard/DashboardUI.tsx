'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CheckCircle2, CircleDashed, PanelLeftClose, PanelLeftOpen, XCircle } from 'lucide-react';
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
import { Reveal } from '@/components/padel/home/motion';
import { DashboardStyles } from './DashboardStyles';

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
  badge?: number;
  compact?: boolean;
};

type StatCardProps = {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  description?: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
  onClick?: () => void;
  delay?: number;
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
  'min-h-11 border-[rgba(19,2,2,0.14)] bg-white text-[var(--padel-ink)] placeholder:text-[rgba(19,2,2,0.42)] focus-visible:ring-[var(--padel-focus-ring)]';

export const selectControlClassName = cn(
  formControlClassName,
  'h-11 w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50',
);

export const softButtonClassName = 'dash-soft-btn border';

/** Outline control for parchment dialogs / light surfaces */
export const modalSoftButtonClassName =
  'border-[rgba(19,2,2,0.12)] bg-white text-[var(--padel-ink)] hover:bg-[#f7efe3]';

export const sidebarTabTriggerClassName =
  'dash-sidebar-link justify-start focus-visible:ring-1 focus-visible:ring-[rgba(231,194,93,0.46)] focus-visible:ring-offset-0';

export const mobileTabTriggerClassName =
  'dash-mobile-link min-h-11 flex-1 flex-col gap-1 rounded-full px-2 py-2 text-[11px] font-semibold leading-tight sm:flex-row sm:gap-2 sm:px-3 sm:text-sm';

function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.2 });
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;
  return <motion.div className="dash-progress" style={{ scaleX }} />;
}

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
                'flex w-full items-center gap-3 border-b border-white/10 py-5',
                sidebarOpen ? 'justify-between px-5' : 'justify-center px-3',
              )}
            >
              {sidebarOpen ? (
                <div className="min-w-0">
                  <Link href="/" className="font-display text-xl font-semibold tracking-normal text-[var(--padel-ivory)]">
                    {sidebarTitle}
                  </Link>
                  <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgba(246,239,225,0.42)]">
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
                className="h-9 w-9 shrink-0 rounded-md text-[var(--padel-ivory)] hover:bg-white/10 hover:text-[var(--padel-ivory)] focus-visible:ring-1 focus-visible:ring-[rgba(231,194,93,0.4)] focus-visible:ring-offset-0"
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
            {sidebarFooter && sidebarOpen ? <div className="w-full border-t border-white/10 p-4">{sidebarFooter}</div> : null}
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
                  <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-normal text-[var(--padel-ivory)] sm:text-[1.75rem]">
                    {title}
                  </h1>
                  <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[rgba(246,239,225,0.5)] sm:line-clamp-none line-clamp-2">
                    {description}
                  </p>
                </motion.div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <LanguageSwitcher tone="dark" />
                  {actions}
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

export function StatCard({
  label,
  value,
  icon: Icon,
  description,
  tone = 'neutral',
  onClick,
  delay = 0,
}: StatCardProps) {
  const toneClass = {
    neutral: 'bg-[rgba(246,239,225,0.08)] text-[rgba(246,239,225,0.7)]',
    success: 'bg-emerald-500/15 text-emerald-300',
    warning: 'bg-[rgba(224,196,119,0.12)] text-[var(--padel-gold)]',
    danger: 'bg-[rgba(224,52,43,0.12)] text-[#f07169]',
  }[tone];

  const content = (
    <div className="dash-stat relative p-4">
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="dash-metric__label">{label}</p>
          <p className="dash-metric__value mt-2">{value}</p>
        </div>
        {Icon ? (
          <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-md', toneClass)}>
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      {description ? (
        <p className="relative mt-3 text-sm leading-5 text-[rgba(246,239,225,0.48)]">{description}</p>
      ) : null}
    </div>
  );

  const card = onClick ? (
    <SurfaceCard interactive className="overflow-hidden">
      <button
        type="button"
        onClick={onClick}
        className="w-full rounded-[inherit] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-focus-ring)]"
      >
        {content}
      </button>
    </SurfaceCard>
  ) : (
    <SurfaceCard className="overflow-hidden">{content}</SurfaceCard>
  );

  return (
    <Reveal delay={delay} className="h-full">
      {card}
    </Reveal>
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
        <h2 className={cn('text-lg font-semibold tracking-normal text-[var(--padel-ivory)]', eyebrow ? 'mt-1.5' : '')}>
          {title}
        </h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-5 text-[rgba(246,239,225,0.48)]">{description}</p>
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
    <div className="dash-field space-y-2">
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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [children, kind]);

  return (
    <Alert
      ref={ref}
      variant={kind === 'error' ? 'destructive' : 'default'}
      className={cn(
        'mb-5 rounded-xl border backdrop-blur-md',
        kind === 'success' && 'border-emerald-400/30 bg-emerald-950/40 text-emerald-100',
        kind === 'error' && 'border-red-400/30 bg-red-950/45 text-red-100',
      )}
    >
      <div className="flex items-start gap-3">
        {kind === 'success' ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
        ) : (
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
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
    <SurfaceCard className="border-dashed border-[rgba(246,239,225,0.18)] bg-[rgba(246,239,225,0.03)]">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="dash-empty-icon">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-semibold text-[var(--padel-ivory)]">{title}</h3>
            {description ? (
              <p className="mt-1 text-sm leading-6 text-[rgba(246,239,225,0.55)]">{description}</p>
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
  const sizeClass = size === 'xl' ? 'max-w-3xl' : size === 'md' ? 'max-w-lg' : 'max-w-2xl';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(sizeClass, className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}

export function RegistrationStatusBadge({
  status,
}: {
  status: 'PENDING' | 'APPROVED' | 'DECLINED';
}) {
  const { t } = useI18n();

  if (status === 'APPROVED') {
    return (
      <Badge className="border-emerald-400/25 bg-emerald-500/10 text-emerald-300">
        {t('dashboard.status.APPROVED')}
      </Badge>
    );
  }

  if (status === 'DECLINED') {
    return (
      <Badge className="border-red-400/25 bg-red-500/10 text-red-300">
        {t('dashboard.status.DECLINED')}
      </Badge>
    );
  }

  return (
    <Badge className="border-[rgba(246,239,225,0.18)] bg-[rgba(246,239,225,0.06)] text-[rgba(246,239,225,0.75)]">
      {t('dashboard.status.PENDING')}
    </Badge>
  );
}

export function PremiumButton({
  className,
  dark = false,
  ...props
}: React.ComponentPropsWithoutRef<typeof Button> & { dark?: boolean }) {
  return <Button className={cn(className)} {...props} />;
}

export function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="dash-metric">
      <p className="dash-metric__label">{label}</p>
      <p className="dash-metric__value">{value}</p>
      {hint ? <p className="text-xs text-[rgba(246,239,225,0.42)]">{hint}</p> : null}
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
        <p className="text-sm font-medium text-[var(--padel-ivory)]">{title}</p>
        {detail ? <p className="mt-0.5 text-xs leading-5 text-[rgba(246,239,225,0.48)]">{detail}</p> : null}
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
    <span className={cn('inline-flex items-center gap-2 text-sm text-[rgba(246,239,225,0.58)]', className)}>
      <Icon className="h-4 w-4 shrink-0 text-[rgba(246,239,225,0.4)]" />
      {children}
    </span>
  );
}
