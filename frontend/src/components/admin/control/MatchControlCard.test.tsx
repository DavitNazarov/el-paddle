// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { MatchDto } from '@/types/tournament';
import { I18nProvider } from '@/components/shared/I18nProvider';
import { MatchControlCard, type CardHandlers } from './MatchControlCard';

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
  scheduleItem: { id: 's1', status: 'IN_PROGRESS', version: 1, court: { id: 'c1', name: 'Court 1' } },
  snapshots: [],
} as unknown as MatchDto;

function renderCard(match: MatchDto = liveMatch) {
  const handlers: CardHandlers = {
    onStart: vi.fn(),
    onRecordResult: vi.fn(),
    onFinish: vi.fn(),
    onSaveTime: vi.fn(),
  };
  render(
    <I18nProvider initialLocale="en">
      <MatchControlCard busy="" locked={false} match={match} {...handlers} />
    </I18nProvider>,
  );
  return handlers;
}

// By accessible name, so the aria-hidden A/B marker beside each field stays out of it.
const fields = () => ({
  a: screen.getByRole('spinbutton', { name: 'Sets won by Ana / Nino' }),
  b: screen.getByRole('spinbutton', { name: 'Sets won by Beka / Giorgi' }),
  submit: screen.getByRole('button', { name: 'Record result' }),
});

describe('writing a result on a live match', () => {
  it('asks for the sets each side won, named by pair', () => {
    renderCard();
    const { a, b } = fields();
    expect(a).toBeInTheDocument();
    expect(b).toBeInTheDocument();
    expect(screen.getByText('Write the sets each side won, for example 2–1.')).toBeInTheDocument();
  });

  it('holds the command back until the two numbers are a finished result', () => {
    renderCard();
    const { a, b, submit } = fields();
    expect(submit).toBeDisabled();

    fireEvent.change(a, { target: { value: '1' } });
    expect(submit).toBeDisabled();

    fireEvent.change(b, { target: { value: '1' } });
    expect(submit).toBeDisabled();

    fireEvent.change(b, { target: { value: '2' } });
    expect(submit).toBeEnabled();
  });

  it('hands the two numbers over as typed', () => {
    const handlers = renderCard();
    const { a, b, submit } = fields();
    fireEvent.change(a, { target: { value: '1' } });
    fireEvent.change(b, { target: { value: '2' } });
    fireEvent.click(submit);
    expect(handlers.onRecordResult).toHaveBeenCalledWith(liveMatch, 1, 2);
  });

  it('refuses a result that would take back a set already recorded', () => {
    const played = { ...liveMatch, scoreA: 0, scoreB: 1, sets: [{ setNumber: 1, winnerSide: 'B' }] } as unknown as MatchDto;
    renderCard(played);
    const { a, b, submit } = fields();
    fireEvent.change(a, { target: { value: '2' } });
    fireEvent.change(b, { target: { value: '0' } });
    expect(submit).toBeDisabled();
    expect(screen.getByText('The result cannot be lower than the sets already recorded.')).toBeInTheDocument();
  });

  it('offers no result fields until the match is running', () => {
    renderCard({ ...liveMatch, status: 'READY' } as MatchDto);
    expect(screen.queryByRole('button', { name: 'Record result' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start match' })).toBeInTheDocument();
  });
});
