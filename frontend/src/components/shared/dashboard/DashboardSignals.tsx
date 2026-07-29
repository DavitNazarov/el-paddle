'use client';

import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, ArrowUpRight, Check, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import styles from './DashboardSignals.module.css';

export type RailState = 'done' | 'current' | 'upcoming';

export type RailStep = {
  key: string;
  label: string;
  /** Short caption under the current step, e.g. "Current stage". */
  note?: string;
  state: RailState;
};

/**
 * A fixed sequence drawn as a rail. Anywhere a role moves through ordered
 * stages — an event lifecycle, an entry's approval path, a court queue — the
 * whole sequence is more useful than the current position alone, because it
 * shows what "next" actually leads to.
 */
export function StageRail({ steps, className }: { steps: RailStep[]; className?: string }) {
  return (
    <ol className={cn(styles.rail, className)} style={{ '--rail-steps': steps.length } as CSSProperties}>
      {steps.map((step) => (
        <li key={step.key} className={styles.railStep} data-state={step.state}>
          <span className={styles.railDot}>{step.state === 'done' ? <Check aria-hidden="true" /> : null}</span>
          <div className="min-w-0">
            <p className={styles.railLabel}>{step.label}</p>
            {step.note ? <p className={styles.railNote}>{step.note}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * The rail compressed into a list row: the same sequence, reduced to dots plus
 * the stage's own name. The name is the signal; the dots only say how far along
 * that name sits, so the indicator still reads without colour.
 */
export function StageDots({ states, label, srLabel }: { states: RailState[]; label: string; srLabel: string }) {
  return (
    <span className={styles.dots}>
      <span className="sr-only">{srLabel}</span>
      {states.map((state, index) => (
        <span key={index} className={styles.dot} data-state={state} aria-hidden="true" />
      ))}
      <span className={styles.dotsLabel} aria-hidden="true">{label}</span>
    </span>
  );
}

export type SignalCardProps = {
  href: string;
  icon: LucideIcon;
  title: string;
  detail?: string;
  /** Ordinal shown top-right, e.g. "01". */
  index?: string;
  /**
   * The card's live workload. `null` means it has not arrived yet — the card
   * renders `loadingLabel` rather than an invented zero.
   */
  signal?: string | null;
  loadingLabel?: string;
  /** Dims the signal when it is a "nothing here yet" reading. */
  quiet?: boolean;
  /** Label for the amber flag; omitted when nothing needs a decision. */
  attention?: string;
  /** Marks the card the role is currently being asked to work in. */
  focus?: boolean;
};

/**
 * A destination that states its own workload. A bare navigation tile tells the
 * reader nothing about whether that screen still needs them, which is the only
 * question a role home exists to answer.
 */
export function SignalCard({
  href,
  icon: Icon,
  title,
  detail,
  index,
  signal,
  loadingLabel = '',
  quiet = false,
  attention,
  focus = false,
}: SignalCardProps) {
  return (
    <Link href={href} className={styles.signalCard} data-focus={focus}>
      <div className={styles.signalHead}>
        <span className={styles.signalIcon}>
          <Icon aria-hidden="true" />
        </span>
        {index ? <span className={styles.signalIndex}>{index}</span> : null}
      </div>
      <div className="min-w-0">
        <h3 className={styles.signalTitle}>{title}</h3>
        {detail ? <p className={styles.signalDetail}>{detail}</p> : null}
        {attention ? (
          <span className={styles.flag}>
            <TriangleAlert aria-hidden="true" />
            {attention}
          </span>
        ) : null}
      </div>
      <div className={styles.signalFoot}>
        <span className={styles.signalValue} data-muted={signal === null || quiet}>
          {signal ?? loadingLabel}
        </span>
        <ArrowRight className={styles.signalArrow} aria-hidden="true" />
      </div>
    </Link>
  );
}

export function SignalGrid({ columns = 4, children }: { columns?: 3 | 4; children: ReactNode }) {
  return (
    <div className={styles.signalGrid} data-columns={columns}>
      {children}
    </div>
  );
}

/**
 * One controllable surface per line: what it is, whether it is live, and the
 * control — or a link to wherever that control actually lives.
 */
export function StateRow({
  icon: Icon,
  label,
  hint,
  live,
  state,
  actions,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  live: boolean;
  state: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <li className={styles.stateRow}>
      <span className={styles.stateIcon} data-live={live}>
        <Icon aria-hidden="true" />
      </span>
      <div className={styles.stateText}>
        <p className={styles.stateLabel}>{label}</p>
        {hint ? <p className={styles.stateHint}>{hint}</p> : null}
      </div>
      <div className={styles.stateActions}>
        <span className={styles.stateChip}>{state}</span>
        {actions}
      </div>
    </li>
  );
}

/** Outline link sized to the 44px touch target, for "the switch lives here". */
export function ManageLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={styles.manageLink}>
      {children}
      <ArrowUpRight aria-hidden="true" />
    </Link>
  );
}

/**
 * Progress through a finite queue. The bar is the glance; the numbers beside it
 * carry the same fact for anyone the bar does not reach.
 */
export function QueueMeter({
  label,
  done,
  total,
  valueLabel,
}: {
  label: string;
  done: number;
  total: number;
  valueLabel: string;
}) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className={styles.meter}>
      <div className={styles.meterHead}>
        <p className={styles.meterLabel}>{label}</p>
        <p className={styles.meterValue}>{valueLabel}</p>
      </div>
      <div
        className={styles.meterTrack}
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={label}
      >
        <span className={styles.meterFill} data-complete={total > 0 && done >= total} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
