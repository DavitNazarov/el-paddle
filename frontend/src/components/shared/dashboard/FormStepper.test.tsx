// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormStepper, type FormStepView } from './FormStepper';

// `globals` is off in vitest.config.ts, so testing-library's automatic cleanup
// is never registered and renders would otherwise pile up across tests.
afterEach(cleanup);

const steps: FormStepView[] = [
  { id: 'identity', label: 'What it is', status: 'done' },
  { id: 'when', label: 'When and where', status: 'invalid' },
  { id: 'money', label: 'Entry fee', status: 'current' },
  { id: 'categories', label: 'Categories', status: 'todo' },
];

function renderRail(onSelect = vi.fn()) {
  render(
    <FormStepper
      steps={steps}
      label="Event setup steps"
      progress="Step 3 of 4"
      statusLabels={{ done: 'finished', invalid: 'needs attention' }}
      onSelect={onSelect}
    />,
  );
  return onSelect;
}

describe('FormStepper', () => {
  it('states the position in words, not only in the marked step', () => {
    renderRail();
    expect(screen.getByText('Step 3 of 4')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Event setup steps' })).toBeInTheDocument();
  });

  it('names each step with its number and its state, so no state is colour alone', () => {
    renderRail();
    expect(screen.getByRole('button', { name: '1. What it is — finished' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2. When and where — needs attention' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '4. Categories' })).toBeInTheDocument();
  });

  it('marks only the current step for assistive technology', () => {
    renderRail();
    const current = screen.getByRole('button', { name: '3. Entry fee' });
    expect(current).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('button', { name: '4. Categories' })).not.toHaveAttribute('aria-current');
  });

  it('reaches any step, including one left unfinished behind the reader', () => {
    const onSelect = renderRail();
    fireEvent.click(screen.getByRole('button', { name: '2. When and where — needs attention' }));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  // The rail lives inside the modal's form, where a button without an explicit
  // type submits it — moving between steps would save the event.
  it('never submits the form it sits inside', () => {
    const onSubmit = vi.fn((formEvent: { preventDefault: () => void }) => formEvent.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <FormStepper
          steps={steps}
          label="Steps"
          progress="Step 3 of 4"
          statusLabels={{ done: 'finished', invalid: 'needs attention' }}
          onSelect={vi.fn()}
        />
      </form>,
    );
    fireEvent.click(screen.getByRole('button', { name: '4. Categories' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
