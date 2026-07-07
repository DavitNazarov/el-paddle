'use client';

import {
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import Image from 'next/image';
import {
  animate,
  AnimatePresence,
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
import {
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  Instagram,
  Mail,
  MapPin,
  Menu,
  Navigation,
  Phone,
  Trophy,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { PadelBall3D } from './PadelBall3D';
import { apiFetch } from '@/lib/api';

const padelVars = {
  '--padel-red': '#8c1916',
  '--padel-red-2': '#6f1210',
  '--padel-red-3': '#3b0605',
  '--padel-ink': '#130202',
  '--padel-ivory': '#f6efe1',
  '--padel-parchment': '#fff5e6',
  '--padel-muted': '#decfbd',
  '--padel-line': 'rgba(246, 239, 225, 0.18)',
  '--padel-line-strong': 'rgba(246, 239, 225, 0.36)',
  '--padel-gold': '#e0c477',
  '--padel-gold-2': '#f2e3ad',
  '--padel-gold-deep': '#a8863c',
  '--padel-ember': '#e0342b',
  '--padel-glow': 'rgba(224, 196, 119, 0.5)',
  '--padel-shadow': '0 30px 90px -30px rgba(0, 0, 0, 0.65)',
  '--padel-shadow-gold': '0 24px 70px -28px rgba(224, 196, 119, 0.35)',
} as CSSProperties;

const navItems = [
  { label: 'About', href: '#about' },
  { label: 'Event', href: '#event' },
  { label: 'Previous', href: '#previous-events' },
  { label: 'Account', href: '#registration' },
  { label: 'Atmosphere', href: '#atmosphere' },
  { label: 'Contact', href: '#contact' },
];

const principles = [
  'Premium casual tone with real competitive tension.',
  'Clear entry flow before players commit.',
  'Editorial visuals built from red, ivory, shadow and restraint.',
];

const flow = [
  {
    step: '01',
    score: '15',
    title: 'Serve your entry',
    copy: 'Create a verified profile, choose an event category and add your teammate by email.',
    tag: 'Verified account',
  },
  {
    step: '02',
    score: '30',
    title: 'We return the ball',
    copy: 'Entry review, draw notes and your schedule window come back within 48 hours by phone or email.',
    tag: 'Confirmed within 48h',
  },
  {
    step: '03',
    score: '40',
    title: 'Walk onto court',
    copy: 'Rhythm, rules and court order are settled before the first warm-up ball. All you bring is your game.',
    tag: 'Match days in July',
  },
] as const;

const scoreCalls = ['Love', '15', '30', '40', 'Game'] as const;

type AtmosphereItem = {
  title: string;
  label: string;
  image?: string;
  className?: string;
};

const atmosphere: AtmosphereItem[] = [
  {
    title: 'Ball Study',
    label: 'Ivory pressure point',
    image: '/images/el-padel-ball-poster.jpeg',
  },
  {
    title: 'Court Lines',
    label: 'Measured tension',
    className: 'poster-court-study',
  },
  {
    title: 'Matador Type',
    label: 'The final point',
    className: 'poster-type-study',
  },
];

const sponsors = ['Aurum Sport', 'Courtline', 'Velvet Energy', 'Urban Padel'];

const snapStops = [
  { id: 'top', label: 'Opening' },
  { id: 'about', label: 'Brand' },
  { id: 'event', label: 'Event' },
  { id: 'previous-events', label: 'Past' },
  { id: 'flow', label: 'Flow' },
  { id: 'registration', label: 'Account' },
  { id: 'atmosphere', label: 'Atmosphere' },
  { id: 'contact', label: 'Contact' },
  { id: 'final', label: 'Final' },
];

const navSectionIds = navItems.map((item) => item.href.slice(1));

/* ------------------------------------------------------------------ */
/* Motion primitives                                                  */
/* ------------------------------------------------------------------ */

function Magnetic({
  children,
  className = '',
  strength = 0.32,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 220, damping: 18, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 220, damping: 18, mass: 0.4 });

  const handleMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (reduceMotion || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set((event.clientX - (rect.left + rect.width / 2)) * strength);
    y.set((event.clientY - (rect.top + rect.height / 2)) * strength);
  };

  const reset = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      style={{ x: springX, y: springY, display: 'inline-flex' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function WordReveal({
  text,
  className = '',
  delay = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();
  const words = text.split(' ');

  if (reduceMotion) {
    return <span className={className}>{text}</span>;
  }

  return (
    <motion.span
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-12%' }}
      transition={{ staggerChildren: 0.055, delayChildren: delay }}
      style={{ display: 'inline' }}
    >
      {words.map((word, index) => (
        <span key={`${word}-${index}`} className="reveal-word">
          <motion.span
            className="reveal-word__inner"
            variants={{
              hidden: { y: '115%' },
              visible: {
                y: '0%',
                transition: { duration: 0.72, ease: [0.16, 1, 0.3, 1] },
              },
            }}
          >
            {word}
          </motion.span>
          {index < words.length - 1 ? '\u00A0' : ''}
        </span>
      ))}
    </motion.span>
  );
}

function Counter({
  to,
  suffix = '',
  duration = 1.6,
}: {
  to: number;
  suffix?: string;
  duration?: number;
}) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-15%' });
  const [value, setValue] = useState(0);
  const displayValue = reduceMotion ? to : value;

  useEffect(() => {
    if (!inView || reduceMotion) return;
    const controls = animate(0, to, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setValue(Math.round(latest)),
    });
    return () => controls.stop();
  }, [inView, to, duration, reduceMotion]);

  return (
    <span ref={ref}>
      {displayValue}
      {suffix}
    </span>
  );
}

function Preloader() {
  const reduceMotion = useReducedMotion();
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
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
  }, [reduceMotion]);

  useEffect(() => {
    if (done || reduceMotion) return;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, [done, reduceMotion]);

  if (reduceMotion) return null;

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
            Every Point Is Honor
          </p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function CursorRing() {
  const reduceMotion = useReducedMotion();
  const [enabled, setEnabled] = useState(false);
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
    if (reduceMotion) return;
    const fine = window.matchMedia('(pointer: fine)');
    if (!fine.matches) return;
    document.documentElement.classList.add('padel-cursor-hidden');

    const move = (event: PointerEvent) => {
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
    const down = () => setPressed(true);
    const up = () => setPressed(false);

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

  if (!enabled) return null;

  return (
    <motion.div
      aria-hidden
      className="cursor-ring pointer-events-none fixed left-0 top-0 z-[110]"
      style={{ x: springX, y: springY }}
    >
      <motion.span
        className="cursor-ring__circle"
        animate={{
          scale: pressed ? 0.7 : hoveringLink ? 1.7 : 1,
          opacity: hoveringLink ? 0.9 : 0.55,
        }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.span
        className="cursor-ring__dot"
        animate={{ scale: pressed ? 0.72 : hoveringLink ? 0.86 : 1 }}
        style={{ x: springBallX, y: springBallY }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      />
    </motion.div>
  );
}

function FilmGrain() {
  return <div className="film-grain" aria-hidden />;
}

const marqueeItems = [
  'El Padel Tournament',
  'Tbilisi Summer Open',
  'Every Point Is Honor',
  'Only One Becomes El Matador',
];

function MarqueeBand({ reverse = false }: { reverse?: boolean }) {
  // Content is repeated so the loop never shows a gap at any viewport width.
  const sequence = [...marqueeItems, ...marqueeItems];

  return (
    <div className="marquee-band" aria-hidden>
      <div className={`marquee-band__track ${reverse ? 'marquee-band__track--reverse' : ''}`}>
        {[0, 1].map((copy) => (
          <div key={copy} className="marquee-band__group">
            {sequence.map((item, index) => (
              <span key={`${copy}-${index}`} className="marquee-band__item font-display">
                {item}
                <span className="marquee-band__star">✦</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Parallax({
  children,
  className = '',
  speed = 0.5,
}: {
  children: ReactNode;
  className?: string;
  speed?: number;
}) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], [speed * 70, speed * -70]);

  return (
    <motion.div
      ref={ref}
      className={`relative ${className}`}
      style={reduceMotion ? undefined : { y }}
    >
      {children}
    </motion.div>
  );
}

function ParallaxLayer({
  className = '',
  speed = 0.6,
  rotate = 0,
}: {
  className?: string;
  speed?: number;
  rotate?: number;
}) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], [speed * 120, speed * -120]);

  return (
    <motion.div
      ref={ref}
      className={className}
      style={reduceMotion ? { rotate } : { y, rotate }}
      aria-hidden
    />
  );
}

function Tilt({
  children,
  className = '',
  max = 5,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springRotateX = useSpring(rotateX, { stiffness: 180, damping: 22 });
  const springRotateY = useSpring(rotateY, { stiffness: 180, damping: 22 });

  const handleMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (reduceMotion || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    rotateX.set(-py * max);
    rotateY.set(px * max);
  };

  const reset = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      style={{
        rotateX: springRotateX,
        rotateY: springRotateY,
        transformStyle: 'preserve-3d',
        perspective: 900,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Structure                                                          */
/* ------------------------------------------------------------------ */

function useActiveSection(ids: string[]) {
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

function SnapScrollController() {
  const reduceMotion = useReducedMotion();
  const { scrollY } = useScroll();
  const [activeSection, setActiveSection] = useState(snapStops[0].id);
  const snapAnimation = useRef<{ stop: () => void } | null>(null);

  const readActiveSection = useCallback(() => {
    if (typeof window === 'undefined') return snapStops[0].id;

    const anchorPoint = window.scrollY + window.innerHeight * 0.44;
    let current = snapStops[0].id;

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
    <nav className="snap-indicator" aria-label="Section navigation">
      {snapStops.map((stop) => {
        const isActive = activeSection === stop.id;
        return (
          <button
            key={stop.id}
            type="button"
            aria-label={`Go to ${stop.label}`}
            aria-current={isActive ? 'true' : undefined}
            className="snap-indicator__dot"
            onClick={() => {
              window.history.pushState(null, '', `#${stop.id}`);
              snapToSection(stop.id);
            }}
          >
            <span className="snap-indicator__label">{stop.label}</span>
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

function ScrollSection({
  children,
  className = '',
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={className}>
      {children}
    </section>
  );
}

function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-90px' }}
      transition={{ duration: 0.64, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionIntro({
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
  return (
    <div className={align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
      <div
        className={`section-intro-frame ${align === 'center' ? 'section-intro-frame--center' : ''}`}
      >
      <p
        className={`section-kicker mb-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.34em] text-[var(--padel-gold)] ${
          align === 'center' ? 'justify-center' : ''
        }`}
      >
        {index ? <span className="section-kicker__index">{index}</span> : null}
        {kicker}
        <span className="section-kicker__rule" aria-hidden />
      </p>
      <h2 className="font-display text-4xl font-semibold leading-[0.98] text-[var(--padel-ivory)] sm:text-5xl sm:leading-[0.95] md:text-6xl lg:text-7xl">
        <WordReveal text={title} />
        {accent ? (
          <>
            {' '}
            <WordReveal text={accent} delay={0.18} className="section-accent" />
          </>
        ) : null}
      </h2>
      {copy ? (
        <p
          className={`mt-6 max-w-2xl text-base leading-8 text-[var(--padel-muted)] md:mt-7 md:text-lg ${
            align === 'center' ? 'mx-auto' : ''
          }`}
        >
          {copy}
        </p>
      ) : null}
      </div>
    </div>
  );
}

function PageProgress() {
  const { scrollYProgress } = useScroll();
  const glowOpacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.35, 0.7, 1]);

  return (
    <>
      <motion.div
        aria-hidden
        className="page-progress fixed left-0 top-0 z-[90] h-[3px] w-full origin-left"
        style={{ scaleX: scrollYProgress }}
      />
      <motion.div
        aria-hidden
        className="page-progress__glow pointer-events-none fixed left-0 top-0 z-[89] h-8 w-full origin-left"
        style={{ scaleX: scrollYProgress, opacity: glowOpacity }}
      />
    </>
  );
}

function SectionCourtDivider() {
  return (
    <div className="court-divider" aria-hidden>
      <span className="court-divider__line" />
      <span className="court-divider__net">
        <span className="court-divider__mesh" />
      </span>
      <span className="court-divider__line" />
    </div>
  );
}

function FloatingEntryBar() {
  const reduceMotion = useReducedMotion();
  const { scrollY } = useScroll();
  const [visible, setVisible] = useState(false);

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setVisible((previous) => {
      const next = latest > window.innerHeight * 0.72;
      return previous === next ? previous : next;
    });
  });

  return (
    <AnimatePresence>
      {visible ? (
        <motion.aside
          initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="floating-entry fixed bottom-5 left-1/2 z-[80] flex w-[min(92vw,26rem)] -translate-x-1/2 items-center gap-3 rounded-full border border-[var(--padel-line-strong)] bg-[var(--padel-ink)]/88 px-3 py-2.5 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl md:bottom-7"
          aria-label="Quick registration"
        >
          <span className="floating-entry__pulse hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--padel-line)] sm:flex">
            <Zap className="h-4 w-4 text-[var(--padel-gold)]" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 pl-1 sm:pl-0">
            <p className="truncate text-[0.58rem] font-semibold uppercase tracking-[0.32em] text-[var(--padel-gold)]">
              Draw filling fast
            </p>
            <p className="truncate text-sm font-medium text-[var(--padel-ivory)]">
              4 team slots remain
            </p>
          </div>
          <Magnetic strength={0.18}>
            <a
              href="/register"
              className="btn-premium inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-[var(--padel-ivory)] px-4 py-2 text-sm font-semibold text-[var(--padel-red)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]"
            >
              Create
              <ArrowRight className="h-4 w-4" />
            </a>
          </Magnetic>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

function BackToTop() {
  const reduceMotion = useReducedMotion();
  const { scrollY } = useScroll();
  const [visible, setVisible] = useState(false);

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setVisible((previous) => {
      const next = latest > window.innerHeight * 1.4;
      return previous === next ? previous : next;
    });
  });

  const scrollUp = () => {
    window.scrollTo({
      top: 0,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  };

  return (
    <AnimatePresence>
      {visible ? (
        <motion.button
          type="button"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          onClick={scrollUp}
          aria-label="Back to top"
          className="back-to-top fixed bottom-5 right-5 z-[75] flex h-12 w-12 items-center justify-center rounded-full border border-[var(--padel-line-strong)] bg-[var(--padel-ink)]/80 text-[var(--padel-ivory)] backdrop-blur-md transition-colors duration-200 hover:border-[var(--padel-gold)] hover:text-[var(--padel-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)] md:bottom-7 md:right-7"
        >
          <ArrowUp className="h-5 w-5" />
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}

function MobileMenu({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.documentElement.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    window.addEventListener('keydown', handleKey);
    return () => {
      document.documentElement.style.overflow = '';
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="mobile-menu fixed inset-0 z-[100] flex flex-col overflow-y-auto bg-[var(--padel-ink)] px-5 pb-10 pt-24 sm:px-6"
          initial={{ clipPath: 'inset(0 0 100% 0)' }}
          animate={{ clipPath: 'inset(0 0 0% 0)' }}
          exit={{ clipPath: 'inset(0 0 100% 0)' }}
          transition={{ duration: 0.55, ease: [0.76, 0, 0.24, 1] }}
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
        >
          <div className="mobile-menu__lines" aria-hidden />
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--padel-line)] text-[var(--padel-ivory)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]"
          >
            <X className="h-5 w-5" />
          </button>

          <nav aria-label="Mobile navigation" className="mt-4 flex flex-1 flex-col justify-center gap-1">
            {navItems.map((item, index) => (
              <motion.a
                key={item.href}
                href={item.href}
                onClick={onClose}
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.55,
                  delay: 0.18 + index * 0.06,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="mobile-menu__link font-display flex items-baseline gap-4 border-b border-[var(--padel-line)] py-5 text-4xl font-semibold text-[var(--padel-ivory)]"
              >
                <span className="text-xs font-semibold tracking-[0.3em] text-[var(--padel-gold)]">
                  {`0${index + 1}`}
                </span>
                {item.label}
              </motion.a>
            ))}
          </nav>

          <motion.a
            href="/register"
            onClick={onClose}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="btn-premium mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--padel-ivory)] px-6 py-3.5 text-base font-semibold text-[var(--padel-red)]"
          >
            Create account
            <ArrowRight className="h-5 w-5" />
          </motion.a>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.62 }}
            className="mt-6 flex items-center justify-between gap-4 border-t border-[var(--padel-line)] pt-5 text-sm font-medium text-[var(--padel-muted)]"
          >
            <a
              href="tel:+995555000000"
              className="inline-flex min-h-11 items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]"
            >
              <Phone className="h-4 w-4 text-[var(--padel-gold)]" />
              +995 555 000 000
            </a>
            <a
              href="https://www.instagram.com/"
              aria-label="El Padel on Instagram"
              className="inline-flex min-h-11 items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]"
            >
              <Instagram className="h-4 w-4 text-[var(--padel-gold)]" />
              Instagram
            </a>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function PadelNav() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const active = useActiveSection(navSectionIds);

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setScrolled((previous) => {
      const next = latest > 24;
      return previous === next ? previous : next;
    });
  });

  return (
    <header className="padel-nav-header fixed inset-x-0 top-0 z-[70] px-3 pt-3 md:px-6 md:pt-5">
      <motion.div
        animate={{
          backgroundColor: scrolled ? 'rgba(19,2,2,0.62)' : 'rgba(19,2,2,0.28)',
          boxShadow: scrolled
            ? '0 22px 80px rgba(0,0,0,0.4)'
            : '0 18px 70px rgba(0,0,0,0.18)',
        }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 rounded-full border border-[var(--padel-line)] px-3 text-[var(--padel-ivory)] backdrop-blur-xl md:h-16 md:px-4 nav-shell"
      >
        <a
          href="#top"
          aria-label="El Padel Tournament home"
          className="flex min-h-11 items-center gap-2.5 rounded-full pl-1 pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]"
        >
          <Image
            src="/images/el-padel-logo-mark.png"
            alt="El Padel"
            width={44}
            height={44}
            priority
            className="h-9 w-9 object-contain md:h-10 md:w-10"
          />
          <span className="gold-ink font-display hidden text-[0.82rem] font-semibold uppercase tracking-[0.34em] sm:inline">
            El Padel
          </span>
        </a>

        <nav aria-label="Primary navigation" className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => {
            const isActive = active === item.href.slice(1);
            return (
              <a
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'true' : undefined}
                className="nav-link group relative rounded-full px-4 py-2 text-sm font-medium text-[var(--padel-muted)] transition-colors duration-200 hover:text-[var(--padel-ivory)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]"
              >
                <span className={isActive ? 'text-[var(--padel-ivory)]' : ''}>
                  {item.label}
                </span>
                <span
                  className={`nav-link__underline absolute bottom-1 left-4 right-4 h-px origin-left bg-[var(--padel-gold)] transition-transform duration-300 ${
                    isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                  }`}
                  aria-hidden
                />
                {isActive ? (
                  <motion.span
                    layoutId="nav-active-pill"
                    className="absolute inset-0 -z-10 rounded-full border border-[var(--padel-line-strong)] bg-[var(--padel-ivory)]/[0.08]"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                ) : null}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Magnetic strength={0.22}>
            <a
              href="/register"
              className="btn-premium group hidden min-h-11 items-center gap-2 rounded-full bg-[var(--padel-ivory)] px-4 py-2.5 text-sm font-semibold text-[var(--padel-red)] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)] sm:inline-flex md:px-5"
            >
              Create account
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </a>
          </Magnetic>

          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--padel-line)] text-[var(--padel-ivory)] transition-colors duration-200 hover:border-[var(--padel-line-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)] lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </motion.div>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </header>
  );
}

const heroTitleLines = ['Take part', 'in the padel', 'tournament!'];

function Hero() {
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const ballY = useTransform(scrollYProgress, [0, 0.25], [0, 92]);
  const brandY = useTransform(scrollYProgress, [0, 0.18], [0, -36]);
  const footerY = useTransform(scrollYProgress, [0, 0.22], [0, 30]);

  return (
    <ScrollSection
      id="top"
      className="poster-hero relative isolate h-dvh min-h-[640px] overflow-hidden px-4 pb-36 pt-24 text-[var(--padel-ivory)] md:px-10 md:pb-32 md:pt-28"
    >
      <div className="aurora" aria-hidden />
      <div className="premium-noise absolute inset-0 -z-10" aria-hidden />
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
          className="hero-crest h-auto w-[190px] object-contain md:w-[230px]"
        />
        <p className="font-display -mt-2 text-sm font-semibold uppercase tracking-[0.62em] text-[var(--padel-gold)] md:text-base">
          Tournament
        </p>
        <div className="hero-chips mt-5 flex flex-wrap items-center justify-center gap-2">
          {['Tbilisi', 'Summer Open', '2026'].map((chip) => (
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
        className="poster-ball-wrap pointer-events-auto relative z-10 mx-auto mt-4 aspect-square w-full max-w-[620px] md:mt-5"
      >
        <PadelBall3D className="poster-ball-canvas" />
        <div className="poster-ball-copy pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-center">
          <h1 className="font-display max-w-[15ch] text-3xl font-bold uppercase leading-[1.22] text-[var(--padel-red)] sm:text-4xl md:text-5xl">
            {heroTitleLines.map((line, index) => (
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
              EL PADEL TOURNAMENT · TBILISI · SUMMER OPEN ·
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
        className="poster-footer absolute bottom-5 left-4 right-4 z-10 mx-auto grid max-w-7xl gap-6 md:bottom-8 md:left-10 md:right-10 md:grid-cols-2"
      >
        <div className="poster-meta glass-card md:max-w-md border border-[var(--padel-line)] p-5 backdrop-blur-sm">
          <p className="mb-3 flex items-center gap-2 text-[0.62rem] font-semibold uppercase tracking-[0.4em] text-[var(--padel-gold)]">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            Match days
          </p>
          <div className="flex items-end justify-between gap-6 pr-2">
            <span className="font-display text-3xl font-light leading-none md:text-4xl">00 - 00</span>
            <span className="font-display text-2xl font-light lowercase leading-none md:text-3xl">july</span>
          </div>
          <span className="poster-meta__bar mt-5 block h-1 w-full" />
        </div>

        <div className="poster-meta glass-card md:ml-auto md:max-w-xl md:self-end md:text-right border border-[var(--padel-line)] p-5 backdrop-blur-sm">
          <span className="poster-meta__bar mb-5 block h-1 w-full" />
          <p className="mb-3 flex items-center gap-2 text-[0.62rem] font-semibold uppercase tracking-[0.4em] text-[var(--padel-gold)] md:justify-end">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            Venue
          </p>
          <p className="font-display text-2xl font-light uppercase leading-tight md:text-3xl">
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
        Scroll
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

function AboutSection() {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ['-6%', '6%']);
  const imageScale = useTransform(scrollYProgress, [0, 0.5, 1], [1.08, 1.02, 1.08]);

  return (
    <ScrollSection
      id="about"
      className="section-pad relative overflow-hidden bg-[var(--padel-ink)] px-5 md:px-10"
    >
      <ParallaxLayer className="section-orbit section-orbit--left" speed={0.55} rotate={18} />
      <div className="mx-auto grid max-w-7xl gap-16 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:gap-24">
        <Reveal>
          <div ref={ref} className="poster-frame">
            <span className="poster-frame__tick poster-frame__tick--tl" aria-hidden />
            <span className="poster-frame__tick poster-frame__tick--tr" aria-hidden />
            <span className="poster-frame__tick poster-frame__tick--bl" aria-hidden />
            <span className="poster-frame__tick poster-frame__tick--br" aria-hidden />
            <div className="poster-frame__media">
              <motion.div
                className="poster-frame__inner"
                style={reduceMotion ? undefined : { y: imageY, scale: imageScale }}
              >
                <Image
                  src="/images/el-padel-player-poster.jpeg"
                  alt="El Padel — Every match is a battle, every point is honor. Only one becomes El Matador."
                  fill
                  sizes="(max-width: 1024px) 90vw, 45vw"
                  className="object-cover"
                />
              </motion.div>
            </div>
            <span className="poster-frame__caption">Fig. 01 — El Matador</span>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <Parallax speed={0.18}>
          <div>
            <SectionIntro
              index="01"
              kicker="Brand feeling"
              title="Sport with posture,"
              accent="not noise."
              copy="The identity takes the matador reference mood and turns it into a restrained tournament system: deep red fields, ivory lines, tactile ball texture and confident editorial type."
            />

            <div className="mt-16 divide-y divide-[var(--padel-line)] border-y border-[var(--padel-line)]">
              {principles.map((item, index) => (
                <motion.div
                  key={item}
                  initial={{ opacity: 0, x: 22 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ duration: 0.5, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  className="principle-row flex min-h-20 items-center gap-6 py-6"
                >
                  <span className="principle-row__num font-display shrink-0 text-2xl font-semibold italic text-[var(--padel-gold)]/60 transition-colors duration-300">
                    {`0${index + 1}`}
                  </span>
                  <p className="text-base leading-7 text-[var(--padel-muted)] transition-colors duration-300">
                    {item}
                  </p>
                  <Check className="principle-row__check ml-auto h-4 w-4 shrink-0 text-[var(--padel-gold)]" />
                </motion.div>
              ))}
            </div>

            <p className="font-script mt-14 text-4xl leading-tight text-[var(--padel-gold)] md:text-5xl">
              Every point is honor.
            </p>
          </div>
          </Parallax>
        </Reveal>
      </div>
    </ScrollSection>
  );
}

type PublicCategory = {
  id: string;
  name: string;
  description: string;
};

type PublicEvent = {
  id: string;
  title: string;
  date: string;
  location: string;
  description: string;
  categories: PublicCategory[];
};

type PublicEventsPayload = {
  upcoming: PublicEvent | null;
  previous: PublicEvent[];
};

const fallbackUpcomingEvent: PublicEvent = {
  id: 'fallback-upcoming',
  title: 'Next El Padel Event',
  date: new Date('2026-07-24T18:00:00').toISOString(),
  location: 'KUS TBA Padel Courts',
  description:
    'The next public event appears here when the admin publishes it. Create your account now so registration is ready when categories open.',
  categories: [
    { id: 'pro', name: 'Pro', description: '' },
    { id: 'amateur', name: 'Amateur', description: '' },
    { id: 'mixed', name: 'Mixed', description: '' },
  ],
};

function formatEventDate(date: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

function usePublicEvents() {
  const [payload, setPayload] = useState<PublicEventsPayload>({
    upcoming: null,
    previous: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    apiFetch('/api/public/events', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('Events unavailable');
        return response.json();
      })
      .then((data: PublicEventsPayload) => {
        if (mounted) {
          setPayload({
            upcoming: data.upcoming ?? null,
            previous: Array.isArray(data.previous) ? data.previous : [],
          });
        }
      })
      .catch(() => {
        if (mounted) {
          setPayload({ upcoming: null, previous: [] });
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { payload, loading };
}

function EventSection() {
  const { payload, loading } = usePublicEvents();
  const event = payload.upcoming ?? fallbackUpcomingEvent;

  return (
    <ScrollSection
      id="event"
      className="section-pad premium-red relative overflow-hidden px-5 md:px-10"
    >
      <div className="aurora" aria-hidden />
      <div className="premium-noise absolute inset-0" aria-hidden />
      <div className="relative mx-auto max-w-7xl">
        <Reveal>
          <Parallax speed={0.22}>
            <SectionIntro
              index="02"
              kicker="Upcoming event"
              title="The next public"
              accent="court call."
              copy="The active event is pulled from the admin dashboard after publication. Players see only what is live and ready for team registration."
              align="center"
            />
          </Parallax>
        </Reveal>

        <Reveal delay={0.08}>
          <Parallax speed={0.16} className="mt-20">
            <article className="upcoming-event-card grid overflow-hidden border border-[var(--padel-line-strong)] bg-[var(--padel-ink)]/32 shadow-[0_34px_120px_rgba(0,0,0,0.32)] lg:grid-cols-[1.15fr_0.85fr]">
              <div className="relative min-h-[440px] p-7 md:p-10 lg:p-12">
                <div className="court-card__diagram opacity-45" aria-hidden>
                  <span className="court-card__baseline court-card__baseline--top" />
                  <span className="court-card__baseline court-card__baseline--bottom" />
                  <span className="court-card__net" />
                  <span className="court-card__service court-card__service--left" />
                  <span className="court-card__service court-card__service--right" />
                </div>
                <span className="live-badge mb-8 inline-flex items-center gap-2 rounded-full border border-[var(--padel-line)] px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.3em] text-[var(--padel-ivory)]">
                  <span className="live-badge__dot" aria-hidden />
                  {loading ? 'Checking live event' : payload.upcoming ? 'Published' : 'Account-ready'}
                </span>
                <h3 className="font-display max-w-2xl text-5xl font-semibold leading-[0.95] text-[var(--padel-ivory)] md:text-7xl">
                  {event.title}
                </h3>
                <p className="mt-8 max-w-xl text-base leading-8 text-[var(--padel-muted)]">
                  {event.description}
                </p>
                <div className="mt-10 flex flex-wrap gap-3">
                  {event.categories.map((category) => (
                    <span key={category.id} className="flow-card__tag">
                      {category.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="border-t border-[var(--padel-line)] bg-[var(--padel-parchment)] p-7 text-[var(--padel-ink)] md:p-10 lg:border-l lg:border-t-0 lg:p-12">
                <div className="grid gap-6">
                  {[
                    { icon: CalendarDays, label: 'Date', value: formatEventDate(event.date) },
                    { icon: MapPin, label: 'Location', value: event.location },
                    { icon: Trophy, label: 'Review', value: 'Admin approves teams' },
                    { icon: Users, label: 'Team', value: 'Two verified profiles' },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="border-b border-[#dacbb9] pb-5 last:border-b-0">
                      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.26em] text-[var(--padel-red)]">
                        <Icon className="h-4 w-4" />
                        {label}
                      </p>
                      <p className="font-display mt-2 text-3xl font-semibold">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:flex-col">
                  <a
                    href="/register"
                    className="btn-premium inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--padel-red)] px-6 py-3 text-base font-semibold text-[var(--padel-ivory)] hover:bg-[var(--padel-red-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-red)]"
                  >
                    Create account
                    <ArrowRight className="h-5 w-5" />
                  </a>
                  <a
                    href="/login"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[var(--padel-ink)]/20 px-6 py-3 text-base font-semibold text-[var(--padel-ink)] hover:border-[var(--padel-red)] hover:text-[var(--padel-red)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-red)]"
                  >
                    Log in
                  </a>
                </div>
              </div>
            </article>
          </Parallax>
        </Reveal>
      </div>
    </ScrollSection>
  );
}

function PreviousEventsSection() {
  const { payload, loading } = usePublicEvents();
  const previous = payload.previous;

  return (
    <ScrollSection
      id="previous-events"
      className="section-tight relative overflow-hidden bg-[var(--padel-ink)] px-5 md:px-10"
    >
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <div className="grid gap-10 border-b border-[var(--padel-line)] pb-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <SectionIntro
              index="03"
              kicker="Previous events"
              title="Past draws,"
              accent="still visible."
              copy="The archive gives players and clubs a public memory of published events without competing with the current registration call."
            />
            <p className="max-w-2xl text-base leading-8 text-[var(--padel-muted)] lg:justify-self-end">
              Admin-published past events appear here after their date has passed. The layout stays compact so the next live event remains the focus.
            </p>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {previous.map((event, index) => (
            <Reveal key={event.id} delay={index * 0.04}>
              <article className="previous-event-card group flex min-h-72 flex-col border border-[var(--padel-line)] bg-[var(--padel-red)]/12 p-6 transition duration-300 hover:border-[var(--padel-gold)]">
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[var(--padel-gold)]">
                  {formatEventDate(event.date)}
                </p>
                <h3 className="font-display mt-6 text-3xl font-semibold text-[var(--padel-ivory)]">
                  {event.title}
                </h3>
                <p className="mt-4 text-sm leading-6 text-[var(--padel-muted)]">
                  {event.location}
                </p>
                <div className="mt-auto flex flex-wrap gap-2 pt-8">
                  {event.categories.slice(0, 3).map((category) => (
                    <span key={category.id} className="rounded-full border border-[var(--padel-line)] px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[var(--padel-muted)]">
                      {category.name}
                    </span>
                  ))}
                </div>
              </article>
            </Reveal>
          ))}
          {!loading && !previous.length ? (
            <Reveal>
              <article className="border border-[var(--padel-line)] bg-[var(--padel-red)]/12 p-8 text-[var(--padel-muted)] md:col-span-3">
                Previous published events will appear here after their dates pass.
              </article>
            </Reveal>
          ) : null}
        </div>
      </div>
    </ScrollSection>
  );
}

function FlowSection() {
  const reduceMotion = useReducedMotion();
  const gridRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const { scrollYProgress } = useScroll({
    target: gridRef,
    offset: ['start 0.85', 'end 0.45'],
  });
  const ballX = useTransform(scrollYProgress, [0.05, 0.95], ['0%', '100%']);
  const smoothBallX = useSpring(ballX, { stiffness: 90, damping: 22, mass: 0.6 });
  const [scrollStep, setScrollStep] = useState(0);

  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    const next = Math.min(flow.length - 1, Math.floor(latest * flow.length));
    setScrollStep((previous) => (previous === next ? previous : next));
  });

  // Score rail highlights the hovered card, otherwise follows scroll progress.
  const activeCall = 1 + (hovered ?? scrollStep);

  return (
    <ScrollSection
      id="flow"
      className="section-tight relative overflow-hidden bg-[var(--padel-ink)] px-5 md:px-10"
    >
      <ParallaxLayer className="section-orbit section-orbit--right" speed={-0.45} rotate={-18} />
      <div className="mx-auto grid max-w-7xl gap-16 lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:gap-24">
        <Reveal>
          <Parallax speed={0.24}>
            <div>
              <SectionIntro
                index="04"
                kicker="Registration flow"
                title="Three points"
                accent="win the entry."
                copy="Entering now starts with a verified account, then a two-player team request, then admin approval before the bracket closes."
              />

              <div className="score-rail mt-12" role="presentation">
                {scoreCalls.map((call, index) => (
                  <span key={call} className="score-rail__item">
                    <span
                      className={`score-rail__call font-display ${
                        index === activeCall ? 'score-rail__call--active' : ''
                      } ${index < activeCall ? 'score-rail__call--won' : ''}`}
                    >
                      {call}
                    </span>
                    {index < scoreCalls.length - 1 ? (
                      <span className="score-rail__sep" aria-hidden />
                    ) : null}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-[0.62rem] font-semibold uppercase tracking-[0.34em] text-[var(--padel-muted)]/60">
                The scoreboard of your entry
              </p>
            </div>
          </Parallax>
        </Reveal>

        <div ref={gridRef} className="flow-grid relative grid gap-8 md:grid-cols-3">
          <div className="flow-grid__line" aria-hidden>
            {!reduceMotion ? (
              <motion.span className="flow-grid__ball" style={{ left: smoothBallX }} />
            ) : null}
          </div>
          {flow.map((item, index) => (
            <Reveal key={item.step} delay={index * 0.06}>
              <Parallax speed={[0.1, 0.28, 0.16][index] ?? 0.14}>
              <Tilt max={4}>
                <article
                  className="flow-card glass-card group relative flex min-h-80 flex-col overflow-hidden border border-[var(--padel-line)] p-8"
                  onMouseEnter={() => setHovered(index)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <span className="flow-card__score font-display" aria-hidden>
                    {item.score}
                  </span>
                  <div className="relative flex items-baseline justify-between">
                    <p className="font-display text-lg font-semibold italic text-[var(--padel-gold)]/70">
                      {item.step}
                    </p>
                    <span className="text-[0.62rem] font-semibold uppercase tracking-[0.34em] text-[var(--padel-muted)]/70">
                      {index === flow.length - 1 ? 'Game point' : `Point ${index + 1}`}
                    </span>
                  </div>
                  <h3 className="font-display relative mt-auto pt-24 text-2xl font-semibold text-[var(--padel-ivory)]">
                    {item.title}
                  </h3>
                  <p className="relative mt-4 text-base leading-8 text-[var(--padel-muted)]">
                    {item.copy}
                  </p>
                  <div className="relative mt-6 flex items-center justify-between gap-4">
                    <span className="flow-card__tag">{item.tag}</span>
                    <ArrowUpRight className="flow-card__arrow h-5 w-5 shrink-0 text-[var(--padel-gold)]" />
                  </div>
                </article>
              </Tilt>
              </Parallax>
            </Reveal>
          ))}
        </div>
      </div>
    </ScrollSection>
  );
}

function RegistrationSection() {
  return (
    <ScrollSection
      id="registration"
      className="section-pad premium-red relative overflow-hidden px-5 md:px-10"
    >
      <div className="aurora" aria-hidden />
      <div className="premium-noise absolute inset-0" aria-hidden />
      <div className="relative mx-auto grid max-w-7xl gap-16 lg:grid-cols-[0.82fr_1.18fr] lg:items-start lg:gap-24">
        <Reveal>
          <div className="lg:sticky lg:top-28">
            <SectionIntro
              index="05"
              kicker="Account access"
              title="Create account,"
              accent="then enter as a team."
              copy="Players register with verified email, name and surname. Team entries link both player profiles by email and stay pending until admin approval."
            />

            <div className="entry-meter glass-card mt-14 border border-[var(--padel-line)] p-7">
              <div className="mb-6 flex items-end justify-between gap-8">
                <div>
                  <span className="live-badge mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--padel-line)] px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.3em] text-[var(--padel-ivory)]">
                    <span className="live-badge__dot" aria-hidden />
                    Entries open
                  </span>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--padel-gold)]">
                    Draw capacity
                  </p>
                </div>
                <p className="font-display text-5xl font-semibold text-[var(--padel-ivory)]">
                  <Counter to={75} suffix="%" />
                </p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--padel-ivory)]/18">
                <motion.div
                  className="entry-meter__fill h-full origin-left rounded-full"
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 0.75 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <p className="mt-4 text-sm leading-6 text-[var(--padel-muted)]">
                12 of 16 team slots confirmed. Remaining places close after the category draw.
              </p>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <Parallax speed={0.16}>
          <div className="premium-form bg-[var(--padel-parchment)] p-7 text-[var(--padel-ink)] shadow-[0_34px_120px_rgba(0,0,0,0.3)] md:p-10 lg:p-12">
            <div className="mb-10 flex items-start justify-between gap-8 border-b border-[#dacbb9] pb-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--padel-red)]">
                  Create account
                </p>
                <p className="font-display mt-2 text-4xl font-semibold text-[var(--padel-ink)]">
                  Player dashboard
                </p>
                <div className="form-steps mt-4 flex items-center gap-2" aria-hidden>
                  {[1, 2, 3].map((step) => (
                    <span key={step} className={`form-steps__dot ${step === 1 ? 'form-steps__dot--active' : ''}`} />
                  ))}
                  <span className="ml-1 text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-[var(--padel-ink)]/45">
                    Verify · teammate · approval
                  </span>
                </div>
              </div>
              <Users className="mt-1 h-6 w-6 text-[var(--padel-red)]" />
            </div>

            <div className="grid gap-5">
              {[
                ['01', 'Verify email', 'Email signup sends a backend code. Gmail users are verified through Google.'],
                ['02', 'Add teammate', 'Enter teammate email in the dashboard. Existing users are notified; new users get an invite.'],
                ['03', 'Wait for admin', 'Admin approves, declines or returns a registration to pending. Status appears in dashboard and email.'],
              ].map(([step, title, copy]) => (
                <div key={step} className="border-b border-[#dacbb9] pb-5 last:border-b-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--padel-red)]">{step}</p>
                  <h3 className="font-display mt-2 text-2xl font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--padel-ink)]/65">{copy}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <a
                href="/register"
                className="btn-premium btn-premium--dark group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--padel-red)] px-6 py-3.5 text-base font-semibold text-[var(--padel-ivory)] hover:bg-[#6f1210] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-ink)]"
              >
                Create account
                <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </a>
              <a
                href="/login"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--padel-ink)]/25 px-6 py-3.5 text-base font-semibold text-[var(--padel-ink)] transition-colors duration-200 hover:border-[var(--padel-red)] hover:text-[var(--padel-red)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-red)]"
              >
                Log in
              </a>
            </div>
          </div>
          </Parallax>
        </Reveal>
      </div>
    </ScrollSection>
  );
}

function AtmosphereSection() {
  return (
    <ScrollSection id="atmosphere" className="section-pad bg-[var(--padel-ink)] px-5 md:px-10">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <Parallax speed={0.2}>
          <div className="grid gap-12 border-b border-[var(--padel-line)] pb-16 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <SectionIntro
              index="06"
              kicker="Visual atmosphere"
              title="Red, ivory and"
              accent="the calm before the hit."
            />
            <p className="max-w-2xl text-base leading-8 text-[var(--padel-muted)] lg:justify-self-end">
              The visual system is built as reusable poster language: tactile ball forms,
              strict court lines, theatrical shadow and enough quiet space to feel premium.
            </p>
          </div>
          </Parallax>
        </Reveal>

        <div className="atmosphere-grid mt-16 grid gap-8 md:grid-cols-3">
          {atmosphere.map((item, index) => (
            <Reveal key={item.title} delay={index * 0.06}>
              <Parallax speed={[0.12, 0.42, 0.26][index] ?? 0.2}>
              <Tilt max={5}>
              <figure className="group atmosphere-card">
                <div className={`visual-poster ${item.className ?? ''}`}>
                  {item.image ? (
                    <>
                      <Image
                        src={item.image}
                        alt={item.title}
                        fill
                        sizes="(max-width: 768px) 90vw, 30vw"
                        className="visual-poster__image object-cover"
                      />
                      <span className="visual-poster__overlay" aria-hidden>
                        <span className="visual-poster__overlay-label">Poster study</span>
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="visual-poster__grain" aria-hidden />
                      <span className="visual-poster__small">{item.label}</span>
                      <h3 className="font-display visual-poster__title">{item.title}</h3>
                    </>
                  )}
                </div>
                <figcaption className="mt-4 flex items-center justify-between text-sm font-medium text-[var(--padel-muted)]">
                  <span>{item.label}</span>
                  <span className="text-xs uppercase tracking-[0.28em] text-[var(--padel-gold)]">
                    {`0${index + 1}`}
                  </span>
                </figcaption>
              </figure>
              </Tilt>
              </Parallax>
            </Reveal>
          ))}
        </div>
      </div>
    </ScrollSection>
  );
}

function ContactSection() {
  return (
    <ScrollSection
      id="contact"
      className="section-pad premium-red relative overflow-hidden px-5 md:px-10"
    >
      <div className="aurora" aria-hidden />
      <div className="premium-noise absolute inset-0" aria-hidden />
      <div className="relative mx-auto grid max-w-7xl gap-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-24">
        <Reveal>
          <Parallax speed={0.18}>
          <div>
            <SectionIntro
              index="07"
              kicker="Contact"
              title="For players, partners"
              accent="and sponsors."
              copy="The final layer stays practical: direct contact, court information and sponsor visibility without breaking the poster tone."
            />
            <div className="mt-12 space-y-1 text-[var(--padel-muted)]">
              {[
                { href: 'tel:+995555000000', icon: Phone, kicker: 'Call or WhatsApp', text: '+995 555 000 000' },
                { href: 'mailto:register@elpadel.club', icon: Mail, kicker: 'Entries and partners', text: 'register@elpadel.club' },
                { href: 'https://www.instagram.com/', icon: Instagram, kicker: 'Daily court life', text: '@elpadeltournament' },
              ].map(({ href, icon: LinkIcon, kicker, text }) => (
                <a
                  key={href}
                  href={href}
                  className="contact-link group flex items-center gap-5 rounded-sm py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-ivory)]"
                >
                  <span className="contact-link__icon flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--padel-line)] transition-colors duration-300">
                    <LinkIcon className="h-4 w-4 text-[var(--padel-ivory)]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.32em] text-[var(--padel-gold)]/80">
                      {kicker}
                    </span>
                    <span className="contact-link__text font-display block truncate text-2xl font-semibold text-[var(--padel-ivory)] md:text-3xl">
                      {text}
                    </span>
                  </span>
                  <ArrowUpRight className="contact-link__arrow ml-auto h-5 w-5 shrink-0 text-[var(--padel-gold)]" />
                </a>
              ))}
            </div>
          </div>
          </Parallax>
        </Reveal>

        <Reveal delay={0.08}>
          <Parallax speed={0.22}>
          <div className="court-card bg-[var(--padel-parchment)] p-7 text-[var(--padel-ink)] md:p-10 lg:p-12">
            <div className="court-card__diagram" aria-hidden>
              <span className="court-card__baseline court-card__baseline--top" />
              <span className="court-card__baseline court-card__baseline--bottom" />
              <span className="court-card__net" />
              <span className="court-card__service court-card__service--left" />
              <span className="court-card__service court-card__service--right" />
            </div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-[var(--padel-red)]">
              <Navigation className="h-4 w-4" />
              Location
            </p>
            <h3 className="font-display mt-4 text-5xl font-semibold leading-tight md:text-6xl">
              KUS TBA Padel Courts
            </h3>
            <p className="mt-7 max-w-xl text-base leading-8 text-[var(--padel-ink)]/70">
              Premium court complex with player lounge, warm-up zone and sponsor wall.
            </p>

            <p className="mt-10 text-xs font-semibold uppercase tracking-[0.3em] text-[var(--padel-red)]/70">
              Partners
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {sponsors.map((sponsor) => (
                <div
                  key={sponsor}
                  className="sponsor-chip flex min-h-16 items-center justify-center border border-[#dacbb9] px-4 text-center text-sm font-semibold text-[var(--padel-ink)]/72 transition-colors duration-300"
                >
                  {sponsor}
                </div>
              ))}
            </div>
          </div>
          </Parallax>
        </Reveal>
      </div>
    </ScrollSection>
  );
}

function FinalCta() {
  return (
    <ScrollSection
      id="final"
      className="relative overflow-hidden bg-[var(--padel-ink)] px-5 py-32 text-center md:px-10 md:py-44"
    >
      <div className="section-orbit section-orbit--center" aria-hidden />
      <Reveal>
        <Parallax speed={0.14}>
        <div className="relative mx-auto max-w-4xl">
          <Parallax speed={0.28}>
            <Image
              src="/images/el-padel-logo.png"
              alt="El Padel — gold matador crest"
              width={280}
              height={186}
              className="mx-auto h-auto w-[150px] object-contain md:w-[180px]"
            />
          </Parallax>
          <p className="font-script mt-6 text-4xl leading-none text-[var(--padel-gold)] md:text-5xl">
            El Matador awaits
          </p>
          <p className="mb-7 mt-5 text-xs font-semibold uppercase tracking-[0.34em] text-[var(--padel-muted)]">
            El Padel Tournament Tbilisi
          </p>
          <h2 className="font-display text-5xl font-semibold leading-[0.98] text-[var(--padel-ivory)] md:text-7xl">
            <WordReveal text="Beautiful pressure." />{' '}
            <WordReveal text="Serious padel." delay={0.18} className="section-accent" />
          </h2>
          <Magnetic className="mt-12" strength={0.25}>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href="/register"
                className="btn-premium inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--padel-ivory)] px-7 py-3.5 text-base font-semibold text-[var(--padel-red)] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]"
              >
                Create account
                <ArrowRight className="h-5 w-5" />
              </a>
              <a
                href="#contact"
                className="btn-ghost inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[var(--padel-line-strong)] px-7 py-3.5 text-base font-semibold text-[var(--padel-ivory)] transition-colors duration-200 hover:border-[var(--padel-gold)] hover:text-[var(--padel-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]"
              >
                Contact us
                <ArrowUpRight className="h-5 w-5" />
              </a>
            </div>
          </Magnetic>

          <p className="mt-16 text-xs uppercase tracking-[0.32em] text-[var(--padel-muted)]/70">
            Every Match Is a Battle · Every Point Is Honor
          </p>
        </div>
        </Parallax>
      </Reveal>
    </ScrollSection>
  );
}

function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer relative overflow-hidden border-t border-[var(--padel-line)] bg-[var(--padel-ink)] px-5 pb-10 pt-16 md:px-10">
      <div className="site-footer__mesh" aria-hidden />
      <div className="relative mx-auto flex max-w-7xl flex-col gap-12">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <p className="font-script select-none text-7xl leading-[0.9] text-[var(--padel-gold)] md:text-9xl">
            El Padel
          </p>
          <div className="flex flex-wrap items-center justify-between gap-6 lg:justify-end">
            <nav
              aria-label="Footer navigation"
              className="flex flex-wrap gap-x-8 gap-y-3 text-sm font-medium text-[var(--padel-muted)]"
            >
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="footer-link transition-colors duration-200 hover:text-[var(--padel-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]"
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <Magnetic strength={0.3}>
              <a
                href="#top"
                aria-label="Back to top"
                className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--padel-line-strong)] text-[var(--padel-ivory)] transition-colors duration-200 hover:border-[var(--padel-gold)] hover:text-[var(--padel-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]"
              >
                <ArrowUp className="h-5 w-5" />
              </a>
            </Magnetic>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-6 border-t border-[var(--padel-line)] pt-8 text-xs font-medium uppercase tracking-[0.26em] text-[var(--padel-muted)]/70">
          <span>© {year} El Padel Tournament Tbilisi</span>
          <span className="hidden md:inline">Every Match Is a Battle · Every Point Is Honor</span>
          <div className="flex items-center gap-5">
            <a
              href="https://www.instagram.com/"
              className="footer-social inline-flex items-center gap-2 transition-colors duration-200 hover:text-[var(--padel-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]"
            >
              <Instagram className="h-4 w-4" />
              Instagram
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function PadelHome() {
  return (
    <div
      style={padelVars}
      className="el-padel-page min-h-screen overflow-x-clip bg-[var(--padel-red)] text-white"
    >
      <Preloader />
      <CursorRing />
      <FilmGrain />
      <PageProgress />
      <PadelNav />
      <SnapScrollController />
      <FloatingEntryBar />
      <BackToTop />
      <main>
        <Hero />
        <MarqueeBand />
        <SectionCourtDivider />
        <AboutSection />
        <SectionCourtDivider />
        <EventSection />
        <SectionCourtDivider />
        <PreviousEventsSection />
        <SectionCourtDivider />
        <FlowSection />
        <SectionCourtDivider />
        <RegistrationSection />
        <MarqueeBand reverse />
        <SectionCourtDivider />
        <AtmosphereSection />
        <SectionCourtDivider />
        <ContactSection />
        <FinalCta />
      </main>
      <SiteFooter />

      <style jsx global>{`
        .font-display {
          font-family: var(--font-display);
          font-optical-sizing: auto;
        }

        .font-script {
          font-family: var(--font-script);
        }

        .el-padel-page {
          background: var(--padel-red);
          isolation: isolate;
        }

        html {
          scroll-padding-top: 0;
        }

        .el-padel-page main > section {
          min-height: 100dvh;
          will-change: transform, opacity;
        }

        .el-padel-page section[id] {
          scroll-margin-top: 0;
        }

        /* ================================================================ */
        /* Creative system — aurora, gold ink, premium buttons, glass       */
        /* ================================================================ */

        /* ---- Page progress + glow trail ---- */
        .preloader {
          animation: preloader-fallback-hide 2.8s var(--padel-ease-out) forwards;
        }

        @keyframes preloader-fallback-hide {
          0%,
          88% {
            opacity: 1;
            visibility: visible;
          }

          100% {
            opacity: 0;
            pointer-events: none;
            visibility: hidden;
          }
        }

        .page-progress {
          background: linear-gradient(
            90deg,
            var(--padel-gold-deep),
            var(--padel-gold) 40%,
            #efe1b8 55%,
            var(--padel-gold) 72%,
            var(--padel-gold-deep)
          );
          box-shadow: 0 0 18px rgba(224, 196, 119, 0.45);
        }

        .page-progress__glow {
          background: linear-gradient(
            180deg,
            rgba(224, 196, 119, 0.35),
            transparent
          );
          filter: blur(8px);
        }

        /* ---- Court divider between sections ---- */
        .court-divider {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding-inline: 1.25rem;
          background: var(--padel-ink);
        }

        .court-divider__line {
          flex: 1;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent,
            var(--padel-line-strong),
            transparent
          );
        }

        .court-divider__net {
          display: flex;
          height: 1.35rem;
          width: 2.4rem;
          align-items: center;
          justify-content: center;
          border-inline: 1px solid var(--padel-line-strong);
        }

        .court-divider__mesh {
          display: block;
          height: 100%;
          width: 100%;
          background: repeating-linear-gradient(
            90deg,
            var(--padel-line) 0 2px,
            transparent 2px 6px
          );
          opacity: 0.85;
        }

        /* ---- Floating entry bar + back to top ---- */
        .floating-entry {
          box-shadow:
            0 24px 80px rgba(0, 0, 0, 0.45),
            0 0 0 1px rgba(224, 196, 119, 0.08);
        }

        .floating-entry__pulse {
          animation: pulse-ring 2.4s ease-in-out infinite;
        }

        @keyframes float-idle {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-4px);
          }
        }

        @keyframes pulse-ring {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(224, 196, 119, 0.25);
          }
          55% {
            box-shadow: 0 0 0 8px rgba(224, 196, 119, 0);
          }
        }

        .back-to-top {
          box-shadow: 0 16px 50px rgba(0, 0, 0, 0.35);
          bottom: max(1.25rem, calc(env(safe-area-inset-bottom) + 1rem));
        }

        /* ---- Navigation shell ---- */
        .padel-nav-header {
          padding-top: max(0.75rem, calc(env(safe-area-inset-top) + 0.5rem));
        }

        @media (min-width: 768px) {
          .padel-nav-header {
            padding-top: max(1.25rem, calc(env(safe-area-inset-top) + 1rem));
          }
        }

        .nav-shell {
          box-shadow:
            inset 0 1px 0 rgba(246, 239, 225, 0.06),
            0 18px 70px rgba(0, 0, 0, 0.18);
        }

        .nav-link__underline {
          pointer-events: none;
        }

        /* ---- Hero chips + meta bars ---- */
        .hero-chip {
          display: inline-flex;
          align-items: center;
          border: 1px solid var(--padel-line);
          border-radius: 999px;
          padding: 0.35rem 0.85rem;
          font-size: 0.62rem;
          font-weight: 600;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: var(--padel-muted);
          background: rgba(19, 2, 2, 0.22);
          backdrop-filter: blur(6px);
        }

        .poster-meta__bar {
          background: linear-gradient(
            90deg,
            var(--padel-ivory),
            rgba(224, 196, 119, 0.85) 55%,
            var(--padel-ivory)
          );
          box-shadow: 0 0 16px rgba(224, 196, 119, 0.18);
        }

        .scroll-cue__track {
          background: rgba(19, 2, 2, 0.28);
        }

        /* ---- Section intro frame ---- */
        .section-intro-frame {
          position: relative;
          padding-left: 1.1rem;
          border-left: 2px solid rgba(224, 196, 119, 0.35);
        }

        .section-intro-frame--center {
          padding-left: 0;
          border-left: none;
          padding-top: 1.1rem;
          border-top: 2px solid rgba(224, 196, 119, 0.35);
        }

        .section-kicker__index {
          animation: index-glow 3s ease-in-out infinite;
        }

        @keyframes index-glow {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(224, 196, 119, 0);
          }
          50% {
            box-shadow: 0 0 0 6px rgba(224, 196, 119, 0.12);
          }
        }

        /* ---- Ghost button ---- */
        .btn-ghost {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          transition:
            transform 0.32s var(--padel-ease-out),
            border-color 0.32s ease,
            color 0.32s ease;
        }

        .btn-ghost:hover {
          transform: translateY(-2px);
        }

        /* ---- Mobile menu court lines ---- */
        .mobile-menu__lines {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.35;
          background:
            linear-gradient(90deg, transparent 18%, var(--padel-line) 18%, var(--padel-line) calc(18% + 1px), transparent calc(18% + 1px)),
            linear-gradient(90deg, transparent 82%, var(--padel-line) 82%, var(--padel-line) calc(82% + 1px), transparent calc(82% + 1px)),
            linear-gradient(180deg, transparent 28%, var(--padel-line) 28%, var(--padel-line) calc(28% + 1px), transparent calc(28% + 1px));
        }

        /* ---- Animated aurora glow (used behind red sections) ---- */
        .aurora {
          position: absolute;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          overflow: hidden;
        }

        .aurora::before,
        .aurora::after {
          content: '';
          position: absolute;
          border-radius: 999px;
          filter: blur(70px);
          opacity: 0.55;
          will-change: transform;
        }

        .aurora::before {
          top: -12%;
          left: -8%;
          height: 46rem;
          width: 46rem;
          background: radial-gradient(circle, rgba(224, 196, 119, 0.22), transparent 62%);
          animation: aurora-drift-a 24s ease-in-out infinite alternate;
        }

        .aurora::after {
          right: -12%;
          bottom: -18%;
          height: 42rem;
          width: 42rem;
          background: radial-gradient(circle, rgba(224, 52, 43, 0.24), transparent 60%);
          animation: aurora-drift-b 30s ease-in-out infinite alternate;
        }

        @keyframes aurora-drift-a {
          from {
            transform: translate3d(0, 0, 0) scale(1);
          }
          to {
            transform: translate3d(6rem, 4rem, 0) scale(1.14);
          }
        }

        @keyframes aurora-drift-b {
          from {
            transform: translate3d(0, 0, 0) scale(1.05);
          }
          to {
            transform: translate3d(-5rem, -3rem, 0) scale(0.9);
          }
        }

        /* ---- Gold gradient ink (headlines / wordmarks) ---- */
        .gold-ink {
          background: linear-gradient(
            105deg,
            var(--padel-gold-deep) 0%,
            var(--padel-gold) 34%,
            var(--padel-gold-2) 52%,
            var(--padel-gold) 68%,
            var(--padel-gold-deep) 100%
          );
          background-size: 220% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: gold-shift 8s ease-in-out infinite;
        }

        @keyframes gold-shift {
          0%,
          100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        /* ---- Premium button (shared CTA behaviour) ---- */
        .btn-premium {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          transition:
            transform 0.32s cubic-bezier(0.16, 1, 0.3, 1),
            box-shadow 0.32s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .btn-premium::after {
          content: '';
          position: absolute;
          top: 0;
          left: -140%;
          z-index: 1;
          height: 100%;
          width: 55%;
          background: linear-gradient(
            100deg,
            transparent,
            rgba(255, 255, 255, 0.55),
            transparent
          );
          transform: skewX(-18deg);
          transition: left 0.7s cubic-bezier(0.16, 1, 0.3, 1);
          pointer-events: none;
        }

        .btn-premium:hover {
          transform: translateY(-2px);
          box-shadow: var(--padel-shadow-gold);
        }

        .btn-premium:hover::after {
          left: 150%;
        }

        .btn-premium > * {
          position: relative;
          z-index: 2;
        }

        /* Dark (red) variant sheen is subtler */
        .btn-premium.btn-premium--dark::after {
          background: linear-gradient(
            100deg,
            transparent,
            rgba(224, 196, 119, 0.5),
            transparent
          );
        }

        /* ---- Glass panel treatment ---- */
        .glass-card {
          position: relative;
          background: linear-gradient(
            160deg,
            rgba(246, 239, 225, 0.055),
            rgba(246, 239, 225, 0.015)
          );
          backdrop-filter: blur(6px);
          transition:
            transform 0.4s cubic-bezier(0.16, 1, 0.3, 1),
            border-color 0.4s ease,
            box-shadow 0.4s ease,
            background-color 0.4s ease;
        }

        .glass-card:hover {
          border-color: rgba(224, 196, 119, 0.4);
          box-shadow: var(--padel-shadow-gold);
          transform: translateY(-2px);
        }

        .glass-card::before {
          content: '';
          position: absolute;
          inset: 1px;
          border-radius: inherit;
          border: 1px solid rgba(246, 239, 225, 0.04);
          pointer-events: none;
        }

        /* ---- Custom cursor ring ---- */
        @media (pointer: fine) {
          html.padel-cursor-hidden,
          html.padel-cursor-hidden body,
          html.padel-cursor-hidden a,
          html.padel-cursor-hidden button,
          html.padel-cursor-hidden input,
          html.padel-cursor-hidden textarea,
          html.padel-cursor-hidden select,
          html.padel-cursor-hidden [role='button'] {
            cursor: none !important;
          }
        }

        .cursor-ring {
          height: 1.9rem;
          width: 1.9rem;
          margin-left: -0.95rem;
          margin-top: -0.95rem;
        }

        .cursor-ring__circle {
          position: absolute;
          inset: 0;
          display: block;
          border: 1px solid rgba(224, 196, 119, 0.92);
          border-radius: 999px;
          mix-blend-mode: difference;
          transform-origin: center;
          will-change: transform, opacity;
        }

        .cursor-ring__dot {
          position: absolute;
          left: calc(50% - 0.13rem);
          top: calc(50% - 0.13rem);
          display: block;
          height: 0.26rem;
          width: 0.26rem;
          border-radius: 999px;
          background: var(--padel-gold);
          mix-blend-mode: difference;
          transform-origin: center;
          will-change: transform;
        }

        /* ---- Film grain ---- */
        .film-grain {
          position: fixed;
          inset: 0;
          z-index: 95;
          pointer-events: none;
          opacity: 0.05;
          mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 220 220' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 220px 220px;
        }

        /* ---- Mobile menu ---- */
        .mobile-menu {
          padding-top: max(5.75rem, calc(env(safe-area-inset-top) + 4.75rem));
          padding-bottom: max(2rem, calc(env(safe-area-inset-bottom) + 1.5rem));
          overscroll-behavior: contain;
        }

        .mobile-menu__link {
          transition: color 0.25s ease, padding-left 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .mobile-menu__link:hover,
        .mobile-menu__link:focus-visible {
          color: var(--padel-gold);
          padding-left: 0.6rem;
          outline: none;
        }

        /* ---- Section rail ---- */
        .snap-indicator {
          position: fixed;
          right: 1.1rem;
          top: 50%;
          z-index: 65;
          display: flex;
          flex-direction: column;
          gap: 0.7rem;
          transform: translateY(-50%);
        }

        .snap-indicator__dot {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.5rem;
          min-height: 1.25rem;
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 0;
        }

        .snap-indicator__label {
          font-size: 0.62rem;
          font-weight: 600;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--padel-ivory);
          opacity: 0;
          transform: translateX(6px);
          transition:
            opacity 0.24s ease,
            transform 0.24s ease;
          white-space: nowrap;
        }

        .snap-indicator__dot:hover .snap-indicator__label,
        .snap-indicator__dot:focus-visible .snap-indicator__label,
        .snap-indicator__dot[aria-current='true'] .snap-indicator__label {
          opacity: 0.85;
          transform: translateX(0);
        }

        .snap-indicator__mark {
          position: relative;
          display: block;
          height: 0.36rem;
          width: 1.05rem;
          border-radius: 999px;
          background: var(--padel-muted);
        }

        .snap-indicator__dot[aria-current='true'] .snap-indicator__mark {
          background: var(--padel-gold);
        }

        .snap-indicator__dot:focus-visible {
          outline: none;
        }

        .snap-indicator__dot:focus-visible .snap-indicator__mark {
          box-shadow: 0 0 0 4px rgba(217, 191, 115, 0.24);
        }

        @media (max-width: 900px) {
          .snap-indicator {
            display: none;
          }
        }

        .section-pad {
          padding-top: 11rem;
          padding-bottom: 11rem;
        }

        .section-tight {
          padding-top: 8.5rem;
          padding-bottom: 8.5rem;
        }

        .section-kicker__rule {
          display: inline-block;
          height: 1px;
          width: 3.4rem;
          background: linear-gradient(90deg, var(--padel-gold), transparent);
          opacity: 0.65;
        }

        .section-accent {
          font-style: italic;
          font-weight: 500;
          color: var(--padel-gold);
        }

        /* ---- Hero rotating badge ---- */
        .hero-badge {
          position: absolute;
          height: 8.5rem;
          width: 8.5rem;
        }

        .hero-badge__svg {
          height: 100%;
          width: 100%;
          animation: badge-spin 26s linear infinite;
        }

        .hero-badge__text {
          font-size: 0.62rem;
          font-weight: 600;
          letter-spacing: 0.34em;
          fill: var(--padel-ivory);
          opacity: 0.75;
        }

        .hero-badge__star {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          font-size: 1.1rem;
          color: var(--padel-gold);
        }

        @keyframes badge-spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* ---- Flow connector + traveling ball ---- */
        .flow-grid__line {
          display: none;
        }

        @media (min-width: 768px) {
          .flow-grid__line {
            display: block;
            position: absolute;
            left: 4%;
            right: 4%;
            top: 2.4rem;
            border-top: 1px dashed var(--padel-line-strong);
            pointer-events: none;
            z-index: 2;
          }
        }

        .flow-grid__ball {
          position: absolute;
          top: 0;
          height: 0.85rem;
          width: 0.85rem;
          transform: translate(-50%, -50%);
          border-radius: 999px;
          background: radial-gradient(circle at 32% 30%, #efe1b8, var(--padel-gold) 62%, #a8893f);
          box-shadow:
            0 0 0 4px rgba(217, 191, 115, 0.14),
            0 4px 14px rgba(0, 0, 0, 0.45);
        }

        .flow-grid__ball::after {
          content: '';
          position: absolute;
          inset: 18%;
          border-radius: 999px;
          border-top: 1px solid rgba(19, 2, 2, 0.35);
          transform: rotate(-24deg);
        }

        /* ---- Score rail ---- */
        .score-rail {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.9rem;
          border-block: 1px solid var(--padel-line);
          padding-block: 1.1rem;
        }

        .score-rail__item {
          display: inline-flex;
          align-items: center;
          gap: 0.9rem;
        }

        .score-rail__call {
          font-size: 1.5rem;
          font-weight: 600;
          font-style: italic;
          line-height: 1;
          color: rgba(246, 239, 225, 0.22);
          transition:
            color 0.4s ease,
            text-shadow 0.4s ease;
        }

        .score-rail__call--won {
          color: rgba(246, 239, 225, 0.55);
        }

        .score-rail__call--active {
          color: var(--padel-gold);
          text-shadow: 0 0 22px rgba(217, 191, 115, 0.4);
        }

        .score-rail__sep {
          display: inline-block;
          height: 1px;
          width: 1.4rem;
          background: var(--padel-line-strong);
        }

        /* ---- Flow card score watermark + tag ---- */
        .flow-card__score {
          position: absolute;
          right: -0.6rem;
          top: 0.4rem;
          font-size: 8.5rem;
          font-weight: 700;
          font-style: italic;
          line-height: 0.8;
          color: transparent;
          -webkit-text-stroke: 1px rgba(217, 191, 115, 0.22);
          pointer-events: none;
          transition:
            -webkit-text-stroke-color 0.45s ease,
            transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .flow-card:hover .flow-card__score {
          -webkit-text-stroke-color: rgba(217, 191, 115, 0.55);
          transform: translateY(-4px);
        }

        .flow-card__tag {
          display: inline-flex;
          align-items: center;
          border: 1px solid var(--padel-line);
          border-radius: 999px;
          padding: 0.35rem 0.85rem;
          font-size: 0.62rem;
          font-weight: 600;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: var(--padel-gold);
          transition: border-color 0.3s ease, background-color 0.3s ease;
        }

        .flow-card:hover .flow-card__tag {
          border-color: rgba(217, 191, 115, 0.5);
          background: rgba(217, 191, 115, 0.06);
        }

        /* ---- Entry meter + live badge ---- */
        .entry-meter__fill {
          background: linear-gradient(
            90deg,
            var(--padel-gold),
            #efe1b8 55%,
            var(--padel-gold)
          );
        }

        .live-badge__dot {
          display: inline-block;
          height: 0.45rem;
          width: 0.45rem;
          border-radius: 999px;
          background: var(--padel-gold);
          animation: live-pulse 2s ease-in-out infinite;
        }

        @keyframes live-pulse {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(217, 191, 115, 0.55);
          }
          55% {
            box-shadow: 0 0 0 6px rgba(217, 191, 115, 0);
          }
        }

        /* ---- Atmosphere staggered grid ---- */
        @media (min-width: 768px) {
          .atmosphere-grid > *:nth-child(2) {
            margin-top: 3.2rem;
          }

          .atmosphere-grid > *:nth-child(3) {
            margin-top: 1.4rem;
          }
        }

        .detail-row__icon {
          background: transparent;
        }

        .detail-row:hover .detail-row__icon {
          border-color: var(--padel-gold);
        }

        .detail-row::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          height: 0;
          width: 2px;
          background: var(--padel-gold);
          transform: translateY(-50%);
          transition: height 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .detail-row:hover::before {
          height: 56%;
        }

        .contact-link:hover .contact-link__icon {
          border-color: var(--padel-gold);
        }

        .section-kicker__index {
          display: inline-flex;
          height: 1.6rem;
          min-width: 1.6rem;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--padel-line-strong);
          border-radius: 999px;
          font-size: 0.68rem;
          letter-spacing: 0.05em;
          color: var(--padel-ivory);
        }

        .poster-hero,
        .premium-red {
          background:
            radial-gradient(circle at 22% 18%, rgba(224, 196, 119, 0.1), transparent 30%),
            radial-gradient(circle at 78% 82%, rgba(224, 52, 43, 0.16), transparent 34%),
            radial-gradient(circle at 50% 38%, rgba(246, 239, 225, 0.07), transparent 22rem),
            linear-gradient(180deg, rgba(19, 2, 2, 0.12), transparent 24%, rgba(19, 2, 2, 0.34) 100%),
            linear-gradient(135deg, #97201c 0%, #781311 46%, #440706 100%);
        }

        .hero-crest {
          filter: drop-shadow(0 18px 40px rgba(19, 2, 2, 0.42));
        }

        .premium-noise {
          background:
            repeating-linear-gradient(105deg, rgba(246, 239, 225, 0.028) 0 1px, transparent 1px 9px),
            repeating-linear-gradient(12deg, rgba(19, 2, 2, 0.13) 0 1px, transparent 1px 11px);
          opacity: 0.82;
          pointer-events: none;
        }

        .poster-vignette {
          background:
            radial-gradient(circle at 48% 56%, transparent 0 19rem, rgba(19, 2, 2, 0.08) 31rem, rgba(19, 2, 2, 0.36) 100%),
            linear-gradient(90deg, rgba(19, 2, 2, 0.2), transparent 22%, transparent 78%, rgba(19, 2, 2, 0.18));
          pointer-events: none;
        }

        /* ---- Word reveal ---- */
        .reveal-word {
          display: inline-flex;
          overflow: hidden;
          vertical-align: top;
          padding-bottom: 0.08em;
        }

        .reveal-word__inner {
          display: inline-block;
          will-change: transform;
        }

        .poster-ball-wrap {
          width: min(620px, 45dvh, 78vw);
          filter: drop-shadow(0 38px 80px rgba(19, 2, 2, 0.3));
        }

        .poster-ball-canvas {
          min-height: 100%;
        }

        .poster-ball-copy {
          text-shadow: 0 1px 0 rgba(255, 255, 255, 0.22);
        }

        .poster-ball-copy h1 {
          max-width: min(14ch, 82%);
          font-size: clamp(1.62rem, 4.75dvh, 2.65rem);
          line-height: 1.12;
        }

        .poster-meta {
          color: var(--padel-ivory);
        }

        .section-orbit {
          position: absolute;
          pointer-events: none;
          height: 28rem;
          width: 28rem;
          border: 1px solid var(--padel-line);
          opacity: 0.42;
        }

        .section-orbit::before,
        .section-orbit::after {
          content: '';
          position: absolute;
          border-radius: 999px;
          border: 1px solid var(--padel-line);
        }

        .section-orbit::before {
          inset: 4rem;
        }

        .section-orbit::after {
          inset: 8rem;
        }

        .section-orbit--left {
          left: -14rem;
          top: 10rem;
          transform: rotate(18deg);
        }

        .section-orbit--right {
          right: -14rem;
          top: 1rem;
          transform: rotate(-18deg);
        }

        .section-orbit--center {
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%) rotate(22deg);
          animation: orbit-drift 52s linear infinite;
        }

        @keyframes orbit-drift {
          from {
            transform: translate(-50%, -50%) rotate(22deg);
          }
          to {
            transform: translate(-50%, -50%) rotate(382deg);
          }
        }

        /* ---- Poster frame (real player poster) ---- */
        .poster-frame {
          position: relative;
          padding: 0.9rem;
          border: 1px solid var(--padel-line);
        }

        .poster-frame__media {
          position: relative;
          overflow: hidden;
          aspect-ratio: 4 / 5;
          background: var(--padel-red-3);
          box-shadow: 0 34px 110px rgba(0, 0, 0, 0.4);
        }

        .poster-frame__inner {
          position: absolute;
          inset: -8%;
          will-change: transform;
        }

        .poster-frame__caption {
          position: absolute;
          bottom: 0.35rem;
          right: 0.9rem;
          font-size: 0.66rem;
          font-weight: 600;
          letter-spacing: 0.26em;
          text-transform: uppercase;
          color: var(--padel-gold);
        }

        .poster-frame__tick {
          position: absolute;
          height: 0.85rem;
          width: 0.85rem;
          border: 0 solid var(--padel-gold);
          z-index: 2;
        }

        .poster-frame__tick--tl {
          top: -1px;
          left: -1px;
          border-top-width: 1px;
          border-left-width: 1px;
        }

        .poster-frame__tick--tr {
          top: -1px;
          right: -1px;
          border-top-width: 1px;
          border-right-width: 1px;
        }

        .poster-frame__tick--bl {
          bottom: -1px;
          left: -1px;
          border-bottom-width: 1px;
          border-left-width: 1px;
        }

        .poster-frame__tick--br {
          bottom: -1px;
          right: -1px;
          border-bottom-width: 1px;
          border-right-width: 1px;
        }

        .principle-row__check {
          opacity: 0;
          transform: scale(0.6);
          transition:
            opacity 0.3s ease,
            transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .principle-row:hover .principle-row__check {
          opacity: 1;
          transform: scale(1);
        }

        .principle-row:hover .principle-row__num {
          color: var(--padel-gold);
        }

        .principle-row:hover p {
          color: var(--padel-ivory);
        }

        .stat-card {
          transition:
            background-color 0.3s ease,
            transform 0.3s ease,
            border-color 0.3s ease;
          overflow: hidden;
        }

        .stat-card__glow {
          position: absolute;
          inset: auto -30% -60% -30%;
          height: 70%;
          background: radial-gradient(circle, rgba(224, 196, 119, 0.16), transparent 68%);
          opacity: 0;
          transition: opacity 0.35s ease;
          pointer-events: none;
        }

        .stat-card:hover .stat-card__glow {
          opacity: 1;
        }

        @media (min-width: 768px) {
          .stat-card--featured {
            transform: translateY(-0.75rem);
            border-color: rgba(224, 196, 119, 0.35);
            background: rgba(246, 239, 225, 0.04);
          }

          .stat-card--featured .stat-card__glow {
            opacity: 0.65;
          }
        }

        .stat-card:hover {
          background: rgba(246, 239, 225, 0.03);
          transform: translateY(-3px);
        }

        .detail-row {
          transition:
            background-color 0.25s ease,
            transform 0.25s ease;
        }

        .detail-row:hover {
          background: rgba(246, 239, 225, 0.035);
          transform: translateX(4px);
        }

        .flow-card::before {
          content: '';
          position: absolute;
          inset: 0;
          transform: translateY(100%);
          background: linear-gradient(180deg, transparent, rgba(246, 239, 225, 0.08));
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .flow-card:hover::before {
          transform: translateY(0);
        }

        .flow-card__arrow {
          opacity: 0;
          transform: translate(-4px, 4px);
          transition:
            opacity 0.3s ease,
            transform 0.3s ease;
        }

        .flow-card:hover .flow-card__arrow {
          opacity: 1;
          transform: translate(0, 0);
        }

        .contact-link {
          position: relative;
          border-bottom: 1px solid var(--padel-line);
          transition: color 0.25s ease;
        }

        .contact-link .contact-link__text {
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .contact-link:hover {
          color: var(--padel-ivory);
        }

        .contact-link:hover .contact-link__text {
          transform: translateX(6px);
        }

        .contact-link__arrow {
          opacity: 0;
          transition:
            opacity 0.25s ease,
            transform 0.25s ease;
        }

        .contact-link:hover .contact-link__arrow {
          opacity: 1;
          transform: translate(2px, -2px);
        }

        .sponsor-chip:hover {
          background: rgba(140, 25, 22, 0.06);
          border-color: var(--padel-red);
          color: var(--padel-red);
        }

        /* ---- Hero title line mask ---- */
        .hero-title-line {
          display: block;
          overflow: hidden;
          padding-bottom: 0.06em;
        }

        .hero-title-line__inner {
          display: inline-block;
          will-change: transform;
        }

        /* ---- Marquee band ---- */
        .marquee-band {
          overflow: hidden;
          border-block: 1px solid var(--padel-line);
          background:
            linear-gradient(90deg, var(--padel-ink), rgba(19, 2, 2, 0.94) 12%, rgba(19, 2, 2, 0.94) 88%, var(--padel-ink)),
            var(--padel-ink);
          padding-block: 1.15rem;
          position: relative;
        }

        .marquee-band::before,
        .marquee-band::after {
          content: '';
          position: absolute;
          top: 0;
          bottom: 0;
          width: 4rem;
          z-index: 2;
          pointer-events: none;
        }

        .marquee-band::before {
          left: 0;
          background: linear-gradient(90deg, var(--padel-ink), transparent);
        }

        .marquee-band::after {
          right: 0;
          background: linear-gradient(270deg, var(--padel-ink), transparent);
        }

        .preloader-court__inner {
          background: rgba(140, 25, 22, 0.12);
        }

        .preloader-court__net {
          position: absolute;
          left: 50%;
          top: 0;
          bottom: 0;
          width: 1px;
          transform: translateX(-50%);
          background: var(--padel-gold);
          opacity: 0.55;
        }

        .marquee-band__track {
          display: flex;
          width: max-content;
          animation: marquee-scroll 46s linear infinite;
        }

        .marquee-band__track--reverse {
          animation-direction: reverse;
        }

        .marquee-band__group {
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }

        .marquee-band__item {
          display: inline-flex;
          align-items: center;
          gap: 2.2rem;
          padding-right: 2.2rem;
          font-size: 1.05rem;
          font-weight: 600;
          font-style: italic;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          white-space: nowrap;
          color: rgba(246, 239, 225, 0.4);
        }

        .marquee-band__item:nth-child(odd) {
          color: rgba(217, 191, 115, 0.6);
        }

        .marquee-band__star {
          font-size: 0.7rem;
          font-style: normal;
          color: var(--padel-gold);
          opacity: 0.7;
        }

        @keyframes marquee-scroll {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }

        /* ---- Submit spinner ---- */
        .submit-spinner {
          display: inline-block;
          height: 1.1rem;
          width: 1.1rem;
          border-radius: 999px;
          border: 2px solid rgba(246, 239, 225, 0.35);
          border-top-color: var(--padel-ivory);
          animation: spinner-turn 0.7s linear infinite;
        }

        @keyframes spinner-turn {
          to {
            transform: rotate(360deg);
          }
        }

        /* ---- Stat card corner ticks ---- */
        .stat-card__tick {
          position: absolute;
          height: 0.7rem;
          width: 0.7rem;
          border: 0 solid var(--padel-gold);
          opacity: 0;
          transition: opacity 0.35s ease;
        }

        .stat-card__tick--tl {
          top: -1px;
          left: -1px;
          border-top-width: 1px;
          border-left-width: 1px;
        }

        .stat-card__tick--br {
          bottom: -1px;
          right: -1px;
          border-bottom-width: 1px;
          border-right-width: 1px;
        }

        .stat-card:hover .stat-card__tick {
          opacity: 1;
        }

        .stat-card:hover .stat-card__value {
          color: var(--padel-gold);
        }

        /* ---- Touch devices: keep hover-only affordances visible ---- */
        @media (hover: none) {
          .flow-card__arrow,
          .contact-link__arrow {
            opacity: 0.75;
            transform: none;
          }

          .principle-row__check {
            opacity: 0.7;
            transform: scale(1);
          }

          .stat-card__tick {
            opacity: 0.55;
          }

          .flow-card__score {
            -webkit-text-stroke-color: rgba(217, 191, 115, 0.32);
          }
        }

        .entry-meter,
        .premium-form,
        .court-card {
          border: 1px solid var(--padel-line-strong);
        }

        .premium-form input,
        .premium-form textarea,
        .premium-form select {
          min-height: 3.2rem;
          width: 100%;
          border: none;
          border-bottom: 1px solid #cbb9a4;
          border-radius: 0;
          background: transparent;
          padding: 0.75rem 0.15rem;
          color: var(--padel-ink);
          font-family: var(--font-display);
          font-size: 1.15rem;
          outline: none;
          transition:
            border-color 0.25s ease,
            background-color 0.25s ease,
            transform 0.25s var(--padel-ease-out);
        }

        .field-select {
          appearance: none;
          cursor: pointer;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238c1916' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.15rem center;
          padding-right: 1.5rem;
        }

        .field-shell__control::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          height: 2px;
          width: 100%;
          background: var(--padel-red);
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.4s var(--padel-ease-out);
        }

        .field-shell:focus-within .field-shell__control::after {
          transform: scaleX(1);
        }

        .field-shell:focus-within input,
        .field-shell:focus-within textarea,
        .field-shell:focus-within select {
          transform: translateY(-1px);
        }

        .form-steps__dot {
          display: inline-block;
          height: 0.45rem;
          width: 0.45rem;
          border-radius: 999px;
          background: rgba(19, 2, 2, 0.14);
        }

        .form-steps__dot--active {
          width: 1.6rem;
          background: linear-gradient(90deg, var(--padel-red), #b32420);
        }

        .premium-form textarea {
          min-height: 8rem;
          resize: vertical;
        }

        .premium-form input::placeholder,
        .premium-form textarea::placeholder {
          color: rgba(19, 2, 2, 0.34);
          font-style: italic;
        }

        .premium-form label {
          position: relative;
        }

        .premium-form label::after {
          display: none;
        }

        .premium-form label:focus-within::after {
          display: none;
        }

        .premium-form input:focus,
        .premium-form textarea:focus,
        .premium-form select:focus {
          border-color: var(--padel-red);
          background: rgba(140, 25, 22, 0.028);
        }

        .visual-poster {
          position: relative;
          min-height: 600px;
          overflow: hidden;
          border: 1px solid var(--padel-line);
          background: var(--padel-red-2);
          color: var(--padel-ivory);
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.24);
        }

        .visual-poster__image {
          transition: transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .group:hover .visual-poster__image {
          transform: scale(1.06);
        }

        .visual-poster__overlay {
          position: absolute;
          inset: 0;
          z-index: 3;
          display: flex;
          align-items: flex-end;
          justify-content: flex-start;
          padding: 1.5rem;
          background: linear-gradient(180deg, transparent 35%, rgba(19, 2, 2, 0.72));
          opacity: 0;
          transition: opacity 0.45s var(--padel-ease-out);
        }

        .group:hover .visual-poster__overlay {
          opacity: 1;
        }

        .visual-poster__overlay-label {
          font-size: 0.62rem;
          font-weight: 600;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: var(--padel-gold);
        }

        .atmosphere-card:hover figcaption {
          color: var(--padel-ivory);
        }

        .court-card {
          position: relative;
          overflow: hidden;
        }

        .court-card__diagram {
          position: absolute;
          right: -1.5rem;
          top: 1.5rem;
          height: 8.5rem;
          width: 5.5rem;
          opacity: 0.16;
          pointer-events: none;
        }

        .court-card__baseline {
          position: absolute;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--padel-red);
        }

        .court-card__baseline--top {
          top: 12%;
        }

        .court-card__baseline--bottom {
          bottom: 12%;
        }

        .court-card__net {
          position: absolute;
          left: 50%;
          top: 12%;
          bottom: 12%;
          width: 2px;
          transform: translateX(-50%);
          background: var(--padel-red);
        }

        .court-card__service {
          position: absolute;
          top: 12%;
          bottom: 12%;
          width: 38%;
          border: 2px solid var(--padel-red);
        }

        .court-card__service--left {
          left: 0;
        }

        .court-card__service--right {
          right: 0;
        }

        .site-footer__mesh {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.22;
          background:
            repeating-linear-gradient(
              90deg,
              var(--padel-line) 0 1px,
              transparent 1px 48px
            ),
            repeating-linear-gradient(
              0deg,
              var(--padel-line) 0 1px,
              transparent 1px 48px
            );
        }

        .footer-link {
          position: relative;
          display: inline-flex;
          min-height: 2.75rem;
          min-width: 2.75rem;
          align-items: center;
          justify-content: center;
        }

        .footer-link::after {
          content: '';
          position: absolute;
          left: 0;
          bottom: -0.2rem;
          height: 1px;
          width: 100%;
          background: var(--padel-gold);
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.3s var(--padel-ease-out);
        }

        .footer-link:hover::after {
          transform: scaleX(1);
        }

        .footer-social {
          min-height: 2.75rem;
        }

        .visual-poster__grain {
          position: absolute;
          inset: 0;
          background:
            repeating-linear-gradient(110deg, rgba(246, 239, 225, 0.035) 0 1px, transparent 1px 8px),
            linear-gradient(180deg, rgba(0, 0, 0, 0.04), rgba(0, 0, 0, 0.24));
          opacity: 0.86;
        }

        .visual-poster__small {
          position: absolute;
          left: 2rem;
          top: 2rem;
          z-index: 2;
          max-width: 8rem;
          font-size: 0.875rem;
          font-weight: 600;
          line-height: 1.45;
          color: var(--padel-muted);
        }

        .visual-poster__title {
          position: absolute;
          inset-inline: 2rem;
          bottom: 2rem;
          z-index: 2;
          font-size: clamp(2.7rem, 6vw, 4.7rem);
          font-weight: 700;
          line-height: 0.9;
        }

        .poster-court-study {
          background:
            linear-gradient(160deg, rgba(19, 2, 2, 0.66) 0 21%, transparent 21%),
            linear-gradient(135deg, #8c1916, #5c0d0b);
        }

        .poster-court-study::before,
        .poster-court-study::after {
          content: '';
          position: absolute;
          border: 2px solid var(--padel-ivory);
          opacity: 0.86;
        }

        .poster-court-study::before {
          left: 18%;
          top: 28%;
          height: 42%;
          width: 64%;
        }

        .poster-court-study::after {
          left: 50%;
          top: 28%;
          height: 42%;
          width: 1px;
          border-width: 0 0 0 2px;
        }

        .poster-type-study {
          background:
            radial-gradient(circle at 74% 22%, rgba(246, 239, 225, 0.08), transparent 12rem),
            linear-gradient(135deg, #120202, #8c1916 52%, #6f1210);
        }

        .poster-type-study::before {
          content: 'MATADOR';
          position: absolute;
          left: -0.5rem;
          top: 42%;
          color: #e20f0b;
          font-family: var(--font-display);
          font-size: clamp(4rem, 12vw, 8.5rem);
          font-weight: 700;
          line-height: 0.8;
          transform: translateY(-50%);
          text-shadow: 0 6px 26px rgba(0, 0, 0, 0.28);
        }

        .poster-type-study::after {
          content: '';
          position: absolute;
          right: 16%;
          top: 16%;
          height: 8rem;
          width: 4rem;
          background: var(--padel-red);
          clip-path: polygon(50% 0, 82% 26%, 68% 100%, 31% 100%, 18% 26%);
          filter: drop-shadow(0 14px 24px rgba(0, 0, 0, 0.24));
        }

        @media (max-width: 1024px) {
          .poster-ball-wrap {
            width: min(560px, 48dvh, 82vw);
          }
        }

        @media (max-width: 768px) {
          .el-padel-page main > section {
            min-height: auto;
          }

          .section-pad {
            padding-top: 6.75rem;
            padding-bottom: 6.75rem;
          }

          .section-tight {
            padding-top: 5.75rem;
            padding-bottom: 5.75rem;
          }

          .poster-hero {
            display: flex;
            height: auto;
            min-height: 100svh;
            flex-direction: column;
            padding-top: max(5.75rem, calc(env(safe-area-inset-top) + 4.75rem));
            padding-bottom: max(1.25rem, calc(env(safe-area-inset-bottom) + 1.25rem));
          }

          .hero-crest {
            width: 154px;
          }

          .hero-chips {
            margin-top: 0.875rem;
            gap: 0.4rem;
          }

          .hero-chip {
            padding: 0.3rem 0.62rem;
            font-size: 0.56rem;
            letter-spacing: 0.18em;
          }

          .poster-ball-wrap {
            margin-top: 0.35rem;
            width: min(360px, 39svh, 88vw);
          }

          .poster-ball-canvas {
            min-height: 100%;
          }

          .poster-footer {
            position: relative;
            inset: auto;
            bottom: auto;
            left: auto;
            right: auto;
            width: 100%;
            margin-top: auto;
            gap: 0.75rem;
          }

          .poster-meta {
            padding: 1rem;
            backdrop-filter: blur(10px);
          }

          .poster-meta > p {
            margin-bottom: 0.65rem;
            letter-spacing: 0.24em;
          }

          .section-intro-frame {
            padding-left: 0.85rem;
          }

          .section-kicker {
            align-items: flex-start;
            gap: 0.6rem;
            letter-spacing: 0.18em;
          }

          .section-kicker__rule {
            width: 2rem;
          }

          .principle-row {
            align-items: flex-start;
            gap: 1rem;
            padding-block: 1.25rem;
          }

          .detail-row {
            gap: 1rem;
            padding: 1.65rem 1rem;
          }

          .detail-row:hover {
            transform: none;
          }

          .detail-row__count {
            top: 1.6rem;
            right: 1rem;
          }

          .stat-card {
            padding: 1.5rem;
          }

          .stat-card__value {
            font-size: 3.5rem;
          }

          .flow-card {
            min-height: auto;
            padding: 1.5rem;
          }

          .flow-card h3 {
            padding-top: 5rem;
          }

          .flow-card__tag {
            letter-spacing: 0.18em;
          }

          .visual-poster {
            min-height: min(420px, 70svh);
          }

          .flow-card__score {
            font-size: 6.5rem;
          }

          .score-rail__call {
            font-size: 1.2rem;
          }

          .score-rail__sep {
            width: 0.9rem;
          }

          .premium-form,
          .entry-meter,
          .court-card {
            padding: 1.5rem;
          }

          .premium-form {
            min-height: auto;
          }

          .premium-form input,
          .premium-form textarea,
          .premium-form select {
            min-height: 3.35rem;
            font-size: 1rem;
          }

          .contact-link {
            gap: 1rem;
          }

          .contact-link__text {
            overflow: visible;
            text-overflow: clip;
            white-space: normal;
            overflow-wrap: anywhere;
          }

          .floating-entry {
            bottom: max(0.85rem, calc(env(safe-area-inset-bottom) + 0.65rem));
          }

          .back-to-top {
            bottom: max(5.9rem, calc(env(safe-area-inset-bottom) + 5.4rem));
            right: 1rem;
          }
        }

        @media (max-width: 460px) {
          .poster-ball-copy h1 {
            font-size: clamp(1.45rem, 4.1dvh, 1.85rem);
          }

          .poster-meta p,
          .poster-meta span {
            font-size: inherit;
          }

          .poster-meta > p {
            font-size: 0.58rem;
          }

          .poster-meta .font-display {
            font-size: 1.45rem;
          }

          .mobile-menu__link {
            padding-block: 1rem;
            font-size: 2rem;
          }

          .mobile-menu nav {
            justify-content: flex-start;
          }

          .premium-form {
            padding: 1.25rem;
          }

          .premium-form > div:first-child {
            margin-bottom: 1.5rem;
            gap: 1rem;
            padding-bottom: 1.5rem;
          }

          .field-shell__label {
            letter-spacing: 0.18em;
          }

          .form-steps {
            flex-wrap: wrap;
          }

          .contact-link__text {
            font-size: 1.45rem;
          }

          .court-card h3 {
            font-size: 2.65rem;
          }

          .site-footer .font-script {
            font-size: 4.4rem;
          }

          .marquee-band__item {
            font-size: 0.85rem;
            gap: 1.5rem;
            padding-right: 1.5rem;
          }
        }

        @media (max-height: 680px) and (max-width: 900px) {
          .mobile-menu nav {
            justify-content: flex-start;
          }

          .mobile-menu__link {
            padding-block: 0.95rem;
            font-size: 1.9rem;
          }

          .poster-hero {
            min-height: auto;
            padding-bottom: max(2rem, calc(env(safe-area-inset-bottom) + 1.5rem));
          }

          .poster-ball-wrap {
            width: min(300px, 48svh, 76vw);
          }

          .poster-footer {
            margin-top: 1rem;
          }
        }

        /* ---- Short viewports (landscape phones, small laptops) ---- */
        @media (max-height: 720px) and (min-width: 768px) {
          .poster-hero {
            padding-top: 5.5rem;
            padding-bottom: 7.5rem;
          }

          .poster-ball-wrap {
            width: min(480px, 42dvh, 70vw);
          }

          .poster-footer {
            bottom: 0.85rem;
          }

          .poster-meta p,
          .poster-meta span {
            font-size: 1.4rem;
          }

          .hero-crest {
            width: 150px;
          }
        }

        @media (max-height: 560px) {
          .poster-hero {
            height: auto;
            min-height: 100dvh;
            padding-bottom: 9rem;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .stat-card,
          .detail-row,
          .detail-row::before,
          .flow-card::before,
          .flow-card__score,
          .flow-card__tag,
          .score-rail__call,
          .visual-poster__image,
          .visual-poster__overlay,
          .principle-row__check,
          .field-shell__control::after,
          .contact-link .contact-link__text,
          .floating-entry,
          .floating-entry__pulse,
          .section-kicker__index {
            transition: none !important;
            animation: none !important;
          }

          .hero-badge__svg,
          .live-badge__dot,
          .section-orbit--center,
          .marquee-band__track,
          .submit-spinner {
            animation: none !important;
          }

          .stat-card--featured {
            transform: none;
          }

          .visual-poster__overlay {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
