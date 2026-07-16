'use client';

import { useSyncExternalStore } from 'react';

const mobileMotionQuery = '(pointer: coarse), (hover: none), (max-width: 900px)';
const mobileMotionListeners = new Set<() => void>();
let mobileMotionMedia: MediaQueryList | null = null;

function getMobileMotionMedia() {
  if (typeof window === 'undefined') return null;
  mobileMotionMedia ??= window.matchMedia(mobileMotionQuery);
  return mobileMotionMedia;
}

function notifyMobileMotionListeners() {
  mobileMotionListeners.forEach((listener) => listener());
}

function subscribeToMobileMotion(listener: () => void) {
  const media = getMobileMotionMedia();
  mobileMotionListeners.add(listener);
  if (mobileMotionListeners.size === 1) {
    media?.addEventListener('change', notifyMobileMotionListeners);
  }

  return () => {
    mobileMotionListeners.delete(listener);
    if (mobileMotionListeners.size === 0) {
      media?.removeEventListener('change', notifyMobileMotionListeners);
    }
  };
}

function getMobileMotionSnapshot() {
  return getMobileMotionMedia()?.matches ?? false;
}

/**
 * True when the UI should use the lightweight mobile motion budget.
 * Width is included because device emulators and hybrid laptops can still report a fine pointer.
 */
export function useCoarsePointer() {
  return useSyncExternalStore(
    subscribeToMobileMotion,
    getMobileMotionSnapshot,
    () => false,
  );
}
