'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Notice, type NoticeTone } from '@/components/shared/dashboard/Feedback';
import styles from './Toasts.module.css';

/**
 * Messages that follow the action instead of the page.
 *
 * A command is usually sent from inside a dialog, and a banner at the top of the
 * page is behind that dialog — so a refused command looked like nothing at all
 * happened, and the operator sent it again. A toast is rendered above every
 * layer, so the answer arrives where the reader is looking.
 *
 * The store is a module, not a context: a message is pushed from event handlers,
 * fetch wrappers and effects all over the app, and none of them should have to
 * be a descendant of a provider to say something went wrong.
 */

export type Toast = {
  id: string;
  tone: NoticeTone;
  title?: string;
  message: string;
};

/** How long a message stays before leaving on its own. */
const AUTO_DISMISS_MS: Record<NoticeTone, number | null> = {
  success: 5000,
  info: 6000,
  warning: 10000,
  // An error describes something still true, and match-day operators are not
  // watching the screen when it lands. It waits to be read.
  error: null,
};

/** Enough to see what just happened, not enough to bury the screen. */
const MAX_VISIBLE = 3;

let toasts: Toast[] = [];
let sequence = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function snapshot() {
  return toasts;
}

/** Server render has nothing to show, and never the client's list. */
const emptySnapshot: Toast[] = [];

export function pushToast(input: { tone: NoticeTone; message: string; title?: string }) {
  const id = `toast-${(sequence += 1)}`;
  // The same message repeated is one message. A command retried three times
  // should not stack three identical failures.
  const withoutDuplicate = toasts.filter((toast) => !(toast.message === input.message && toast.tone === input.tone));
  toasts = [...withoutDuplicate, { id, ...input }].slice(-MAX_VISIBLE);
  emit();
  return id;
}

export function dismissToast(id: string) {
  const remaining = toasts.filter((toast) => toast.id !== id);
  if (remaining.length === toasts.length) return;
  toasts = remaining;
  emit();
}

/** Test seam: the store outlives a component, so a suite has to be able to clear it. */
export function resetToasts() {
  toasts = [];
  sequence = 0;
  emit();
}

export function useToasts() {
  return useSyncExternalStore(subscribe, snapshot, () => emptySnapshot);
}

/**
 * Mirrors a screen's `error`/`notice` state into toasts.
 *
 * Existing screens keep one string of each; this turns a change in either into a
 * message without every client having to be rewritten around a queue. Clearing
 * the string is left to the caller, so dismissing a toast never silently
 * discards state the screen still reads.
 */
export function useFeedbackToasts({ error, notice }: { error?: string; notice?: string }) {
  const lastError = useRef('');
  const lastNotice = useRef('');

  useEffect(() => {
    if (error && error !== lastError.current) pushToast({ tone: 'error', message: error });
    lastError.current = error ?? '';
  }, [error]);

  useEffect(() => {
    if (notice && notice !== lastNotice.current) pushToast({ tone: 'success', message: notice });
    lastNotice.current = notice ?? '';
  }, [notice]);
}

/**
 * Where messages are drawn. Mounted once at the root, above every dialog, so a
 * message raised from inside a modal is still the topmost thing on screen.
 */
export function ToastViewport() {
  const list = useToasts();
  const mounted = useMounted();
  if (!mounted) return null;

  return createPortal(
    // `dashboard-portal-surface` carries the design tokens onto a layer mounted
    // outside .dash-app, the same way a portalled dialog gets them.
    <div className={`dashboard-portal-surface ${styles.viewport}`} role="region" aria-label="Messages">
      {list.map((toast) => (
        <ToastRow key={toast.id} toast={toast} />
      ))}
    </div>,
    document.body,
  );
}

function ToastRow({ toast }: { toast: Toast }) {
  const dismiss = useCallback(() => dismissToast(toast.id), [toast.id]);

  useEffect(() => {
    const life = AUTO_DISMISS_MS[toast.tone];
    if (life === null) return;
    const timer = window.setTimeout(dismiss, life);
    return () => window.clearTimeout(timer);
  }, [dismiss, toast.tone]);

  return (
    <div className={styles.toast}>
      <Notice tone={toast.tone} title={toast.title} onDismiss={dismiss}>
        {toast.message}
      </Notice>
    </div>
  );
}

/** A portal needs a document, which the server render does not have. */
function useMounted() {
  return useSyncExternalStore(() => () => {}, () => true, () => false);
}
