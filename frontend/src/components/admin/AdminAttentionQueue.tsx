'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { CheckCircle2, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AttentionRow,
  EmptyState,
  SectionHeading,
  softButtonClassName,
} from '@/components/shared/dashboard/DashboardUI';
import { SkeletonRows } from '@/components/shared/dashboard/Feedback';
import { cn } from '@/lib/utils';

/**
 * Note `icon` and `badge` hold React values, so an item list must be built in a
 * client component — it cannot be serialised across a server boundary. Both
 * callers are client components, and this matches how `SignalCard` and
 * `EmptyState` already take their icons.
 */
export type AttentionItem = {
  id: string;
  title: string;
  detail: string;
  /** Someone is on the other side waiting. Gets the amber spine. */
  urgent: boolean;
  actionLabel: string;
  href: string;
  icon?: LucideIcon;
  /** Rendered before the action, for a status the reader needs to see first. */
  badge?: ReactNode;
};

/**
 * Everything waiting on an administrator, in one list, most urgent first.
 *
 * These four kinds of work — pairings, entries, club requests, unpublished
 * events — used to sit in three separate places, one of them a bare number with
 * nothing to click. They are one job, so they are one queue: the reader asks
 * "what is waiting on me?" once and gets the whole answer.
 *
 * Prop-driven on purpose, so it can be previewed and tested without a session.
 */
export function AdminAttentionQueue({
  items,
  loading,
  title,
  description,
  emptyTitle,
  emptyDescription,
  loadingLabel,
  actions,
}: {
  items: AttentionItem[];
  loading: boolean;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  loadingLabel: string;
  actions?: ReactNode;
}) {
  return (
    <section>
      <SectionHeading title={title} description={description} actions={actions} />
      <div className="mt-3 grid gap-2">
        {/* Loading shows the shape of the rows that replace it, not a word. */}
        {loading ? <SkeletonRows rows={3} label={loadingLabel} /> : null}

        {!loading && items.length === 0 ? (
          <EmptyState title={emptyTitle} description={emptyDescription} icon={CheckCircle2} />
        ) : null}

        {!loading
          ? items.map((item) => {
              const Icon = item.icon;
              return (
                <AttentionRow
                  key={item.id}
                  urgent={item.urgent}
                  title={item.title}
                  detail={item.detail}
                  action={
                    <div className="flex items-center gap-2">
                      {item.badge}
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        // `size="sm"` is 36px; these are the primary actions on
                        // this screen and get tapped on a phone, so they take
                        // the 44px minimum.
                        className={cn(softButtonClassName, 'min-h-11 rounded-md')}
                      >
                        <Link href={item.href}>
                          {Icon ? <Icon className="h-4 w-4" /> : null}
                          {item.actionLabel}
                        </Link>
                      </Button>
                    </div>
                  }
                />
              );
            })
          : null}
      </div>
    </section>
  );
}
