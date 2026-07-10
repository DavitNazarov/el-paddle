'use client';

import { useRef } from 'react';
import Image from 'next/image';
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'framer-motion';
import { Check } from 'lucide-react';
import { useI18n } from '@/components/shared/I18nProvider';
import { useScrollParallaxEnabled } from './device';
import { Parallax, ParallaxLayer, Reveal } from './motion';
import { ScrollSection, SectionIntro } from './scroll';

export function HistorySection() {
  const reduceMotion = useReducedMotion();
  const scrollParallax = useScrollParallaxEnabled();
  const { dictionary } = useI18n();
  const history = dictionary.home.history;
  const principles = dictionary.home.principles;
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ['-6%', '6%']);
  const imageScale = useTransform(scrollYProgress, [0, 0.5, 1], [1.08, 1.02, 1.08]);
  const imageMotionStyle =
    scrollParallax && !reduceMotion ? { y: imageY, scale: imageScale } : undefined;

  return (
    <ScrollSection
      className="section-pad relative overflow-hidden px-5 md:px-10"
    >
      <ParallaxLayer className="section-orbit section-orbit--left" speed={0.55} rotate={18} />
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:gap-14">
        <Reveal>
          <div ref={ref} className="poster-frame">
            <span className="poster-frame__tick poster-frame__tick--tl" aria-hidden />
            <span className="poster-frame__tick poster-frame__tick--tr" aria-hidden />
            <span className="poster-frame__tick poster-frame__tick--bl" aria-hidden />
            <span className="poster-frame__tick poster-frame__tick--br" aria-hidden />
            <div className="poster-frame__media">
              <motion.div
                className="poster-frame__inner"
                style={imageMotionStyle}
              >
                <Image
                  src="/images/el-padel-player-poster.jpeg"
                  alt={history.imageAlt}
                  fill
                  sizes="(max-width: 1024px) 90vw, 45vw"
                  className="object-cover"
                />
              </motion.div>
            </div>
            <span className="poster-frame__caption">{history.caption}</span>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <Parallax speed={0.18}>
          <div>
            <SectionIntro
              index={history.index}
              kicker={history.kicker}
              title={history.title}
              accent={history.accent}
              copy={history.copy}
            />

            <div className="mt-8 space-y-2">
              {principles.map((item, index) => (
                <motion.div
                  key={item}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true, amount: 0.35 }}
                  transition={{ duration: 0.5, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  className="principle-row group relative flex min-h-0 items-center gap-3 overflow-hidden rounded-xl border border-[var(--padel-line)] px-4 py-3"
                >
                  <span className="principle-row__num font-display shrink-0 text-sm font-semibold italic text-[var(--padel-gold)]/80">
                    {`0${index + 1}`}
                  </span>
                  <p className="principle-row__copy text-sm leading-6 text-[var(--padel-ivory)]/88">
                    {item}
                  </p>
                  <span className="principle-row__check-shell ml-auto shrink-0">
                    <Check className="principle-row__check h-3.5 w-3.5 text-[var(--padel-gold)]" />
                  </span>
                </motion.div>
              ))}
            </div>

            <motion.p
              className="font-script mt-8 text-2xl leading-tight text-[var(--padel-gold)] md:text-3xl"
              initial={reduceMotion ? false : { opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              {history.signoff}
            </motion.p>
          </div>
          </Parallax>
        </Reveal>
      </div>
    </ScrollSection>
  );
}
