'use client';

import Link from 'next/link';
import { ArrowRight, ShieldCheck, TriangleAlert } from 'lucide-react';
import { SurfaceCard } from '@/components/shared/dashboard/DashboardUI';
import { fillTemplate } from '@/lib/i18n/tournament';
import type { PlatformStats } from '@/types/adminStats';
import { collectWatchSignals, type StatsCopy } from './statsModel';
import styles from './AdminStats.module.css';

/**
 * The first thing on the statistics screen, because it is the only part of it
 * that asks for an action.
 *
 * Eight counts across three domains mean "someone has to do something", and
 * before this they were scattered over three tabs where each one was a single
 * amber line among a dozen neutral ones. Here they are one strip: either it is
 * empty and the platform is healthy, or every stuck queue is on screen at once
 * with its size and a way in.
 */
export function StatsWatchList({ stats, copy }: { stats: PlatformStats; copy: StatsCopy }) {
  const text = copy.watch;
  const signals = collectWatchSignals(stats, text);

  if (signals.length === 0) {
    return (
      <SurfaceCard className={styles.watch} data-state="clear">
        <div className={styles.watchHead}>
          <span className={styles.watchIcon}>
            <ShieldCheck aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className={styles.watchTitle}>{text.allClear}</p>
            <p className={styles.watchDetail}>{text.allClearDetail}</p>
          </div>
        </div>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard className={styles.watch} data-state="alert">
      <div className={styles.watchHead}>
        <span className={styles.watchIcon}>
          <TriangleAlert aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className={styles.watchTitle}>{text.title}</p>
          <p className={styles.watchDetail}>{text.description}</p>
        </div>
        <span className={styles.watchCount}>
          {fillTemplate(text.count, { count: signals.length })}
        </span>
      </div>

      <div className={styles.signals}>
        {signals.map((signal) => {
          // The number is announced with its label, so a screen reader never
          // reads a bare "7" and has to guess what it counted.
          const body = (
            <>
              <span className={styles.signalCount}>{signal.count}</span>
              <span className={styles.signalLabel}>{signal.label}</span>
              {signal.href ? (
                <span className={styles.signalGo}>
                  {text.open}
                  <ArrowRight aria-hidden="true" />
                </span>
              ) : null}
            </>
          );

          return signal.href ? (
            <Link key={signal.key} href={signal.href} className={styles.signal}>
              {body}
            </Link>
          ) : (
            <div key={signal.key} className={styles.signal}>
              {body}
            </div>
          );
        })}
      </div>
    </SurfaceCard>
  );
}
