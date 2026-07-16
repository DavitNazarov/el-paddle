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
  const lightweightMotion = Boolean(reduceMotion || coarse);

  return (
    <ScrollSection
      id="top"
      className="poster-hero relative isolate flex min-h-[100svh] items-center justify-center overflow-hidden px-5 py-24 text-[var(--padel-ivory)] md:px-10"
    >
      <div className="hero-ambient pointer-events-none absolute inset-0 z-0" aria-hidden>
        <motion.span
          className="hero-ambient__glow"
          animate={
            lightweightMotion
              ? { opacity: 0.28, scale: 1 }
              : { opacity: [0.2, 0.44, 0.2], scale: [0.88, 1.08, 0.88] }
          }
          transition={lightweightMotion ? { duration: 0 } : { duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.span
          className="hero-ambient__beam"
          initial={lightweightMotion ? false : { opacity: 0, scaleY: 0 }}
          animate={lightweightMotion ? { opacity: 0, scaleY: 0 } : { opacity: [0, 0.6, 0], scaleY: [0, 1, 0] }}
          transition={lightweightMotion ? { duration: 0 } : { duration: 4.8, repeat: Infinity, repeatDelay: 1.5, ease: easeOut }}
        />
        <motion.span
          className="hero-ambient__sweep"
          animate={lightweightMotion ? { x: '0%' } : { x: ['-140%', '140%'] }}
          transition={lightweightMotion ? { duration: 0 } : { duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <motion.div
        className="relative z-10 flex w-full max-w-3xl flex-col items-center text-center"
      >
        <motion.div
          className="hero-logo-stage relative grid place-items-center"
          initial={lightweightMotion ? false : { opacity: 0, scale: 0.78, y: 28 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={lightweightMotion ? { duration: 0 } : { duration: 1.05, ease: easeOut }}
        >
          <motion.span
            className="hero-logo-orbit hero-logo-orbit--outer"
            animate={{ rotate: lightweightMotion ? 0 : 360 }}
            transition={lightweightMotion ? { duration: 0 } : { duration: 22, repeat: Infinity, ease: 'linear' }}
            aria-hidden
          />
          <motion.span
            className="hero-logo-orbit hero-logo-orbit--inner"
            animate={{ rotate: lightweightMotion ? 0 : -360 }}
            transition={lightweightMotion ? { duration: 0 } : { duration: 15, repeat: Infinity, ease: 'linear' }}
            aria-hidden
          />
          <motion.div
            animate={
              lightweightMotion
                ? { y: 0, rotate: 0 }
                : { y: [0, -9, 0], rotate: [0, -0.8, 0, 0.8, 0] }
            }
            transition={lightweightMotion ? { duration: 0 } : { duration: 6.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Image
              src="/images/el-padel-logo.png"
              alt="El Padel"
              width={360}
              height={240}
              priority
              className="hero-logo-image h-auto w-[220px] object-contain sm:w-[260px] md:w-[310px]"
            />
          </motion.div>
        </motion.div>

        <motion.span
          className="hero-gold-line mt-1 block h-px w-24 origin-center sm:w-32"
          initial={lightweightMotion ? false : { opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={lightweightMotion ? { duration: 0 } : { duration: 0.9, delay: 0.38, ease: easeOut }}
          aria-hidden
        />
        <motion.h1
          className="font-display mt-5 text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-[var(--padel-gold)] sm:text-xs"
          initial={lightweightMotion ? false : { opacity: 0, y: 14, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={lightweightMotion ? { duration: 0 } : { duration: 0.8, delay: 0.48, ease: easeOut }}
        >
          {hero.subtitle}
        </motion.h1>
        <motion.p
          className="mt-3 max-w-md text-xs font-medium leading-5 text-[var(--padel-muted)] sm:text-sm"
          initial={lightweightMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={lightweightMotion ? { duration: 0 } : { duration: 0.72, delay: 0.66, ease: easeOut }}
        >
          {hero.status}
        </motion.p>
      </motion.div>
    </ScrollSection>
  );
}
