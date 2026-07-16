'use client';

import Image from 'next/image';
import { useI18n } from '@/components/shared/I18nProvider';
import { Reveal } from './motion';
import { ScrollSection, SectionIntro } from './scroll';

const COURT_IMAGE = {
  src: '/images/el-padel-courts-aerial-close.jpg',
  position: 'center 45%',
} as const;

export function CourtsSection() {
  const { dictionary } = useI18n();
  const courts = dictionary.home.courts;

  return (
    <ScrollSection className="section-tight relative overflow-hidden px-5 sm:px-6 md:px-10">
      <div className="mx-auto w-full max-w-7xl">
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
          <figure
            className="courts-stage courts-stage__media relative isolate mt-8 aspect-[4/3] w-full overflow-hidden rounded-[6px] bg-[#581010] shadow-[0_24px_60px_rgba(0,0,0,0.38)] sm:aspect-video lg:aspect-[21/10]"
            aria-label={courts.galleryLabel}
          >
            <Image
              src={COURT_IMAGE.src}
              alt={courts.heroAlt}
              fill
              sizes="(max-width: 639px) calc(100vw - 2.5rem), (max-width: 767px) calc(100vw - 3rem), (max-width: 1344px) calc(100vw - 5rem), 1280px"
              className="courts-stage__img object-cover [filter:saturate(1.18)_contrast(1.08)_brightness(1.03)]"
              style={{ objectPosition: COURT_IMAGE.position }}
            />
            <div
              className="pointer-events-none absolute inset-0 z-[1]"
              style={{
                background:
                  'linear-gradient(180deg, transparent 58%, rgba(88, 16, 16, 0.78) 100%)',
              }}
              aria-hidden="true"
            />
            <figcaption
              className="courts-stage__meta absolute inset-x-3 bottom-3 z-[2] flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6rem] font-semibold tracking-[0.14em] uppercase text-[rgba(213,201,177,0.92)] sm:inset-x-4 sm:bottom-4 sm:text-[0.68rem] sm:tracking-[0.2em]"
              style={{ textShadow: '0 1px 12px rgba(0, 0, 0, 0.45)' }}
            >
              <span className="tracking-[0.14em] text-[var(--padel-gold)]">01</span>
              <span>{courts.caption}</span>
            </figcaption>
          </figure>
        </Reveal>
      </div>
    </ScrollSection>
  );
}
