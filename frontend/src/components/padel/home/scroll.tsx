'use client';

import {
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  animate,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from 'framer-motion';
import { useI18n } from '@/components/shared/I18nProvider';
import { snapStops, type SnapStopId } from './constants';
import { WordReveal } from './motion';

export function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0] ?? '');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const update = () => {
      const anchor = window.scrollY + window.innerHeight * 0.42;
      let current = ids[0] ?? '';
      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el && el.offsetTop <= anchor) current = id;
      });
      setActive((previous) => (previous === current ? previous : current));
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
    // ids is a stable module-level array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return active;
}

export function SnapScrollController() {
  const reduceMotion = useReducedMotion();
  const { dictionary } = useI18n();
  const { scrollY } = useScroll();
  const [activeSection, setActiveSection] = useState<SnapStopId>(snapStops[0].id);
  const snapAnimation = useRef<{ stop: () => void } | null>(null);

  const readActiveSection = useCallback((): SnapStopId => {
    if (typeof window === 'undefined') return snapStops[0].id;

    const anchorPoint = window.scrollY + window.innerHeight * 0.44;
    let current: SnapStopId = snapStops[0].id;

    snapStops.forEach((stop) => {
      const section = document.getElementById(stop.id);
      if (!section) return;
      if (section.offsetTop <= anchorPoint) {
        current = stop.id;
      }
    });

    return current;
  }, []);

  const snapToSection = useCallback(
    (id: string) => {
      const section = document.getElementById(id);
      if (!section) return;

      snapAnimation.current?.stop();
      const targetTop = section.offsetTop;

      if (reduceMotion) {
        window.scrollTo({ top: targetTop, behavior: 'auto' });
        return;
      }

      const startY = window.scrollY;
      const distance = Math.abs(targetTop - startY);
      // Duration scales gently with distance, capped so far jumps stay snappy.
      const duration = Math.min(1.1, 0.5 + (distance / window.innerHeight) * 0.11);

      snapAnimation.current = animate(startY, targetTop, {
        duration,
        ease: [0.22, 1, 0.36, 1],
        onUpdate: (latest) =>
          window.scrollTo({ top: latest, behavior: 'instant' as ScrollBehavior }),
      });
    },
    [reduceMotion],
  );

  useMotionValueEvent(scrollY, 'change', () => {
    const current = readActiveSection();
    setActiveSection((previous) => (previous === current ? previous : current));
  });

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setActiveSection(readActiveSection());
    });
    return () => {
      window.cancelAnimationFrame(frame);
      snapAnimation.current?.stop();
    };
  }, [readActiveSection]);

  useEffect(() => {
    const handleAnchorClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest('a[href^="#"]');
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const href = anchor.getAttribute('href');
      if (!href || href === '#') return;

      const id = decodeURIComponent(href.slice(1));
      if (!document.getElementById(id)) return;

      event.preventDefault();
      window.history.pushState(null, '', href);
      snapToSection(id);
    };

    document.addEventListener('click', handleAnchorClick);
    return () => document.removeEventListener('click', handleAnchorClick);
  }, [snapToSection]);

  return (
    <nav className="snap-indicator" aria-label={dictionary.home.a11y.sectionNavigation}>
      {snapStops.map((stop) => {
        const isActive = activeSection === stop.id;
        const label = dictionary.home.snap[stop.key];
        return (
          <button
            key={stop.id}
            type="button"
            aria-label={`${label}`}
            aria-current={isActive ? 'true' : undefined}
            className="snap-indicator__dot"
            onClick={() => {
              window.history.pushState(null, '', `#${stop.id}`);
              snapToSection(stop.id);
            }}
          >
            <span className="snap-indicator__label">{label}</span>
            <motion.span
              className="snap-indicator__mark"
              animate={{
                opacity: isActive ? 1 : 0.42,
                scale: isActive ? 1.25 : 1,
              }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            />
          </button>
        );
      })}
    </nav>
  );
}

export function ScrollSection({
  children,
  className = '',
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`scroll-section ${className}`}>
      {children}
    </section>
  );
}

export function SectionIntro({
  index,
  kicker,
  title,
  accent,
  copy,
  align = 'left',
}: {
  index?: string;
  kicker: string;
  title: string;
  accent?: string;
  copy?: string;
  align?: 'left' | 'center';
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div className={align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
      <div
        className={`section-intro-frame ${align === 'center' ? 'section-intro-frame--center' : ''}`}
      >
      <p
        className={`section-kicker mb-3 flex items-center gap-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[var(--padel-gold)] ${
          align === 'center' ? 'justify-center' : ''
        }`}
      >
        {index ? <span className="section-kicker__index">{index}</span> : null}
        {kicker}
        <motion.span
          className="section-kicker__rule"
          aria-hidden
          initial={reduceMotion ? false : { scaleX: 0, opacity: 0 }}
          whileInView={{ scaleX: 1, opacity: 0.55 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.7, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          style={{ originX: 0 }}
        />
      </p>
      <h2 className="font-display text-2xl font-semibold leading-[1.15] text-[var(--padel-ivory)] sm:text-3xl md:text-4xl">
        <WordReveal text={title} />
        {accent ? (
          <>
            {' '}
            <WordReveal text={accent} delay={0.18} className="section-accent" />
          </>
        ) : null}
      </h2>
      {copy ? (
        <motion.p
          className={`mt-3 max-w-xl text-sm leading-6 text-[var(--padel-muted)] md:text-[0.95rem] md:leading-7 ${
            align === 'center' ? 'mx-auto' : ''
          }`}
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          {copy}
        </motion.p>
      ) : null}
      </div>
    </div>
  );
}
