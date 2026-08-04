// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  describeDelta,
  ShareBar,
  StatDelta,
  tickIndexes,
  toneForDelta,
  TrendBars,
  type ChartSeries,
} from './DashboardCharts';

// These primitives take every string as a prop, so they need no I18nProvider —
// which is the whole point of keeping them presentational.

// `globals` is off in vitest.config.ts, so testing-library's automatic cleanup
// is never registered and renders would otherwise pile up across tests.
afterEach(cleanup);

const labels = {
  showNumbers: 'Show the numbers',
  noData: 'Not recorded',
  period: 'Period',
  value: 'Count',
};

function series(values: (number | null)[], overrides: Partial<ChartSeries> = {}): ChartSeries {
  return {
    key: 'joined',
    name: 'Joined',
    tone: 'teal',
    total: values.reduce((sum: number, value) => sum + (value ?? 0), 0),
    points: values.map((value, index) => ({ label: `0${index + 1}.07`, value })),
    ...overrides,
  };
}

function renderTrend(entries: ChartSeries[]) {
  return render(
    <TrendBars
      series={entries}
      caption="Accounts joined and left"
      tableLabel="Accounts joined and left"
      numbersLabel={labels.showNumbers}
      noDataLabel={labels.noData}
      periodHeader={labels.period}
      valueHeader={labels.value}
    />,
  );
}

describe('tickIndexes', () => {
  it('returns every index when there are few buckets', () => {
    expect(tickIndexes(4)).toEqual([0, 1, 2, 3]);
  });

  it('caps at five and always includes the first and last', () => {
    for (const count of [6, 12, 13, 30, 31, 90]) {
      const indexes = tickIndexes(count);
      expect(indexes.length, `count ${count}`).toBeLessThanOrEqual(5);
      expect(indexes[0]).toBe(0);
      expect(indexes.at(-1)).toBe(count - 1);
    }
  });

  it('handles an empty series', () => {
    expect(tickIndexes(0)).toEqual([]);
  });
});

describe('TrendBars', () => {
  it('names the figure from its caption', () => {
    renderTrend([series([1, 2, 3])]);
    expect(screen.getByRole('figure', { name: 'Accounts joined and left' })).toBeInTheDocument();
  });

  it('pairs the chart with a table holding one row per bucket', () => {
    renderTrend([series([1, 2, 3])]);
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    // One header row plus one row per bucket.
    expect(rows).toHaveLength(4);
  });

  it('renders an em dash, never a zero, for an untracked bucket', () => {
    renderTrend([series([null, 0, 4])]);
    const table = screen.getByRole('table');
    const cells = within(table).getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('—');
    expect(cells[0]).not.toHaveTextContent('0');
    // A real zero still reads as zero: null and 0 must not look alike.
    expect(cells[1]).toHaveTextContent('0');
  });

  it('labels the untracked cell so the dash is not the only explanation', () => {
    renderTrend([series([null, 1])]);
    expect(screen.getByTitle(labels.noData)).toBeInTheDocument();
  });

  it('puts every series name and period total in the legend as text', () => {
    const { container } = renderTrend([
      series([1, 2], { key: 'a', name: 'Joined', total: 3 }),
      series([4, 5], { key: 'b', name: 'Deleted', tone: 'coral', total: 9 }),
    ]);
    // Scoped to the legend: the names also appear as table column headers.
    const legend = container.querySelector('ul');
    expect(legend).not.toBeNull();
    expect(legend!.textContent).toContain('Joined');
    expect(legend!.textContent).toContain('3');
    expect(legend!.textContent).toContain('Deleted');
    expect(legend!.textContent).toContain('9');
  });

  it('draws at most five tick labels for a month of buckets', () => {
    const { container } = renderTrend([series(Array.from({ length: 31 }, () => 1))]);
    const ticks = container.querySelectorAll('[aria-hidden="true"] > span');
    expect(ticks.length).toBeLessThanOrEqual(5);
  });

  it('hides the plot from assistive technology, since the table carries the data', () => {
    const { container } = renderTrend([series([1, 2])]);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
  });

  it('survives an empty series without throwing', () => {
    renderTrend([series([])]);
    expect(screen.getByRole('figure', { name: 'Accounts joined and left' })).toBeInTheDocument();
  });
});

