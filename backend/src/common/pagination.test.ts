import { describe, expect, it } from 'vitest';
import {
  clampPageSize,
  cursorArgs,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  parseListRange,
  toPage,
} from './pagination.js';

describe('clampPageSize', () => {
  it('falls back to the default when unset or invalid', () => {
    expect(clampPageSize(undefined)).toBe(DEFAULT_PAGE_SIZE);
    expect(clampPageSize(Number.NaN)).toBe(DEFAULT_PAGE_SIZE);
  });

  it('clamps into [1, MAX_PAGE_SIZE]', () => {
    expect(clampPageSize(0)).toBe(1);
    expect(clampPageSize(10)).toBe(10);
    expect(clampPageSize(MAX_PAGE_SIZE + 1000)).toBe(MAX_PAGE_SIZE);
  });
});

describe('parseListRange', () => {
  it('extracts a numeric limit and string cursor', () => {
    expect(parseListRange({ limit: '25', cursor: 'abc' })).toEqual({ limit: 25, cursor: 'abc' });
  });

  it('drops empty/invalid values', () => {
    expect(parseListRange({ limit: 'nope', cursor: '' })).toEqual({ limit: undefined, cursor: undefined });
  });
});

describe('cursorArgs', () => {
  it('requests one extra row and no cursor on the first page', () => {
    expect(cursorArgs({ limit: 10 })).toEqual({ pageSize: 10, take: 11 });
  });

  it('adds cursor + skip when paging forward', () => {
    expect(cursorArgs({ limit: 10, cursor: 'x' })).toEqual({
      pageSize: 10,
      take: 11,
      cursor: { id: 'x' },
      skip: 1,
    });
  });
});

describe('toPage', () => {
  it('exposes nextCursor only when a look-ahead row is present', () => {
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(toPage(rows, 2)).toEqual({ items: [{ id: 'a' }, { id: 'b' }], nextCursor: 'b' });
  });

  it('returns null nextCursor on the last page', () => {
    const rows = [{ id: 'a' }, { id: 'b' }];
    expect(toPage(rows, 2)).toEqual({ items: [{ id: 'a' }, { id: 'b' }], nextCursor: null });
  });
});
