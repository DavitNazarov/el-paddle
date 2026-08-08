'use client';

import { Search, X } from 'lucide-react';
import type { CourtDto, MatchRoundDto } from '@/types/tournament';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy, tournamentRound } from '@/lib/i18n/tournament';
import { activeRounds } from '../bracket/bracketModel';
import {
  NO_COURT,
  activeFilterCount,
  categoryLabels,
  courtLabels,
  emptyFilters,
  optionsWithCounts,
  type ControlFilters,
  type FilterOption,
} from './controlFilters';
import { bandOf, type ControlMatch, type MatchBand } from './runBoard';
import styles from './MatchControl.module.css';

/**
 * The console's one question-asking surface: which matches am I looking at, and
 * how do I want them laid out. Four narrow answers and a search box, because
 * those are the four ways a desk gets interrupted — by a court, by a category,
 * by a round, by a name.
 *
 * Selects rather than chip rows: eight courts, four categories, four rounds and
 * four states would be twenty chips, and a control that grows with the draw is
 * exactly what a big draw cannot afford. What is *chosen* becomes a chip, so
 * the current question is always one line and always removable.
 */

export const CONTROL_VIEWS = ['courts', 'run', 'draw'] as const;
export type ControlView = (typeof CONTROL_VIEWS)[number];

const viewLabels = { courts: 'viewCourts', run: 'viewRunOrder', draw: 'viewDraw' } as const;
const bandOrder: MatchBand[] = ['live', 'ready', 'upcoming', 'done'];
const bandLabels = { live: 'bandLive', ready: 'bandReady', upcoming: 'bandUpcoming', done: 'bandDone' } as const;

export function ControlFilterBar({
  courts,
  entries,
  filters,
  onChange,
  onViewChange,
  shown,
  view,
}: {
  courts: CourtDto[];
  entries: ControlMatch[];
  filters: ControlFilters;
  onChange: (filters: ControlFilters) => void;
  onViewChange: (view: ControlView) => void;
  /** How many matches survive the current filter, out of everything in the event. */
  shown: number;
  view: ControlView;
}) {
  const { locale } = useI18n();
  const control = tournamentCopy[locale].admin.control;
  const active = activeFilterCount(filters);

  const courtOptions = optionsWithCounts(
    entries,
    (entry) => entry.court?.id ?? NO_COURT,
    courtLabels(courts, control.noCourtOption),
    filters.courtId,
  );
  const categoryOptions = optionsWithCounts(
    entries,
    (entry) => entry.categoryId,
    categoryLabels(entries),
    filters.categoryId,
  );
  // Rounds are offered in the order they are played, not the order the payload
  // happened to list them in.
  const roundOptions = optionsWithCounts(
    entries,
    (entry) => entry.match.round,
    new Map(activeRounds(entries.map((entry) => entry.match)).map((round) => [round, tournamentRound(locale, round)])),
    filters.round,
  );
  const bandOptions = optionsWithCounts(
    entries,
    (entry) => bandOf(entry.match),
    new Map(bandOrder.map((band) => [band, control[bandLabels[band]]])),
    filters.band,
  );

  const chips = [
    filters.courtId ? { key: 'court', label: labelOf(courtOptions, filters.courtId), clear: { courtId: null } } : null,
    filters.categoryId ? { key: 'category', label: labelOf(categoryOptions, filters.categoryId), clear: { categoryId: null } } : null,
    filters.round ? { key: 'round', label: labelOf(roundOptions, filters.round), clear: { round: null } } : null,
    filters.band ? { key: 'band', label: labelOf(bandOptions, filters.band), clear: { band: null } } : null,
    filters.late ? { key: 'late', label: control.behind, clear: { late: false } } : null,
    filters.search.trim() ? { key: 'search', label: `“${filters.search.trim()}”`, clear: { search: '' } } : null,
  ].filter(Boolean) as Array<{ key: string; label: string; clear: Partial<ControlFilters> }>;

  return (
    <div className={styles.bar}>
      <div className={styles.barTop}>
        <div className={styles.search}>
          <Search aria-hidden="true" />
          <label className="sr-only" htmlFor="control-search">{control.searchLabel}</label>
          <input
            id="control-search"
            type="search"
            className={styles.searchInput}
            placeholder={control.searchPlaceholder}
            value={filters.search}
            onChange={(fieldEvent) => onChange({ ...filters, search: fieldEvent.target.value })}
          />
        </div>

        <div className={styles.views} role="group" aria-label={control.viewLabel}>
          {CONTROL_VIEWS.map((option) => (
            <button
              key={option}
              type="button"
              className={styles.view}
              data-active={view === option}
              aria-pressed={view === option}
              onClick={() => onViewChange(option)}
            >
              {control[viewLabels[option]]}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.selects}>
        <FilterSelect
          id="control-court"
          label={control.filterCourt}
          all={control.allCourts}
          options={courtOptions}
          value={filters.courtId}
          onChange={(value) => onChange({ ...filters, courtId: value })}
        />
        <FilterSelect
          id="control-category"
          label={control.filterCategory}
          all={control.allCategories}
          options={categoryOptions}
          value={filters.categoryId}
          onChange={(value) => onChange({ ...filters, categoryId: value })}
        />
        <FilterSelect
          id="control-round"
          label={control.filterRound}
          all={control.allRounds}
          options={roundOptions}
          value={filters.round}
          onChange={(value) => onChange({ ...filters, round: value as MatchRoundDto | null })}
        />
        <FilterSelect
          id="control-band"
          label={control.filterStatus}
          all={control.allStatuses}
          options={bandOptions}
          value={filters.band}
          onChange={(value) => onChange({ ...filters, band: value as MatchBand | null })}
        />
      </div>

      <div className={styles.barFoot}>
        <p className={styles.count} aria-live="polite">
          {fillTemplate(control.showing, { shown, total: entries.length })}
        </p>
        {active ? (
          <div className={styles.chips}>
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                className={styles.chip}
                onClick={() => onChange({ ...filters, ...chip.clear })}
              >
                {chip.label}
                <X aria-hidden="true" />
                <span className="sr-only">{control.removeFilter}</span>
              </button>
            ))}
            <button type="button" className={styles.clearAll} onClick={() => onChange(emptyFilters)}>
              {control.clearFilters}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function labelOf(options: FilterOption[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function FilterSelect({
  all,
  id,
  label,
  onChange,
  options,
  value,
}: {
  all: string;
  id: string;
  label: string;
  onChange: (value: string | null) => void;
  options: FilterOption[];
  value: string | null;
}) {
  return (
    <div className={styles.selectField}>
      <label className={styles.selectLabel} htmlFor={id}>{label}</label>
      <select
        id={id}
        className={styles.select}
        value={value ?? ''}
        onChange={(fieldEvent) => onChange(fieldEvent.target.value || null)}
      >
        <option value="">{all}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label} ({option.count})
          </option>
        ))}
      </select>
    </div>
  );
}
