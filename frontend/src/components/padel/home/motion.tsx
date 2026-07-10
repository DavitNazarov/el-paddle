'use client';

import {
  ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
import { useI18n } from '@/components/shared/I18nProvider';
import { useCoarsePointer, useScrollParallaxEnabled } from './device';

export function Magnetic({
  children,
  className = '',
  strength = 0.32,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const reduceMotion = useReducedMotion();
  const coarse = useCoarsePointer();

  if (reduceMotion || coarse) {
    return <div className={className} style={{ display: 'inline-flex' }}>{children}</div>;
  }

  return (
    <MagneticMotion className={className} strength={strength}>
      {children}
    </MagneticMotion>
  );
}

function MagneticMotion({
  children,
  className,
  strength,
}: {
  children: ReactNode;
  className: string;
  strength: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 220, damping: 18, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 220, damping: 18, mass: 0.4 });

  const handleMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
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

export function WordReveal({
  text,
  className = '',
  delay = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();
  const coarse = useCoarsePointer();
  const words = text.split(' ');

  if (reduceMotion || coarse) {
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

export function Counter({
  to,
  suffix = '',
  duration = 1.6,
}: {
  to: number;
  suffix?: string;
  duration?: number;
}) {
  const reduceMotion = useReducedMotion();
  const coarse = useCoarsePointer();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-15%' });
  const [value, setValue] = useState(0);
  const shouldSkipMotion = Boolean(reduceMotion || coarse);
  const displayValue = shouldSkipMotion ? to : value;

  useEffect(() => {
    if (!inView || shouldSkipMotion) return;
    const controls = animate(0, to, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setValue(Math.round(latest)),
    });
    return () => controls.stop();
  }, [duration, inView, shouldSkipMotion, to]);

  return (
    <span ref={ref}>
      {displayValue}
      {suffix}
    </span>
  );
}

export function Parallax({
  children,
  className = '',
  // Call-site API kept; scroll-linked y disabled (Safari scroll/JS desync).
  speed: _speed = 0.5,
}: {
  children: ReactNode;
  className?: string;
  speed?: number;
}) {
  void _speed;
  return <div className={`relative ${className}`}>{children}</div>;
}

export function ParallaxLayer({
  className = '',
  speed = 0.6,
  rotate = 0,
}: {
  className?: string;
  speed?: number;
  rotate?: number;
}) {
  const scrollParallax = useScrollParallaxEnabled();

  if (!scrollParallax) {
    return (
      <div
        className={className}
        style={rotate ? { transform: `rotate(${rotate}deg)` } : undefined}
        aria-hidden
      />
    );
  }

  return <ParallaxLayerMotion className={className} speed={speed} rotate={rotate} />;
}

function ParallaxLayerMotion({
  className,
  speed,
  rotate,
}: {
  className: string;
  speed: number;
  rotate: number;
}) {
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
      style={{ y, rotate }}
      aria-hidden
    />
  );
}

export function Tilt({
  children,
  className = '',
  max = 5,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const reduceMotion = useReducedMotion();
  const coarse = useCoarsePointer();

  if (reduceMotion || coarse) {
    return <div className={className}>{children}</div>;
  }

  return (
    <TiltMotion className={className} max={max}>
      {children}
    </TiltMotion>
  );
}

function TiltMotion({
  children,
  className,
  max,
}: {
  children: ReactNode;
  className: string;
  max: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springRotateX = useSpring(rotateX, { stiffness: 180, damping: 22 });
  const springRotateY = useSpring(rotateY, { stiffness: 180, damping: 22 });

  const handleMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
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

const easeOut = [0.16, 1, 0.3, 1] as const;

export function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();
  const coarse = useCoarsePointer();

  if (reduceMotion || coarse) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.64, delay, ease: easeOut }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function Stagger({
  children,
  className = '',
  delay = 0,
  stagger = 0.07,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  const reduceMotion = useReducedMotion();
  const coarse = useCoarsePointer();

  if (reduceMotion || coarse) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: stagger, delayChildren: delay },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className = '',
  y: _y = 22,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
}) {
  void _y;
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { duration: 0.58, ease: easeOut },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export function MarqueeBand() {
  const reduceMotion = useReducedMotion();
  const coarse = useCoarsePointer();
  const { dictionary } = useI18n();
  const items = dictionary.home.marquee;
  const sequence = [...items, ...items];
  const staticTrack = reduceMotion || coarse;

  const renderGroup = (keyPrefix: string) => (
    <div className="marquee-band__group">
      {sequence.map((item, index) => (
        <span key={`${keyPrefix}-${item}-${index}`} className="marquee-band__item">
          {item}
          <span className="marquee-band__star">✦</span>
        </span>
      ))}
    </div>
  );

  return (
    <div className="marquee-band" aria-hidden>
      {staticTrack ? (
        <div className="marquee-band__track marquee-band__track--static">
          {renderGroup('static')}
        </div>
      ) : (
        <motion.div
          className="marquee-band__track"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 46, repeat: Infinity, ease: 'linear' }}
        >
          {renderGroup('a')}
          {renderGroup('b')}
        </motion.div>
      )}
    </div>
  );
}
