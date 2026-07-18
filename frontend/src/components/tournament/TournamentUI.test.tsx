// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CommandButton, StatusLabel } from './TournamentUI';

describe('tournament shared UI', () => {
  it('renders status as text and not color alone', () => {
    render(<StatusLabel icon="warning">REFUSED BY OPPONENT</StatusLabel>);
    expect(screen.getByText('REFUSED BY OPPONENT')).toBeVisible();
  });

  it('blocks repeated commands while busy', () => {
    render(<CommandButton busy>Save pairing</CommandButton>);
    expect(screen.getByRole('button', { name: /save pairing/i })).toBeDisabled();
  });
});

