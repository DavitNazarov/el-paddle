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
  useInView,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from 'framer-motion';
import { useI18n } from '@/components/shared/I18nProvider';
import { snapStops, type SnapStopId } from './constants';
import { useCoarsePointer } from './device';
import { WordReveal } from './motion';

const LAZY_VIEW_MARGIN = '100% 0px 100% 0px';
const forcedSectionIds = new Set<string>();
const forceListeners = new Set<() => void>();

/** Mount a deferred section immediately for anchor and hash navigation. */
export function ensureSectionVisible(id: string) {
  if (!id || forcedSectionIds.has(id)) return;
  forcedSectionIds.add(id);
  forceListeners.forEach((listener) => listener());
}

function useForcedSection(id?: string) {
  const [, tick] = useState(0);

  useEffect(() => {
    const listener = () => tick((value) => value + 1);
    forceListeners.add(listener);
    return () => {
      forceListeners.delete(listener);
    };
  }, []);

  return id ? forcedSectionIds.has(id) : false;
}

function waitForSectionReady(id: string): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    ensureSectionVisible(id);
    let attempts = 0;

    const poll = () => {
      const section = document.getElementById(id);
      if (section?.dataset.lazyReady === 'true' && section.scrollHeight > 96) {
        resolve(section);
        return;
      }
      if (attempts >= 120) {
        resolve(section);
        return;
      }
      attempts += 1;
      requestAnimationFrame(poll);
    };

    poll();
  });
}

export function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0] ?? '');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const desktopNavigation = window.matchMedia('(min-width: 1280px)');
    let listening = false;

    const update = () => {
      const anchor = window.scrollY + window.innerHeight * 0.42;
      let current = ids[0] ?? '';
      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el && el.offsetTop <= anchor) current = id;
      });
      setActive((previous) => (previous === current ? previous : current));
    };

    const stop = () => {
      if (!listening) return;
      listening = false;
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };

    const sync = () => {
      if (!desktopNavigation.matches) {
        stop();
        return;
      }
      update();
      if (listening) return;
      listening = true;
      window.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', update);
    };

    sync();
    desktopNavigation.addEventListener('change', sync);
    return () => {
      desktopNavigation.removeEventListener('change', sync);
      stop();
    };
    // ids is a stable module-level array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return active;
}

export function SnapScrollController() {
  const reduceMotion = useReducedMotion();
  const coarse = useCoarsePointer();
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
      const run = (section: HTMLElement) => {
        snapAnimation.current?.stop();
        const targetTop = section.offsetTop;

        if (reduceMotion || coarse) {
          window.scrollTo({ top: targetTop, behavior: 'auto' });
          return;
        }

        const startY = window.scrollY;
        const distance = Math.abs(targetTop - startY);
        const duration = Math.min(1.1, 0.5 + (distance / window.innerHeight) * 0.11);

        snapAnimation.current = animate(startY, targetTop, {
          duration,
          ease: [0.22, 1, 0.36, 1],
          onUpdate: (latest) =>
            window.scrollTo({ top: latest, behavior: 'instant' as ScrollBehavior }),
        });
      };

      void waitForSectionReady(id).then((section) => {
        if (section) run(section);
      });
    },
    [coarse, reduceMotion],
  );

  useMotionValueEvent(scrollY, 'change', () => {
    if (coarse) return;
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
    const hash = window.location.hash.slice(1);
    if (hash) ensureSectionVisible(hash);
  }, []);

  useEffect(() => {
    const handleAnchorClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest('a[href^="#"]');
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const href = anchor.getAttribute('href');
      if (!href || href === '#') return;

      const id = decodeURIComponent(href.slice(1));
      if (!id) return;

      event.preventDefault();
      window.history.pushState(null, '', href);
      snapToSection(id);
    };

    document.addEventListener('click', handleAnchorClick);
    return () => document.removeEventListener('click', handleAnchorClick);
  }, [snapToSection]);

  if (coarse) return null;

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
  const Tag = id ? 'section' : 'div';
  const sectionClass = id
    ? `scroll-section ${className}`.trim()
    : className.trim();
  return (
    <Tag id={id} className={sectionClass || undefined}>
      {children}
    </Tag>
  );
}

/** Viewport gate + code-split slot; keeps anchor id on a shell until content mounts. */
export function ViewportDeferredSection({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const forced = useForcedSection(id);
  const inView = useInView(ref, {
    once: true,
    margin: LAZY_VIEW_MARGIN,
    amount: 0,
  });
  const shouldRender = forced || inView;

  if (!shouldRender) {
    return (
      <section
        ref={ref}
        id={id}
        className="scroll-section scroll-section--placeholder"
        aria-busy
      />
    );
  }

  return (
    <section ref={ref} id={id} className="scroll-section" data-lazy-ready="true">
      {children}
    </section>
  );
}

/** Lazy-mount non-section blocks (marquee, footer). */
export function LazyMount({
  children,
  className = '',
  eager = false,
}: {
  children: ReactNode;
  className?: string;
  /** Preload closer to the viewport (footer). */
  eager?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, {
    once: true,
    margin: eager ? '40% 0px' : '80% 0px',
    amount: 0,
  });

  return (
    <div ref={ref} className={className}>
      {inView ? children : null}
    </div>
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
  const coarse = useCoarsePointer();
  const lightweightMotion = Boolean(reduceMotion || coarse);

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
          initial={lightweightMotion ? false : { scaleX: 0, opacity: 0 }}
          animate={lightweightMotion ? { scaleX: 1, opacity: 0.55 } : undefined}
          whileInView={lightweightMotion ? undefined : { scaleX: 1, opacity: 0.55 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={lightweightMotion ? { duration: 0 } : { duration: 0.7, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
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
          initial={lightweightMotion ? false : { opacity: 0 }}
          animate={lightweightMotion ? { opacity: 1 } : undefined}
          whileInView={lightweightMotion ? undefined : { opacity: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={lightweightMotion ? { duration: 0 } : { duration: 0.6, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          {copy}
        </motion.p>
      ) : null}
      </div>
    </div>
  );
}
