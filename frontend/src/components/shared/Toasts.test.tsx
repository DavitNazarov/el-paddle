// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/components/shared/I18nProvider';
import { ToastViewport, dismissToast, pushToast, resetToasts } from './Toasts';

// `globals` is off in vitest.config.ts, so testing-library's automatic cleanup
// is never registered and renders would otherwise pile up across tests.
afterEach(() => {
  cleanup();
  resetToasts();
  vi.useRealTimers();
});

// This jsdom build ships a `localStorage` stub without methods, which the locale
// provider reads on mount.
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

function renderViewport() {
  render(
    <I18nProvider initialLocale="en">
      <ToastViewport />
    </I18nProvider>,
  );
}

describe('the message layer', () => {
  it('shows a message pushed from anywhere, not only from a descendant', () => {
    renderViewport();
    act(() => { pushToast({ tone: 'error', message: 'Court is busy.' }); });
    expect(screen.getByText('Court is busy.')).toBeInTheDocument();
  });

  it('reports a refusal as an alert, so it is announced', () => {
    renderViewport();
    act(() => { pushToast({ tone: 'error', title: 'Could not record the result.', message: 'Court is busy.' }); });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Could not record the result.');
    expect(alert).toHaveTextContent('Court is busy.');
  });

  it('counts a retried command as one message rather than a stack of identical ones', () => {
    renderViewport();
    act(() => {
      pushToast({ tone: 'error', message: 'Court is busy.' });
      pushToast({ tone: 'error', message: 'Court is busy.' });
      pushToast({ tone: 'error', message: 'Court is busy.' });
    });
    expect(screen.getAllByText('Court is busy.')).toHaveLength(1);
  });

  it('keeps only the newest few, so a run of failures cannot bury the screen', () => {
    renderViewport();
    act(() => {
      for (const message of ['one', 'two', 'three', 'four']) pushToast({ tone: 'error', message });
    });
    expect(screen.queryByText('one')).not.toBeInTheDocument();
    expect(screen.getByText('four')).toBeInTheDocument();
  });

  it('lets a confirmation leave on its own and keeps a refusal until it is read', () => {
    vi.useFakeTimers();
    renderViewport();
    act(() => {
      pushToast({ tone: 'success', message: 'Time saved.' });
      pushToast({ tone: 'error', message: 'Court is busy.' });
    });

    act(() => { vi.advanceTimersByTime(30_000); });
    expect(screen.queryByText('Time saved.')).not.toBeInTheDocument();
    expect(screen.getByText('Court is busy.')).toBeInTheDocument();
  });

  it('dismisses on request', () => {
    renderViewport();
    let id = '';
    act(() => { id = pushToast({ tone: 'error', message: 'Court is busy.' }); });
    act(() => { dismissToast(id); });
    expect(screen.queryByText('Court is busy.')).not.toBeInTheDocument();
  });
});
