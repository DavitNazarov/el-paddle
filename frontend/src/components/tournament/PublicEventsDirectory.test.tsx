// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { I18nProvider } from '@/components/shared/I18nProvider';
import type { EventDto } from '@/types/dashboard';
import { PublicEventsDirectory } from './PublicEventsDirectory';

// The page shell is nav, footer, and canvas effects — none of it is what this
// component decides, and all of it wants a browser.
vi.mock('./PublicDirectoryClients', () => ({
  PublicPageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

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

const event = (overrides: Partial<EventDto> = {}): EventDto => ({
  id: 'e1',
  title: 'Spring Open',
  date: '2030-09-01T10:00:00.000Z',
  location: 'Tbilisi',
  description: '',
  arrivalTime: null,
  participationFee: 40,
  categories: [{ id: 'men', name: "Men's Open", description: '' }],
  status: 'REGISTRATION_OPEN',
  version: 1,
  timeZone: 'Asia/Tbilisi',
  registrationRosterPublishedAt: null,
  schedulePublishedAt: null,
  publicLiveScoringEnabled: false,
  resultsPublishedAt: null,
  ...overrides,
});

function renderDirectory(upcoming: EventDto[], previous: EventDto[] = []) {
  render(
    <I18nProvider initialLocale="en">
      <PublicEventsDirectory upcoming={upcoming} previous={previous} />
    </I18nProvider>,
  );
}

describe('the lead tournament', () => {
  it('gives the soonest event the "next up" shelf and counts down to it', () => {
    renderDirectory([
      event({ id: 'soon', title: 'Autumn Masters', date: '2030-09-01T10:00:00.000Z' }),
      event({ id: 'later', title: 'Winter Cup', date: '2030-12-01T10:00:00.000Z' }),
    ]);
    const nextUp = screen.getByRole('region', { name: 'Next up' });
    expect(within(nextUp).getByRole('heading', { name: 'Autumn Masters' })).toBeInTheDocument();
    expect(within(nextUp).getByText('days to go')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Also on the calendar' })).getByRole('heading', { name: 'Winter Cup' })).toBeInTheDocument();
  });

  it('promotes a tournament being played over a sooner one', () => {
    renderDirectory([
      event({ id: 'soon', title: 'Autumn Masters', date: '2030-09-01T10:00:00.000Z' }),
      event({ id: 'live', title: 'Club Championship', date: '2030-10-01T10:00:00.000Z', status: 'ONGOING' }),
    ]);
    const nextUp = screen.getByRole('region', { name: 'Next up' });
    expect(within(nextUp).getByRole('heading', { name: 'Club Championship' })).toBeInTheDocument();
    expect(within(nextUp).getByText('Live')).toBeInTheDocument();
  });

  it('says the calendar is empty rather than showing a blank shelf', () => {
    renderDirectory([], [event({ id: 'old', date: '2020-05-01T10:00:00.000Z', status: 'COMPLETED' })]);
    expect(within(screen.getByRole('region', { name: 'Next up' })).getByText('Nothing on the calendar yet')).toBeInTheDocument();
  });
});

describe('what a card promises', () => {
  it('links only to the sections the organiser has published', () => {
    renderDirectory([], [
      event({
        id: 'done',
        title: 'Autumn Masters',
        date: '2020-09-01T10:00:00.000Z',
        status: 'COMPLETED',
        registrationRosterPublishedAt: '2020-08-01T00:00:00.000Z',
        resultsPublishedAt: '2020-09-02T00:00:00.000Z',
      }),
    ]);
    expect(screen.getByRole('link', { name: 'Teams' })).toHaveAttribute('href', '/events/done#teams');
    expect(screen.getByRole('link', { name: 'Results' })).toHaveAttribute('href', '/events/done#results');
    expect(screen.queryByRole('link', { name: 'Schedule' })).not.toBeInTheDocument();
  });
});

describe('the archive', () => {
  const played = [
    event({ id: 'a', title: 'Autumn Masters', location: 'Batumi', date: '2026-09-01T10:00:00.000Z', status: 'COMPLETED' }),
    event({ id: 'b', title: 'Winter Cup', location: 'Tbilisi', date: '2025-12-01T10:00:00.000Z', status: 'COMPLETED' }),
  ];

  it('groups finished tournaments by year', () => {
    renderDirectory([], played);
    expect(within(screen.getByRole('region', { name: '2026' })).getByRole('heading', { name: 'Autumn Masters' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: '2025' })).getByRole('heading', { name: 'Winter Cup' })).toBeInTheDocument();
  });

  it('narrows on a search and reports how many are left', () => {
    renderDirectory([], played);
    fireEvent.change(screen.getByRole('textbox', { name: 'Search event, place, or category' }), { target: { value: 'batumi' } });
    expect(screen.getByText('1 of 2 events shown')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Winter Cup' })).not.toBeInTheDocument();
  });

  it('says so when nothing matches instead of leaving the shelf blank', () => {
    renderDirectory([], played);
    fireEvent.change(screen.getByRole('textbox', { name: 'Search event, place, or category' }), { target: { value: 'kutaisi' } });
    expect(screen.getByText('No event matches your search.')).toBeInTheDocument();
  });
});
