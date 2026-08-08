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

/**
 * Re-seeds a field whenever the thing it belongs to changes — a different match
 * behind the same form, or the same one re-read from the server after a save.
 * Adjusted during render for the same reason: the field must never paint the
 * previous subject's value, not even for a frame.
 */
export function useResetOnChange<T>(token: unknown, initial: T) {
  const [value, setValue] = useState(initial);
  const [seen, setSeen] = useState(token);
  if (token !== seen) {
    setSeen(token);
    setValue(initial);
  }
  return [value, setValue] as const;
}
