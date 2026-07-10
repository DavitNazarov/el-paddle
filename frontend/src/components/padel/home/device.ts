'use client';

import {
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import { useReducedMotion } from 'framer-motion';

const mobileMotionQuery = '(pointer: coarse), (hover: none), (max-width: 768px)';
const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** True for touch/small-screen devices; DevTools device mode often keeps pointer:fine. */
export function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false);

  useBrowserLayoutEffect(() => {
    const media = window.matchMedia(mobileMotionQuery);
    const sync = () => setCoarse(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return coarse;
}

/** Scroll-linked transforms desync on iOS momentum scroll; skip on touch devices. */
export function useScrollParallaxEnabled() {
  const reduceMotion = useReducedMotion();
  const coarse = useCoarsePointer();
  return !reduceMotion && !coarse;
}
