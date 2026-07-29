'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/shared/I18nProvider';
import styles from './Feedback.module.css';

export type NoticeTone = 'info' | 'success' | 'warning' | 'error';

const toneIcon = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  error: XCircle,
} as const;

/**
 * Errors and warnings are announced; successes and hints are not, so a saved
 * confirmation does not interrupt whatever a screen reader is reading.
 */
const toneRole = {
  info: 'status',
  success: 'status',
  warning: 'status',
  error: 'alert',
} as const;

/**
 * One message surface for every tone. The icon and the wording carry the
 * meaning; the colour only reinforces them, so the notice still reads on a
 * greyscale screen or to someone who cannot separate red from green.
 */
export function Notice({
  tone = 'info',
  title,
  children,
  actions,
  onDismiss,
  className,
}: {
  tone?: NoticeTone;
  title?: string;
  children?: ReactNode;
  actions?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  const Icon = toneIcon[tone];
  return (
    <div className={cn(styles.notice, className)} data-tone={tone} role={toneRole[tone]}>
      <span className={styles.noticeIcon}>
        <Icon aria-hidden="true" />
      </span>
      <div className={styles.noticeBody}>
        {title ? <p className={styles.noticeTitle}>{title}</p> : null}
        {children ? <p className={styles.noticeText}>{children}</p> : null}
        {actions ? <div className={styles.noticeActions}>{actions}</div> : null}
      </div>
      {onDismiss ? (
        <button type="button" className={styles.dismiss} onClick={onDismiss} aria-label={t('common.close')}>
          <X aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * The result of the last thing the user did, reported at the top of a screen.
 * It scrolls itself into view because the action that produced it is often
 * further down the page than the banner is.
 */
export function PageNotice({
  tone,
  title,
  children,
  onDismiss,
}: {
  tone: NoticeTone;
  title?: string;
  children: ReactNode;
  onDismiss?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [children, tone]);

  return (
    <div ref={ref}>
      <Notice tone={tone} title={title} className={styles.banner} onDismiss={onDismiss}>
        {children}
      </Notice>
    </div>
  );
}

/** A single shimmering placeholder block. */
export function Skeleton({ width, height = '0.75rem', className }: { width?: string; height?: string; className?: string }) {
  return <span className={cn(styles.skeleton, className)} style={{ width, height }} aria-hidden="true" />;
}

/**
 * Loading placeholders shaped like the rows that will replace them, so the
 * layout does not jump when the data lands. The whole block is one busy
 * region, announced once, rather than a dozen chattering placeholders.
 */
export function SkeletonRows({ rows = 4, label }: { rows?: number; label: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={styles.skeletonRow}>
          <Skeleton width="2rem" height="2rem" className="rounded-lg" />
          <span className={styles.skeletonRowText}>
            <Skeleton width={`${55 + ((index * 7) % 25)}%`} height="0.85rem" />
            <Skeleton width={`${30 + ((index * 11) % 20)}%`} height="0.7rem" />
          </span>
          <Skeleton width="5.5rem" height="1.75rem" className="rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 4, columns = 4, label }: { count?: number; columns?: 2 | 4; label: string }) {
  return (
    <div className={styles.skeletonCards} data-columns={columns} role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={styles.skeletonCard}>
          <Skeleton width="2.25rem" height="2.25rem" className="rounded-lg" />
          <Skeleton width="60%" height="0.95rem" />
          <Skeleton width="90%" height="0.7rem" />
          <Skeleton width="75%" height="0.7rem" />
          <Skeleton width="45%" height="0.7rem" className="mt-auto" />
        </div>
      ))}
    </div>
  );
}
