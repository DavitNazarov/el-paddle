'use client';

import Image from 'next/image';
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'framer-motion';
import {
  CalendarDays,
  ChevronDown,
  MapPin,
} from 'lucide-react';
import { PadelBall3D } from '../PadelBall3D';
import { useI18n } from '@/components/shared/I18nProvider';
import { ScrollSection } from './scroll';

export function Hero() {
  const reduceMotion = useReducedMotion();
  const { dictionary } = useI18n();
  const hero = dictionary.home.hero;
  const { scrollYProgress } = useScroll();
  const ballY = useTransform(scrollYProgress, [0, 0.25], [0, 92]);
  const brandY = useTransform(scrollYProgress, [0, 0.18], [0, -36]);
  const footerY = useTransform(scrollYProgress, [0, 0.22], [0, 30]);

  return (
    <ScrollSection
      id="top"
      className="poster-hero relative isolate h-dvh min-h-[640px] overflow-x-clip px-4 pb-28 pt-20 text-[var(--padel-ivory)] md:min-h-[720px] md:px-10 md:pb-24 md:pt-24 lg:h-[860px] lg:min-h-[860px]"
    >
      <div className="poster-vignette absolute inset-0 -z-10" aria-hidden />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        style={reduceMotion ? undefined : { y: brandY }}
        className="relative z-10 mx-auto flex max-w-5xl flex-col items-center text-center"
      >
        <Image
          src="/images/el-padel-logo.png"
          alt="El Padel — gold matador crest"
          width={360}
          height={240}
          priority
          className="hero-crest h-auto w-[188px] object-contain md:w-[228px]"
        />
        <p className="font-display -mt-1 text-[0.7rem] font-semibold uppercase tracking-[0.38em] text-[var(--padel-gold)] md:text-xs">
          {hero.subtitle}
        </p>
        <div className="hero-chips mt-3 flex flex-wrap items-center justify-center gap-1.5">
          {hero.chips.slice(0, 3).map((chip) => (
            <span key={chip} className="hero-chip">
              {chip}
            </span>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, scale: 0.94, y: 24 }}
        animate={reduceMotion ? undefined : { opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.92, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        style={reduceMotion ? undefined : { y: ballY }}
        className="poster-ball-wrap pointer-events-auto relative z-20 mx-auto mt-2 aspect-square w-full max-w-[480px] md:mt-3"
      >
        <PadelBall3D className="poster-ball-canvas" />
        <div className="poster-ball-copy pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-center">
          <h1 className="font-display max-w-[15ch] text-2xl font-bold uppercase leading-[1.2] text-[var(--padel-red)] sm:text-3xl md:text-4xl">
            {hero.titleLines.map((line, index) => (
              <span key={line} className="hero-title-line">
                <motion.span
                  className="hero-title-line__inner"
                  initial={reduceMotion ? false : { y: '112%' }}
                  animate={reduceMotion ? undefined : { y: '0%' }}
                  transition={{
                    duration: 0.85,
                    delay: 0.34 + index * 0.09,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>
        </div>
      </motion.div>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
        animate={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
        transition={{ duration: 0.9, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="hero-badge absolute right-[7%] top-[30%] z-10 hidden xl:block"
        aria-hidden
      >
        <svg viewBox="0 0 120 120" className="hero-badge__svg">
          <defs>
            <path
              id="hero-badge-circle"
              d="M60,60 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0"
            />
          </defs>
          <text className="hero-badge__text">
            <textPath href="#hero-badge-circle">
              {hero.badge}
            </textPath>
          </text>
        </svg>
        <span className="hero-badge__star">✦</span>
      </motion.div>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.72, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
        style={reduceMotion ? undefined : { y: footerY }}
        className="poster-footer relative z-0 mx-auto mt-6 grid w-full max-w-7xl gap-4 md:absolute md:inset-x-10 md:bottom-4 md:mt-0 md:w-auto md:grid-cols-[minmax(0,1fr)_4.5rem_minmax(0,1fr)] md:items-end md:gap-0 lg:grid-cols-[minmax(0,1fr)_5.5rem_minmax(0,1fr)]"
      >
        <div className="poster-meta glass-card min-w-0 w-full justify-self-start border border-[var(--padel-line)] p-4 backdrop-blur-sm md:max-w-sm">
          <p className="mb-2 flex items-center gap-2 text-[0.58rem] font-semibold uppercase tracking-[0.28em] text-[var(--padel-gold)]">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">{hero.days}</span>
          </p>
          <div className="flex items-end justify-between gap-3 pr-1">
            <span className="font-display text-xl font-light leading-none md:text-2xl">TBA</span>
            <span className="font-display text-lg font-light lowercase leading-none md:text-xl">{hero.year}</span>
          </div>
          <span className="poster-meta__bar mt-3 block h-px w-full" />
        </div>

        <div className="hidden md:block" aria-hidden />

        <div className="poster-meta glass-card min-w-0 w-full justify-self-end border border-[var(--padel-line)] p-4 backdrop-blur-sm md:max-w-md md:text-right">
          <span className="poster-meta__bar mb-3 block h-px w-full" />
          <p className="mb-2 flex items-center gap-2 text-[0.58rem] font-semibold uppercase tracking-[0.28em] text-[var(--padel-gold)] md:justify-end">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">{hero.venue}</span>
          </p>
          <p className="font-display text-base font-light uppercase leading-tight break-words sm:text-lg md:text-xl">
            <strong className="font-extrabold">KUS TBA Padel</strong> Courts
          </p>
        </div>
      </motion.div>

      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: reduceMotion ? 1 : [0.3, 1, 0.3] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        className="scroll-cue pointer-events-none absolute bottom-3 left-1/2 z-20 hidden -translate-x-1/2 flex-col items-center gap-2 text-[0.62rem] font-semibold uppercase tracking-[0.4em] text-[var(--padel-muted)] md:flex"
      >
        {hero.scroll}
        <span className="scroll-cue__track flex h-10 w-6 items-start justify-center rounded-full border border-[var(--padel-line)] p-1">
          <motion.span
            className="scroll-cue__dot h-2 w-1 rounded-full bg-[var(--padel-gold)]"
            animate={reduceMotion ? undefined : { y: [0, 14, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        </span>
        <ChevronDown className="h-4 w-4 text-[var(--padel-gold)]/70" aria-hidden />
      </motion.div>
    </ScrollSection>
  );
}
