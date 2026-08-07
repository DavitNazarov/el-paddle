'use client';

import { useState } from 'react';

/**
 * Clears a dialog's fields each time it is opened, by adjusting state during
 * render rather than in an effect — the dialog must not paint the previous
 * entry's values for a frame before resetting them.
 */
export function useResetOnOpen<T>(open: boolean, initial: T) {
  const [value, setValue] = useState(initial);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setValue(initial);
  }
  return [value, setValue] as const;
}
