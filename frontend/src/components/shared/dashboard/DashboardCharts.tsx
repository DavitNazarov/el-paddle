'use client';

import { useId, type ReactNode } from 'react';
import { Metric } from './DashboardUI';
import { Skeleton } from './Feedback';
import styles from './DashboardCharts.module.css';

/**
 * The dashboard's chart vocabulary. Three pieces, all prop-driven and free of
 * data fetching and i18n, so they can be previewed and tested on their own.
 *
 * Two rules shape every one of them:
 * - Colour is never the only signal. Series differ by fill pattern as well as
 *   hue, and every number a bar encodes also exists as text.
 * - A `null` value is "not tracked", never zero. It renders as a hatched gap and
 *   an em dash, never as a bar of no height.
 */

export type ChartTone = 'primary' | 'teal' | 'amber' | 'coral' | 'info';

export type ChartPoint = { label: string; value: number | null };

export type ChartSeries = {
  key: string;
  name: string;
  total: number;
  points: ChartPoint[];
  tone: ChartTone;
};

/** At most five ticks are drawn, always including the first and last: more than
 *  that collides at 375px, and the paired table carries the full detail. */
export function tickIndexes(count: number, max = 5): number[] {
  if (count <= 0) return [];
  if (count <= max) return Array.from({ length: count }, (_, index) => index);
  const step = (count - 1) / (max - 1);
  const indexes = new Set<number>();
  for (let position = 0; position < max; position += 1) {
    indexes.add(Math.round(position * step));
  }
  return [...indexes].sort((a, b) => a - b);
}

// The plot is stretched to its container width, so nothing inside it may be
// text: non-uniform scaling would distort the glyphs. Tick labels are HTML,
// below the SVG.
const VIEW_WIDTH = 320;
const PLOT_HEIGHT = 96;

type TrendBarsProps = {
  /** One or two series, same length and same labels. */
  series: ChartSeries[];
  caption: string;
  tableLabel: string;
  numbersLabel: string;
  noDataLabel: string;
  periodHeader: string;
  valueHeader: string;
  formatValue?: (value: number) => string;
};

