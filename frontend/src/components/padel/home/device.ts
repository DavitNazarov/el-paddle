'use client';

import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

/** True on real phones/tablets — DevTools device mode keeps pointer:fine. */
export function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(pointer: coarse)');
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
