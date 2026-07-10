'use client';

import {
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
import { useI18n } from '@/components/shared/I18nProvider';
import { useCoarsePointer, useScrollParallaxEnabled } from './device';

export function Preloader() {
  const reduceMotion = useReducedMotion();
  const coarse = useCoarsePointer();
  const { dictionary } = useI18n();
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (reduceMotion || coarse) return;
    const fallback = window.setTimeout(() => {
      setProgress(100);
      setDone(true);
    }, 2400);
    const controls = animate(0, 100, {
      duration: 1.5,
      ease: [0.32, 0.72, 0.24, 1],
      onUpdate: (latest) => setProgress(Math.round(latest)),
      onComplete: () => {
        window.clearTimeout(fallback);
        setDone(true);
      },
    });
    return () => {
      window.clearTimeout(fallback);
      controls.stop();
    };
  }, [coarse, reduceMotion]);

  useEffect(() => {
    if (done || reduceMotion || coarse) return;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, [coarse, done, reduceMotion]);

  if (reduceMotion || coarse) return null;

  return (
    <AnimatePresence>
      {!done ? (
        <motion.div
          className="preloader fixed inset-0 z-[120] flex flex-col items-center justify-center bg-[var(--padel-ink)]"
          exit={{ y: '-100%' }}
          transition={{ duration: 0.85, ease: [0.76, 0, 0.24, 1] }}
          aria-hidden
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <Image
              src="/images/el-padel-logo.png"
              alt=""
              width={280}
              height={186}
              priority
              className="h-auto w-[150px] object-contain md:w-[190px]"
            />
          </motion.div>
          <div className="mt-10 flex w-[min(240px,72vw)] flex-col items-center gap-4">
            <div className="preloader-court h-16 w-full border border-[var(--padel-line)] p-2" aria-hidden>
              <div className="preloader-court__inner relative h-full w-full border border-[var(--padel-line-strong)]">
                <span className="preloader-court__net" />
              </div>
            </div>
            <div className="h-px w-full overflow-hidden bg-[var(--padel-line)]">
              <motion.div
                className="h-full bg-[var(--padel-gold)]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="font-display text-sm tabular-nums tracking-[0.3em] text-[var(--padel-muted)]">
              {progress}%
            </p>
          </div>
          <p className="absolute bottom-8 text-[0.62rem] font-semibold uppercase tracking-[0.42em] text-[var(--padel-muted)]/60">
            {dictionary.home.history.signoff}
          </p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function CursorRing() {
  const reduceMotion = useReducedMotion();
  const [enabled, setEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [hoveringLink, setHoveringLink] = useState(false);
  const resetBallRef = useRef<number | null>(null);
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const ballX = useMotionValue(0);
  const ballY = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 320, damping: 28, mass: 0.55 });
  const springY = useSpring(y, { stiffness: 320, damping: 28, mass: 0.55 });
  const springBallX = useSpring(ballX, { stiffness: 520, damping: 24, mass: 0.24 });
  const springBallY = useSpring(ballY, { stiffness: 520, damping: 24, mass: 0.24 });

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    // Require mouse + hover; (pointer: fine) alone can match on some phones/tablets
    // and then a tap fires pointermove, leaving the ring stuck at the touch point.
    const desktopPointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (!desktopPointer.matches) return;
    document.documentElement.classList.add('padel-cursor-hidden');

    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      setEnabled(true);
      x.set(event.clientX);
      y.set(event.clientY);
      const target = event.target instanceof Element ? event.target : null;
      setHoveringLink(Boolean(target?.closest('a, button, input, textarea, select, [role="button"]')));

      const maxTravel = target?.closest('a, button, input, textarea, select, [role="button"]') ? 9 : 7;
      const moveBall = (value: number) => Math.max(-maxTravel, Math.min(maxTravel, value * 0.48));
      ballX.set(moveBall(event.movementX));
      ballY.set(moveBall(event.movementY));

      if (resetBallRef.current !== null) {
        window.clearTimeout(resetBallRef.current);
      }
      resetBallRef.current = window.setTimeout(() => {
        ballX.set(0);
        ballY.set(0);
      }, 80);
    };
    const down = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      setPressed(true);
    };
    const up = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      setPressed(false);
    };

    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    return () => {
      document.documentElement.classList.remove('padel-cursor-hidden');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      if (resetBallRef.current !== null) {
        window.clearTimeout(resetBallRef.current);
      }
    };
  }, [ballX, ballY, reduceMotion, x, y]);

  if (!mounted || !enabled) return null;

  return createPortal(
    <motion.div
      aria-hidden
      className="cursor-ring pointer-events-none fixed left-0 top-0 z-[140]"
      style={{ x: springX, y: springY }}
    >
      <motion.span
        className="cursor-ring__circle"
        animate={{
          scale: pressed ? 0.7 : hoveringLink ? 1.7 : 1,
          opacity: hoveringLink ? 0.95 : 0.8,
        }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.span
        className="cursor-ring__dot"
        animate={{ scale: pressed ? 0.72 : hoveringLink ? 0.86 : 1 }}
        style={{ x: springBallX, y: springBallY }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      />
    </motion.div>,
    document.body,
  );
}

export function FilmGrain() {
  return <div className="film-grain" aria-hidden />;
}

export function PageSurface() {
  const coarse = useCoarsePointer();
  const reduceMotion = useReducedMotion();
  const animateAurora = !coarse && !reduceMotion;

  return (
    <div className="page-surface" aria-hidden>
      <div className="page-surface__gradient" />
      <div className="page-surface__aurora aurora">
        {animateAurora ? (
          <>
            <motion.div
              className="aurora-orb aurora-orb--a page-surface__aurora-a"
              aria-hidden
              animate={{
                x: ['0rem', '6rem', '0rem'],
                y: ['0rem', '4rem', '0rem'],
                scale: [1, 1.14, 1],
              }}
              transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="aurora-orb aurora-orb--b page-surface__aurora-b"
              aria-hidden
              animate={{
                x: ['0rem', '-5rem', '0rem'],
                y: ['0rem', '-3rem', '0rem'],
                scale: [1.05, 0.9, 1.05],
              }}
              transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
            />
          </>
        ) : null}
      </div>
      <div className="page-surface__sheen" />
    </div>
  );
}

export function PageProgress() {
  const scrollParallax = useScrollParallaxEnabled();
  const { scrollYProgress } = useScroll();
  const glowOpacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.35, 0.7, 1]);

  return (
    <>
      <motion.div
        aria-hidden
        className="page-progress fixed left-0 top-0 z-[90] h-[3px] w-full origin-left"
        style={{ scaleX: scrollYProgress }}
      />
      {scrollParallax ? (
        <motion.div
          aria-hidden
          className="page-progress__glow pointer-events-none fixed left-0 top-0 z-[89] h-8 w-full origin-left"
          style={{ scaleX: scrollYProgress, opacity: glowOpacity }}
        />
      ) : null}
    </>
  );
}
