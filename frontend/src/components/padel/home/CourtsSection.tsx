'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { useI18n } from '@/components/shared/I18nProvider';
import { Reveal } from './motion';
import { ScrollSection, SectionIntro } from './scroll';

export const COURT_STAGE = [
  {
    src: '/images/el-padel-courts-aerial-close.jpg',
    position: 'center 45%',
  },
  {
    src: '/images/el-padel-courts-aerial-top.jpg',
    position: 'center center',
  },
  {
    src: '/images/el-padel-courts-aerial-city.png',
    position: 'center 70%',
  },
  {
    src: '/images/el-padel-courts-aerial-lake.png',
    position: 'center 55%',
  },
] as const;

export function CourtsLightbox({
  open,
  index,
  onClose,
  onChange,
  shots,
}: {
  open: boolean;
  index: number;
  onClose: () => void;
  onChange: (index: number) => void;
  shots: Array<{ src: string; alt: string; label: string; position: string }>;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { dictionary, t } = useI18n();
  const courts = dictionary.home.courts;
  const reduceMotion = useReducedMotion();
  const active = shots[index];
  const total = shots.length;
  const [mounted, setMounted] = useState(false);
  const [direction, setDirection] = useState(1);
  const slideEase = [0.22, 1, 0.36, 1] as const;

  const goTo = useCallback(
    (nextIndex: number, dir: number) => {
      setDirection(dir);
      onChange(nextIndex);
    },
    [onChange],
  );

  const showPrev = useCallback(() => {
    goTo((index - 1 + total) % total, -1);
  }, [goTo, index, total]);

  const showNext = useCallback(() => {
    goTo((index + 1) % total, 1);
  }, [goTo, index, total]);

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') showPrev();
      if (event.key === 'ArrowRight') showNext();
    };
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    window.addEventListener('keydown', handleKey);
    return () => {
      document.documentElement.style.overflow = previousOverflow;
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose, showNext, showPrev]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && active ? (
        <motion.div
          className="courts-lightbox fixed inset-0 z-[130] flex items-center justify-center p-4 md:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
          role="dialog"
          aria-modal="true"
          aria-label={active.label}
        >
          <button
            type="button"
            className="courts-lightbox__backdrop absolute inset-0"
            aria-label={courts.closePhoto}
            onClick={onClose}
          />

          <motion.div
            className="courts-lightbox__panel relative z-10 flex w-full max-w-6xl flex-col"
            initial={{ opacity: 0, scale: 0.96, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="courts-lightbox__toolbar">
              <p className="courts-lightbox__title">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <span>{active.label}</span>
              </p>
              <div className="flex items-center gap-2">
                <span className="courts-lightbox__count">
                  {t('home.courts.photoOf', { current: index + 1, total })}
                </span>
                <button
                  ref={closeButtonRef}
                  type="button"
                  aria-label={courts.closePhoto}
                  onClick={onClose}
                  className="courts-lightbox__icon-btn"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="courts-lightbox__stage">
              <AnimatePresence initial={false} custom={direction} mode="popLayout">
                <motion.div
                  key={active.src}
                  className="courts-lightbox__shot"
                  custom={direction}
                  variants={{
                    enter: (dir: number) =>
                      reduceMotion
                        ? { opacity: 0, x: 0, scale: 1 }
                        : { opacity: 0, x: dir * 72, scale: 1.02 },
                    center: { opacity: 1, x: 0, scale: 1 },
                    exit: (dir: number) =>
                      reduceMotion
                        ? { opacity: 0, x: 0, scale: 1 }
                        : { opacity: 0, x: dir * -56, scale: 0.985 },
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.48, ease: slideEase }}
                >
                  <Image
                    src={active.src}
                    alt={active.alt}
                    fill
                    sizes="(max-width: 1024px) 94vw, 72vw"
                    className="object-contain"
                    style={{ objectPosition: active.position }}
                    priority
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="courts-lightbox__nav">
              <button
                type="button"
                aria-label={courts.previousPhoto}
                onClick={showPrev}
                className="courts-lightbox__icon-btn"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label={courts.nextPhoto}
                onClick={showNext}
                className="courts-lightbox__icon-btn"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

export function CourtsSection() {
  const { dictionary } = useI18n();
  const courts = dictionary.home.courts;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const shots = [
    {
      ...COURT_STAGE[0],
      alt: courts.heroAlt,
      label: courts.caption,
    },
    ...COURT_STAGE.slice(1).map((shot, index) => ({
      ...shot,
      alt: courts.galleryAlts[index],
      label: courts.galleryLabels[index],
    })),
  ];

  return (
    <ScrollSection
      id="courts"
      className="section-tight relative overflow-hidden px-5 md:px-10"
    >
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <div className="max-w-3xl">
            <SectionIntro
              index={courts.index}
              kicker={courts.kicker}
              title={courts.title}
              accent={courts.accent}
              copy={courts.copy}
            />
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div
            className="courts-stage mt-8"
            role="group"
            aria-label={courts.galleryLabel}
          >
            <figure className="courts-stage__hero">
              <button
                type="button"
                className="courts-stage__media courts-stage__hero-media courts-stage__trigger"
                aria-label={`${courts.openPhoto}: ${courts.caption}`}
                onClick={() => setActiveIndex(0)}
              >
                <Image
                  src={shots[0].src}
                  alt={shots[0].alt}
                  fill
                  sizes="(max-width: 1024px) 100vw, 68vw"
                  className="courts-stage__img object-cover"
                  style={{ objectPosition: shots[0].position }}
                  priority
                />
                <div className="courts-stage__meta">
                  <span>01</span>
                  <span>{courts.caption}</span>
                </div>
              </button>
            </figure>

            <div className="courts-stage__rail">
              {shots.slice(1).map((shot, index) => (
                <figure key={shot.src} className="courts-stage__shot">
                  <button
                    type="button"
                    className="courts-stage__media courts-stage__shot-media courts-stage__trigger"
                    aria-label={`${courts.openPhoto}: ${shot.label}`}
                    onClick={() => setActiveIndex(index + 1)}
                  >
                    <Image
                      src={shot.src}
                      alt={shot.alt}
                      fill
                      sizes="(max-width: 1024px) 42vw, 22vw"
                      className="courts-stage__img object-cover"
                      style={{ objectPosition: shot.position }}
                    />
                    <div className="courts-stage__meta courts-stage__meta--compact">
                      <span>{String(index + 2).padStart(2, '0')}</span>
                      <span>{shot.label}</span>
                    </div>
                  </button>
                </figure>
              ))}
            </div>
          </div>
        </Reveal>
      </div>

      <CourtsLightbox
        open={activeIndex !== null}
        index={activeIndex ?? 0}
        onClose={() => setActiveIndex(null)}
        onChange={setActiveIndex}
        shots={shots}
      />
    </ScrollSection>
  );
}
