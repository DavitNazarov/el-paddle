// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { MatchDto } from '@/types/tournament';
import { I18nProvider } from '@/components/shared/I18nProvider';
import { MatchSheet, type MatchSheetHandlers } from './MatchSheet';
import type { ControlMatch } from './runBoard';

// `globals` is off in vitest.config.ts, so testing-library's automatic cleanup
// is never registered and renders would otherwise pile up across tests.
afterEach(cleanup);

// This jsdom build ships a `localStorage` stub without methods, which the locale
// provider reads on mount. One empty store is all these tests need from it.
beforeAll(() => {
  const store = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
      clear: () => store.clear(),
    },
  });
});

const entry = (owner: string, teammate: string) => ({
  id: `${owner}-entry`,
  owner: { id: owner, fullName: owner },
  teammate: { id: teammate, fullName: teammate },
});

const liveMatch = {
  id: 'm1',
  matchNumber: 3,
  round: 'SEMIFINAL',
  status: 'IN_PROGRESS',
  scoringMode: 'SETS',
  scoreA: 0,
  scoreB: 0,
  setCount: 2,
  setsToWin: 2,
  maxSets: 3,
  sets: [],
  version: 7,
  participantAEntryId: 'Ana-entry',
  participantBEntryId: 'Beka-entry',
  participantA: entry('Ana', 'Nino'),
  participantB: entry('Beka', 'Giorgi'),
  scheduleItem: { id: 's1', status: 'IN_PROGRESS', version: 1, queuePosition: 2, plannedStartAt: null, court: { id: 'c1', name: 'Court 1' } },
  snapshots: [],
} as unknown as MatchDto;

function control(match: MatchDto): ControlMatch {
  return {
    match,
    categoryId: 'cat1',
    categoryName: 'Men’s Open',
    court: { id: 'c1', name: 'Court 1' },
    item: match.scheduleItem ?? null,
    plannedStartAt: match.scheduleItem?.plannedStartAt ?? null,
    queuePosition: match.scheduleItem?.queuePosition ?? null,
    lateBy: null,
  };
}

function renderSheet(match: MatchDto = liveMatch, locked = false) {
  const handlers: MatchSheetHandlers = {
    onStart: vi.fn(),
    onRecordResult: vi.fn(),
    onFinish: vi.fn(),
    onSaveTime: vi.fn(),
  };
  render(
    <I18nProvider initialLocale="en">
      <MatchSheet
        busy=""
        entry={control(match)}
        eventId="e1"
        locked={locked}
        nextMatch={null}
        onClose={vi.fn()}
        {...handlers}
      />
    </I18nProvider>,
  );
  return handlers;
}

// By accessible name: the visible label is a bare score, which says nothing on
// its own about who won.
const option = (name: string) => screen.getByRole('button', { name });

describe('writing a result on a live match', () => {
  it('offers every result the match can end on, and states the format', () => {
    renderSheet();
    expect(screen.getByText('Best of 2 — pick the result.')).toBeInTheDocument();
    for (const name of ['Ana / Nino win 2–0', 'Ana / Nino win 2–1', 'Beka / Giorgi win 1–2', 'Beka / Giorgi win 0–2']) {
      expect(option(name)).toBeEnabled();
    }
  });

  it('offers nothing that does not finish the match', () => {
    renderSheet();
    // 1–1 and 2–2 decide nothing; 3–1 overshoots a race to two.
    expect(screen.queryByText('1–1')).not.toBeInTheDocument();
    expect(screen.queryByText('3–1')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /win \d–\d$/ })).toHaveLength(4);
  });

  it('follows the match’s own set format rather than a fixed list', () => {
    renderSheet({ ...liveMatch, setCount: 1, setsToWin: 1, maxSets: 1 } as MatchDto);
    expect(screen.getByText('Best of 1 — pick the result.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /win \d–\d$/ })).toHaveLength(2);
    expect(option('Ana / Nino win 1–0')).toBeEnabled();
  });

  it('hands the chosen tally over as two numbers', () => {
    const handlers = renderSheet();
    fireEvent.click(option('Beka / Giorgi win 1–2'));
    expect(handlers.onRecordResult).toHaveBeenCalledWith(liveMatch, 1, 2);
  });

  it('bars a result that would take back a set already recorded, and says why', () => {
    const played = { ...liveMatch, scoreA: 0, scoreB: 1, sets: [{ setNumber: 1, winnerSide: 'B' }] } as unknown as MatchDto;
    renderSheet(played);
    expect(option('Ana / Nino win 2–0')).toBeDisabled();
    expect(option('Beka / Giorgi win 0–2')).toBeEnabled();
    expect(screen.getByText(/taking a set back is a reopen, not a result/)).toBeInTheDocument();
  });

  it('offers no result at all until the match is running', () => {
    renderSheet({ ...liveMatch, status: 'READY', scheduleItem: { ...liveMatch.scheduleItem, status: 'READY' } } as MatchDto);
    expect(screen.queryByRole('button', { name: /win \d–\d$/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start match' })).toBeInTheDocument();
  });
});

describe('what the sheet says about where and when', () => {
  it('names the court and the place in the queue', () => {
    renderSheet();
    expect(screen.getByText('Court 1')).toBeInTheDocument();
    expect(screen.getByText('Queue 2')).toBeInTheDocument();
  });

  it('offers the time field on a waiting match and explains itself on a running one', () => {
    renderSheet();
    expect(screen.queryByLabelText('Planned start')).not.toBeInTheDocument();
    expect(screen.getByText('A started or finished match keeps its time.')).toBeInTheDocument();

    cleanup();
    renderSheet({ ...liveMatch, status: 'READY', scheduleItem: { ...liveMatch.scheduleItem, status: 'READY' } } as MatchDto);
    expect(screen.getByLabelText('Planned start')).toBeInTheDocument();
  });

  it('offers no command at all once the event is read-only', () => {
    renderSheet(liveMatch, true);
    expect(screen.queryByRole('button', { name: /win \d–\d$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Finish early' })).not.toBeInTheDocument();
  });
});