export function TrendBars({
  series,
  caption,
  tableLabel,
  numbersLabel,
  noDataLabel,
  periodHeader,
  valueHeader,
  formatValue = (value) => String(value),
}: TrendBarsProps) {
  // A figcaption names its figure per spec, but not every accessibility
  // implementation does that, so the association is made explicit.
  const captionId = useId();
  const labels = series[0]?.points.map((point) => point.label) ?? [];
  const bucketCount = labels.length;
  const highest = Math.max(
    1,
    ...series.flatMap((entry) => entry.points.map((point) => point.value ?? 0)),
  );
  const tickLabels = tickIndexes(bucketCount).map((index) => labels[index]);

  const slot = bucketCount > 0 ? VIEW_WIDTH / bucketCount : VIEW_WIDTH;
  const groupWidth = Math.max(slot * 0.62, 1.5);
  const barWidth = Math.max(groupWidth / Math.max(series.length, 1), 1);

  return (
    <figure className={styles.figure} aria-labelledby={captionId}>
      <figcaption className={styles.caption} id={captionId}>
        {caption}
      </figcaption>

      {/* The chart is decoration over data that also exists as text below, so it
          is hidden from assistive technology rather than made navigable: one
          focus stop per bar would be a tab trap on a phone. */}
      <svg
        className={styles.chart}
        viewBox={`0 0 ${VIEW_WIDTH} ${PLOT_HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          {/* The second series carries a hatch *over* its tone, so the two series
              stay distinguishable in greyscale and with any colour blindness.
              Both patterns are applied through the `fill` attribute on elements
              with no CSS fill rule — a stylesheet `fill` would win and the
              pattern would silently never appear. */}
          <pattern id="dash-chart-hatch" width="4" height="4" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="4" className={styles.hatchLine} />
          </pattern>
          <pattern id="dash-chart-gap" width="4" height="4" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="4" className={styles.gapLine} />
          </pattern>
        </defs>

        <line x1="0" y1={PLOT_HEIGHT} x2={VIEW_WIDTH} y2={PLOT_HEIGHT} className={styles.baseline} />

        {labels.map((label, index) => {
          const groupLeft = index * slot + (slot - groupWidth) / 2;
          return (
            <g key={label}>
              {series.map((entry, seriesIndex) => {
                const point = entry.points[index];
                const x = groupLeft + seriesIndex * barWidth;
                if (!point || point.value === null) {
                  // Untracked: a hatched full-height band, so the reader sees a
                  // hole in the record rather than a period with no activity.
                  return (
                    <rect
                      key={entry.key}
                      x={x}
                      y={0}
                      width={barWidth}
                      height={PLOT_HEIGHT}
                      fill="url(#dash-chart-gap)"
                    >
                      <title>{`${label}: ${noDataLabel}`}</title>
                    </rect>
                  );
                }
                const height = point.value === 0 ? 0 : Math.max((point.value / highest) * PLOT_HEIGHT, 2);
                const title = `${label} · ${entry.name}: ${formatValue(point.value)}`;
                return (
                  <g key={entry.key}>
                    <rect
                      x={x}
                      y={PLOT_HEIGHT - height}
                      width={barWidth}
                      height={height}
                      className={styles.bar}
                      data-tone={entry.tone}
                    >
                      <title>{title}</title>
                    </rect>
                    {seriesIndex === 1 && height > 0 ? (
                      <rect
                        x={x}
                        y={PLOT_HEIGHT - height}
                        width={barWidth}
                        height={height}
                        fill="url(#dash-chart-hatch)"
                      >
                        <title>{title}</title>
                      </rect>
                    ) : null}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* Ticks live outside the plot: inside a stretched viewBox the text would
          be distorted. Spread rather than positioned, so no label can overflow
          the container at any width. */}
      {tickLabels.length > 0 ? (
        <div className={styles.ticks} aria-hidden="true">
          {tickLabels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      ) : null}

      {/* The legend carries each series' period total as text: the numbers must
          not live only in pixel heights. */}
      <ul className={styles.legend}>
        {series.map((entry, index) => (
          <li key={entry.key} className={styles.legendItem}>
            <span
              className={styles.swatch}
              data-tone={entry.tone}
              data-hatched={index === 1 ? 'true' : undefined}
              aria-hidden="true"
            />
            <span className={styles.legendName}>{entry.name}</span>
            <span className={styles.legendTotal}>{formatValue(entry.total)}</span>
          </li>
        ))}
      </ul>

      <details className={styles.numbers}>
        <summary className={styles.summary}>{numbersLabel}</summary>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <caption className={styles.srOnly}>{tableLabel}</caption>
            <thead>
              <tr>
                <th scope="col">{periodHeader}</th>
                {series.map((entry) => (
                  <th key={entry.key} scope="col">
                    {series.length > 1 ? entry.name : valueHeader}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labels.map((label, index) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  {series.map((entry) => {
                    const point = entry.points[index];
                    return (
                      <td key={entry.key}>
                        {point && point.value !== null ? (
                          formatValue(point.value)
                        ) : (
                          // An em dash with a real label behind it: "0" here
                          // would assert something the data does not know.
                          <abbr title={noDataLabel}>—</abbr>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

export type ShareSegment = { key: string; name: string; value: number; tone: ChartTone };

/**
 * One horizontal 100% bar for a distribution. Flex divs rather than SVG, so it
 * cannot overflow its container under any label length. The bar is decoration;
 * the list below it is the data, and it names every segment — including the ones
 * too small to see.
 */
export function ShareBar({
  segments,
  caption,
  emptyLabel,
  totalLabel,
}: {
  segments: ShareSegment[];
  caption: string;
  emptyLabel: string;
  totalLabel?: string;
}) {
  const captionId = useId();
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const visible = segments.filter((segment) => segment.value > 0);

  return (
    <figure className={styles.shareFigure} aria-labelledby={captionId}>
      <figcaption className={styles.caption} id={captionId}>
        {caption}
        {totalLabel ? <span className={styles.shareTotal}>{totalLabel}</span> : null}
      </figcaption>

      <div className={styles.shareTrack} aria-hidden="true">
        {visible.map((segment) => (
          <span
            key={segment.key}
            className={styles.shareSegment}
            data-tone={segment.tone}
            style={{ width: `${(segment.value / total) * 100}%` }}
          />
        ))}
      </div>

      {total === 0 ? (
        <p className={styles.shareEmpty}>{emptyLabel}</p>
      ) : (
        <ul className={styles.shareList}>
          {segments.map((segment) => (
            <li key={segment.key} className={styles.shareItem}>
              <span className={styles.shareDot} data-tone={segment.tone} aria-hidden="true" />
              <span className={styles.shareName}>{segment.name}</span>
              <span className={styles.shareValue}>
                {segment.value}
                <span className={styles.sharePct}>
                  {/* Rounded to a whole percent, so a real but tiny segment reads
                      "0%" while still being listed rather than dropped. */}
                  {` · ${Math.round((segment.value / total) * 100)}%`}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

export type DeltaLabels = {
  up: string;
  down: string;
  flat: string;
  vsPrevious: string;
  noComparison: string;
};

export type DeltaInput = {
  current: number;
  previous: number;
  changePct: number | null;
  direction: 'up' | 'down' | 'flat';
};

/**
 * A KPI tile: the existing `Metric` plus a period-over-period reading.
 *
 * `goodDirection` exists because a direction alone cannot say whether the news
 * is good — signups up is good, deletions up is not — and colouring both the
 * same way would make the tone meaningless.
 */
export function StatDelta({
  label,
  value,
  hint,
  note,
  delta,
  goodDirection,
  deltaLabels,
  formatValue = (input: number) => String(input),
}: {
  label: string;
  value: number | null;
  hint?: string;
  note?: string;
  delta?: DeltaInput | null;
  goodDirection: 'up' | 'down' | 'none';
  deltaLabels: DeltaLabels;
  formatValue?: (value: number) => string;
}) {
  const tone = toneForDelta(delta ?? null, goodDirection);
  const deltaText = describeDelta(delta ?? null, deltaLabels);

  return (
    <div className={styles.tile}>
      <Metric
        label={label}
        // Loading shows shape: a skeleton the size of the number that replaces it.
        value={value === null ? <Skeleton width="3.25rem" height="1.75rem" /> : formatValue(value)}
        hint={hint}
        tone={tone}
      />
      {deltaText ? (
        <p className={styles.delta} data-tone={tone}>
          {/* Glyph *and* word: an arrow on its own fails in greyscale and for a
              screen reader. */}
          <span aria-hidden="true">{arrowFor(delta?.direction ?? 'flat')}</span>
          {deltaText}
        </p>
      ) : null}
      {note ? <p className={styles.note}>{note}</p> : null}
    </div>
  );
}

export function toneForDelta(
  delta: DeltaInput | null,
  goodDirection: 'up' | 'down' | 'none',
): 'neutral' | 'success' | 'warning' | 'info' {
  if (!delta || goodDirection === 'none' || delta.direction === 'flat') return 'neutral';
  const favourable = delta.direction === goodDirection;
  return favourable ? 'success' : 'warning';
}

export function describeDelta(delta: DeltaInput | null, labels: DeltaLabels) {
  if (!delta) return '';
  if (delta.changePct === null) return labels.noComparison;
  const word = delta.direction === 'up' ? labels.up : delta.direction === 'down' ? labels.down : labels.flat;
  return `${Math.abs(delta.changePct)}% ${word} ${labels.vsPrevious}`;
}

function arrowFor(direction: 'up' | 'down' | 'flat') {
  if (direction === 'up') return '↑';
  if (direction === 'down') return '↓';
  return '→';
}

/** A labelled figure with a value and an optional detail line — for the counts
 *  that are a single number rather than a series or a distribution. */
export function StatLine({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  tone?: 'neutral' | 'warning' | 'positive';
}) {
  return (
    <div className={styles.line} data-tone={tone}>
      <span className={styles.lineLabel}>{label}</span>
      <span className={styles.lineValue}>{value}</span>
      {detail ? <span className={styles.lineDetail}>{detail}</span> : null}
    </div>
  );
}
