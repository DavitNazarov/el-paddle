'use client';

import { Check, TriangleAlert } from 'lucide-react';
import styles from './FormStepper.module.css';

/**
 * The stepper archetype: one long form split into steps that each answer a
 * single question, with a rail that says where the reader is and what is still
 * wrong behind them. Every step stays reachable — the rail is navigation, not a
 * gate, so a reader fixing one field never has to walk the whole form again.
 */

export type FormStepStatus = 'todo' | 'current' | 'done' | 'invalid';

export type FormStepView = {
  id: string;
  label: string;
  status: FormStepStatus;
};

export function FormStepper({
  steps,
  label,
  progress,
  statusLabels,
  onSelect,
}: {
  steps: FormStepView[];
  /** Names the rail for screen readers, e.g. “Event setup steps”. */
  label: string;
  /** Already filled, e.g. “Step 2 of 4”. Stated in words so position is never colour alone. */
  progress: string;
  statusLabels: { done: string; invalid: string };
  onSelect: (index: number) => void;
}) {
  return (
    <nav className={styles.rail} aria-label={label}>
      <p className={styles.progress}>{progress}</p>
      <ol className={styles.steps}>
        {steps.map((step, index) => (
          <li key={step.id} className={styles.step} data-status={step.status}>
            <button
              type="button"
              className={styles.trigger}
              aria-current={step.status === 'current' ? 'step' : undefined}
              onClick={() => onSelect(index)}
            >
              <span className={styles.marker} aria-hidden="true">
                {step.status === 'invalid' ? (
                  <TriangleAlert />
                ) : step.status === 'done' ? (
                  <Check />
                ) : (
                  index + 1
                )}
              </span>
              <span className={styles.label} aria-hidden="true">
                {step.label}
              </span>
              {/* The visible label is hidden on narrow screens and the marker is
                  an icon, so the accessible name is carried here alone — number,
                  name, and state in one string. */}
              <span className="sr-only">
                {`${index + 1}. ${step.label}`}
                {step.status === 'invalid' ? ` — ${statusLabels.invalid}` : ''}
                {step.status === 'done' ? ` — ${statusLabels.done}` : ''}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