describe('ShareBar', () => {
  it('lists every segment in text, including one that rounds to zero percent', () => {
    render(
      <ShareBar
        caption="Who is on the platform"
        emptyLabel={labels.noData}
        segments={[
          { key: 'USER', name: 'Players', value: 400, tone: 'info' },
          { key: 'ADMIN', name: 'Administrators', value: 1, tone: 'primary' },
        ]}
      />,
    );
    expect(screen.getByText('Players')).toBeInTheDocument();
    // 1 of 401 rounds to 0%, and must still be named rather than dropped.
    expect(screen.getByText('Administrators')).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === '1 · 0%'),
    ).toBeInTheDocument();
  });

  it('says so when every value is zero instead of drawing a full bar', () => {
    render(
      <ShareBar
        caption="Email delivery"
        emptyLabel={labels.noData}
        segments={[{ key: 'SENT', name: 'Sent', value: 0, tone: 'teal' }]}
      />,
    );
    expect(screen.getByText(labels.noData)).toBeInTheDocument();
    expect(screen.queryByText('Sent')).not.toBeInTheDocument();
  });
});

describe('toneForDelta', () => {
  const rising = { current: 9, previous: 3, changePct: 200, direction: 'up' as const };
  const falling = { current: 3, previous: 9, changePct: -66, direction: 'down' as const };

  it('reads a rise as good or bad depending on the metric', () => {
    // Signups up is good news; deletions up is not. The direction alone cannot say.
    expect(toneForDelta(rising, 'up')).toBe('success');
    expect(toneForDelta(rising, 'down')).toBe('warning');
    expect(toneForDelta(falling, 'down')).toBe('success');
    expect(toneForDelta(falling, 'up')).toBe('warning');
  });

  it('stays neutral without a delta, without a preference, or when flat', () => {
    expect(toneForDelta(null, 'up')).toBe('neutral');
    expect(toneForDelta(rising, 'none')).toBe('neutral');
    expect(toneForDelta({ current: 5, previous: 5, changePct: 0, direction: 'flat' }, 'up')).toBe(
      'neutral',
    );
  });
});

describe('describeDelta', () => {
  const deltaLabels = {
    up: 'up',
    down: 'down',
    flat: 'unchanged',
    vsPrevious: 'vs previous period',
    noComparison: 'No comparison',
  };

  it('states the comparison in words as well as a percentage', () => {
    expect(describeDelta({ current: 9, previous: 3, changePct: 200, direction: 'up' }, deltaLabels)).toBe(
      '200% up vs previous period',
    );
  });

  it('never emits a percentage against an empty previous period', () => {
    expect(describeDelta({ current: 9, previous: 0, changePct: null, direction: 'up' }, deltaLabels)).toBe(
      'No comparison',
    );
  });

  it('never emits NaN or Infinity', () => {
    for (const changePct of [null, 0, -100, 9999]) {
      const text = describeDelta(
        { current: 1, previous: 1, changePct, direction: 'flat' },
        deltaLabels,
      );
      expect(text).not.toMatch(/NaN|Infinity/);
    }
  });
});

describe('StatDelta', () => {
  const deltaLabels = {
    up: 'up',
    down: 'down',
    flat: 'unchanged',
    vsPrevious: 'vs previous period',
    noComparison: 'No comparison',
  };

  it('shows a placeholder rather than a zero while the number is unknown', () => {
    render(
      <StatDelta label="New accounts" value={null} goodDirection="up" deltaLabels={deltaLabels} />,
    );
    expect(screen.getByText('New accounts')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('renders the note that explains a tracking gap', () => {
    render(
      <StatDelta
        label="Deleted accounts"
        value={0}
        note="Not recorded before 30 Jul 2026"
        goodDirection="down"
        deltaLabels={deltaLabels}
      />,
    );
    expect(screen.getByText('Not recorded before 30 Jul 2026')).toBeInTheDocument();
  });
});
