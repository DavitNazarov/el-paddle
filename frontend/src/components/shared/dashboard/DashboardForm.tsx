'use client';

import { TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import styles from './DashboardForm.module.css';

/**
 * The form archetype: grouped fields, an explicit save, and inline field
 * errors. Nothing here writes on blur — every screen using this saves only when
 * the reader says so, and says what is unsaved until they do.
 */

export function FormSection({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className={styles.section}>
      <div className={styles.sectionHead}>
        <legend className={styles.legend}>{title}</legend>
        {detail ? <p className={styles.sectionDetail}>{detail}</p> : null}
      </div>
      <div className={styles.fields}>{children}</div>
    </fieldset>
  );
}

/** Two fields that belong together on one line from 40rem, stacked below it. */
export function FieldPair({ children }: { children: ReactNode }) {
  return <div className={styles.pair}>{children}</div>;
}

export type FieldControlProps = {
  id: string;
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
};

/**
 * A labelled field that owns its own error wiring. The control comes back as a
 * render prop so `aria-invalid` and `aria-describedby` cannot drift from the
 * message actually on screen — the mistake every hand-wired field makes.
 */
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  /** Already translated. Absent means valid. */
  error?: string;
  children: (control: FieldControlProps) => ReactNode;
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`dash-field min-w-0 space-y-2 ${error ? styles.invalid : ''}`}>
      <Label
        htmlFor={id}
        className="dashboard-field-label block text-xs font-semibold uppercase leading-5 tracking-[0.16em] text-[#6d5f5c]"
      >
        {label}
      </Label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}
      {hint ? (
        <p id={hintId} className="dashboard-field-hint text-xs leading-5 text-[#7a6c69]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className={styles.error}>
          <TriangleAlert aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A checkbox grid. Used for event categories and settings preferences. */
export function ChoiceGrid<T>({
  items,
  itemKey,
  itemLabel,
  selected,
  onToggle,
  name,
}: {
  items: T[];
  itemKey: (item: T) => string;
  itemLabel: (item: T) => string;
  selected: (item: T) => boolean;
  onToggle: (item: T) => void;
  name: string;
}) {
  return (
    <div className={styles.choices}>
      {items.map((item) => {
        const isSelected = selected(item);
        return (
          <label key={itemKey(item)} className={styles.choice} data-selected={isSelected}>
            <input
              type="checkbox"
              name={name}
              checked={isSelected}
              onChange={() => onToggle(item)}
            />
            {itemLabel(item)}
          </label>
        );
      })}
    </div>
  );
}

/**
 * The save row. It states what is pending before the reader commits — an
 * explicit save is only honest if the screen admits there is something to save.
 */
export function FormActions({
  state,
  tone,
  children,
}: {
  state?: string;
  tone?: 'dirty' | 'saved';
  children: ReactNode;
}) {
  return (
    <div className={styles.actions}>
      {state ? (
        <p className={styles.state} data-tone={tone} aria-live="polite">
          {state}
        </p>
      ) : null}
      {children}
    </div>
  );
}

export const dashboardFormClassName = styles.form;
