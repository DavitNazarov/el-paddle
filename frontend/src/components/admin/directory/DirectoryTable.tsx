'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { DataTable, EmptyState } from '@/components/shared/dashboard/DashboardUI';
import { SkeletonRows } from '@/components/shared/dashboard/Feedback';

/**
 * Row actions have to clear the 44px touch target. The shared `sm` button is
 * 36px, so every directory action opts back up rather than each screen
 * remembering to.
 */
export const rowActionClassName = 'min-h-11 rounded-md';

type Column<T> = {
  key: string;
  header: string;
  width?: string;
  cell: (row: T) => ReactNode;
};

/**
 * The listing half of a directory: shaped loading, an empty state that knows
 * *why* it is empty, and otherwise the shared table. Keeping the three states in
 * one place is what stops each screen inventing its own — the old screens used a
 * card that said the word "Loading", which the design rules forbid.
 */
export function DirectoryTable<T>({
  loading,
  rows,
  total,
  icon,
  columns,
  rowKey,
  rowAttention,
  renderActions,
  actionsHeader,
  actionsWidth,
  minWidthClassName,
  loadingLabel,
  empty,
  noMatches,
}: {
  loading: boolean;
  /** Rows after filtering. */
  rows: T[];
  /** Rows before filtering, so an empty result can tell the two cases apart. */
  total: number;
  icon: LucideIcon;
  columns: Column<T>[];
  rowKey: (row: T) => string;
  rowAttention?: (row: T) => boolean;
  renderActions?: (row: T) => ReactNode;
  actionsHeader?: string;
  actionsWidth?: string;
  minWidthClassName?: string;
  loadingLabel: string;
  empty: { title: string; description: string; action?: ReactNode };
  noMatches: { title: string; description: string; action?: ReactNode };
}) {
  if (loading) return <SkeletonRows rows={5} label={loadingLabel} />;

  if (!rows.length) {
    // Nothing at all is a different problem from nothing matching a filter.
    const state = total ? noMatches : empty;
    return <EmptyState title={state.title} description={state.description} icon={icon} action={state.action} />;
  }

  return (
    <DataTable
      rows={rows}
      rowKey={rowKey}
      columns={columns}
      rowAttention={rowAttention}
      renderActions={renderActions}
      actionsHeader={actionsHeader}
      {...(actionsWidth ? { actionsWidth } : {})}
      {...(minWidthClassName ? { minWidthClassName } : {})}
    />
  );
}
