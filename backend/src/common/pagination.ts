/**
 * Shared cursor-pagination helpers for list endpoints (M-2). These bound the
 * worst-case rows / DB cost of "list everything" queries and expose an opt-in
 * `limit` + `cursor` protocol. The default page size is generous so existing
 * non-paginating clients keep receiving full result sets for realistic volumes,
 * while pathological unbounded scans are prevented by the hard cap.
 */
export const MAX_PAGE_SIZE = 500;
export const DEFAULT_PAGE_SIZE = 500;

export type ListRange = { limit?: number; cursor?: string };

/** Clamp a requested page size into [1, MAX_PAGE_SIZE], falling back to the default. */
export function clampPageSize(limit?: number) {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_PAGE_SIZE);
}

/** Parse `limit` / `cursor` from an Express query object into a typed range. */
export function parseListRange(query: {
  limit?: unknown;
  cursor?: unknown;
}): ListRange {
  const limitRaw = Number(query.limit);
  return {
    limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
    cursor: typeof query.cursor === 'string' && query.cursor ? query.cursor : undefined,
  };
}

/**
 * Build the Prisma `take`/`cursor`/`skip` fragment for an id-keyed cursor scan.
 * Requests one extra row so callers can tell whether another page exists.
 */
export function cursorArgs(range: ListRange) {
  const pageSize = clampPageSize(range.limit);
  return {
    pageSize,
    take: pageSize + 1,
    ...(range.cursor ? { cursor: { id: range.cursor }, skip: 1 } : {}),
  };
}

/**
 * Trim the extra look-ahead row and return the page plus a `nextCursor`
 * (the last item's id when more rows exist, otherwise null).
 */
export function toPage<T extends { id: string }>(rows: T[], pageSize: number) {
  const hasMore = rows.length > pageSize;
  const items = hasMore ? rows.slice(0, pageSize) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1]!.id : null };
}
