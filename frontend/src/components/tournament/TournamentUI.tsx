'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft, Check, Circle, LoaderCircle, TriangleAlert } from 'lucide-react';
import { Notice, type NoticeTone } from '@/components/shared/dashboard/Feedback';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import styles from './TournamentUI.module.css';

export function TournamentPanel({ children, className, labelledBy }: { children: ReactNode; className?: string; labelledBy?: string }) {
  return (
    <section aria-labelledby={labelledBy} className={cn(styles.panel, className)}>
      {children}
    </section>
  );
}

export function TournamentSectionHeader({ id, title, description, actions }: { id?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className={styles.sectionHeader}>
      <div className="min-w-0">
        <h2 id={id} className={styles.sectionTitle}>{title}</h2>
        {description ? <p className={styles.sectionDescription}>{description}</p> : null}
      </div>
      {actions ? <div className={styles.sectionActions}>{actions}</div> : null}
    </div>
  );
}

export function StatusLabel({ children, icon = 'dot' }: { children: ReactNode; icon?: 'dot' | 'check' | 'warning' }) {
  const Icon = icon === 'check' ? Check : icon === 'warning' ? TriangleAlert : Circle;
  const label = typeof children === 'string' ? children.toLowerCase() : '';
  const tone = icon === 'warning' || /cancel|declin|refus|reject|conflict/.test(label)
    ? 'danger'
    : icon === 'check' || /complete|approve|publish|accept|ready/.test(label)
      ? 'success'
      : /progress|ongoing|open/.test(label)
        ? 'info'
        : 'neutral';
  return (
    <span className={styles.statusLabel} data-tone={tone}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}

export function KeyValueGrid({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className={styles.keyValueGrid}>
      {items.map((item) => (
        <div key={item.label} className={styles.keyValueItem}>
          <dt className={styles.keyValueLabel}>{item.label}</dt>
          <dd className={styles.keyValueValue}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EmptyTournamentState({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptyIcon}><Circle aria-hidden="true" /></span>
      <p className={styles.emptyTitle}>{title}</p>
      {detail ? <p className={styles.emptyDetail}>{detail}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

/**
 * Thin wrapper over the shared `Notice` so tournament screens and dashboard
 * screens report the same tone the same way. Kept as its own name because it is
 * used across a lot of call sites that read better with `kind`.
 */
export function InlineNotice({
  children,
  kind = 'info',
  title,
  onDismiss,
}: {
  children: ReactNode;
  kind?: NoticeTone;
  title?: string;
  onDismiss?: () => void;
}) {
  return (
    <Notice tone={kind} title={title} onDismiss={onDismiss}>
      {children}
    </Notice>
  );
}

export function CommandButton({ busy, children, className, tone = 'default', ...props }: ButtonProps & { busy?: boolean; tone?: 'default' | 'primary' | 'danger' }) {
  return (
    <Button {...props} data-tone={tone} disabled={busy || props.disabled} variant={props.variant ?? 'outline'} className={cn(styles.commandButton, className)}>
      {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
      {children}
    </Button>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={styles.backLink}>
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {children}
    </Link>
  );
}

export function ResponsiveDataList({ headers, rows }: { headers: string[]; rows: Array<{ id: string; cells: ReactNode[] }> }) {
  return (
    <div className={styles.dataList}>
      <table>
        <thead>
          <tr>
            {headers.map((header) => <th key={header}>{header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {row.cells.map((cell, index) => <td key={`${row.id}-${headers[index]}`} data-label={headers[index]}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
