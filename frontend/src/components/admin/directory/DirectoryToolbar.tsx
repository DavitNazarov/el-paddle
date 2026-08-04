'use client';

import { Search } from 'lucide-react';
import type { DirectoryQuery, FacetOption } from './directoryModel';
import styles from './Directory.module.css';

/**
 * One toolbar for every admin directory: find the row you mean, then narrow to
 * the state you care about. The count line is not decoration — it is the only
 * thing that tells the reader a filter is hiding rows from them.
 */
export function DirectoryToolbar({
  query,
  onQueryChange,
  facets,
  searchLabel,
  countLabel,
  id,
}: {
  query: DirectoryQuery;
  onQueryChange: (query: DirectoryQuery) => void;
  /** Empty for a directory with nothing worth filtering by. */
  facets: FacetOption[];
  searchLabel: string;
  /** Already-formatted, e.g. "12 of 30 shown". The caller knows the nouns. */
  countLabel: string;
  id: string;
}) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.search}>
        <Search aria-hidden="true" />
        <input
          id={`${id}-search`}
          type="search"
          className={styles.searchInput}
          value={query.search}
          placeholder={searchLabel}
          aria-label={searchLabel}
          onChange={(fieldEvent) => onQueryChange({ ...query, search: fieldEvent.target.value })}
        />
      </div>

      {facets.length ? (
        <ul className={styles.facets}>
          {facets.map((facet) => (
            <li key={facet.value}>
              <button
                type="button"
                className={styles.chip}
                aria-pressed={query.facet === facet.value}
                data-empty={facet.count === 0}
                onClick={() => onQueryChange({ ...query, facet: facet.value })}
              >
                {facet.label}
                <span className={styles.chipCount}>{facet.count}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <p className={`${styles.count} ${facets.length ? styles.toolbarWide : ''}`} aria-live="polite">
        {countLabel}
      </p>
    </div>
  );
}
