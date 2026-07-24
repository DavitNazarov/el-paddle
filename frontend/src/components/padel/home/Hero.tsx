'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { useI18n } from '@/components/shared/I18nProvider';
import { useCoarsePointer } from './device';
import { ScrollSection } from './scroll';

const easeOut = [0.16, 1, 0.3, 1] as const;

export function Hero() {
  const reduceMotion = useReducedMotion();
  const coarse = useCoarsePointer();
  const { dictionary } = useI18n();
  const hero = dictionary.home.hero;
  const skipIntro = Boolean(reduceMotion);
  // Phones get the same intro, just tighter so content settles quickly.
  const speed = coarse ? 0.72 : 1;

  return (
    <ScrollSection
      id="top"
      className="poster-hero relative isolate flex min-h-[100svh] items-center justify-center overflow-hidden px-5 py-24 text-[var(--padel-ivory)] md:px-10"
    >
      {/* Ambient loops run as CSS keyframes: compositor-driven, smooth in
          Safari, and disabled by the global reduced-motion rules. */}
      <div className="hero-ambient pointer-events-none absolute inset-0 z-0" aria-hidden>
        <span className="hero-ambient__glow" />
        <span className="hero-ambient__beam" />
        <span className="hero-ambient__sweep" />
      </div>

      <motion.div
        className="relative z-10 flex w-full max-w-3xl flex-col items-center text-center"
      >
        <motion.div
          className="hero-logo-stage relative grid place-items-center"
          initial={skipIntro ? false : { opacity: 0, scale: 0.82, y: coarse ? 18 : 28 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={skipIntro ? { duration: 0 } : { duration: 1.05 * speed, ease: easeOut }}
        >
          <span className="hero-logo-orbit hero-logo-orbit--outer" aria-hidden />
          <span className="hero-logo-orbit hero-logo-orbit--inner" aria-hidden />
          <div className="hero-logo-float">
            <Image
              src="/images/el-padel-logo.png"
              alt="El Padel"
              width={360}
              height={240}
              priority
              className="hero-logo-image h-auto w-[220px] object-contain sm:w-[260px] md:w-[310px]"
            />
          </div>
        </motion.div>

        <motion.span
          className="hero-gold-line mt-1 block h-px w-24 origin-center sm:w-32"
          initial={skipIntro ? false : { opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={skipIntro ? { duration: 0 } : { duration: 0.9 * speed, delay: 0.38 * speed, ease: easeOut }}
          aria-hidden
        />
        <motion.h1
          className="font-display mt-5 text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-[var(--padel-gold)] sm:text-xs"
          initial={skipIntro ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={skipIntro ? { duration: 0 } : { duration: 0.8 * speed, delay: 0.48 * speed, ease: easeOut }}
        >
          <span className="sr-only">El Padel. </span>
          {hero.subtitle}
        </motion.h1>
        <motion.p
          className="mt-3 max-w-md text-xs font-medium leading-5 text-[var(--padel-muted)] sm:text-sm"
          initial={skipIntro ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={skipIntro ? { duration: 0 } : { duration: 0.72 * speed, delay: 0.66 * speed, ease: easeOut }}
        >
          {hero.status}
        </motion.p>
      </motion.div>
    </ScrollSection>
  );
}
