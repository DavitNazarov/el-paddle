'use client';

import Image from 'next/image';
import { useI18n } from '@/components/shared/I18nProvider';
import { Parallax, ParallaxLayer, Reveal } from './motion';
import { ScrollSection, SectionIntro } from './scroll';

export function HistorySection() {
  const { dictionary } = useI18n();
  const history = dictionary.home.history;

  return (
    <ScrollSection
      className="section-pad relative overflow-hidden px-5 md:px-10"
    >
      <ParallaxLayer className="section-orbit section-orbit--left" speed={0.55} rotate={18} />
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:gap-14">
        <Reveal>
          <div className="poster-frame">
            <span className="poster-frame__tick poster-frame__tick--tl" aria-hidden />
            <span className="poster-frame__tick poster-frame__tick--tr" aria-hidden />
            <span className="poster-frame__tick poster-frame__tick--bl" aria-hidden />
            <span className="poster-frame__tick poster-frame__tick--br" aria-hidden />
            <div className="poster-frame__media">
              <div className="poster-frame__inner">
                <Image
                  src="/images/el-padel-story.jpeg"
                  alt={history.imageAlt}
                  fill
                  sizes="(max-width: 1024px) 90vw, 45vw"
                  className="object-cover"
                />
              </div>
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
          </div>
          </Parallax>
        </Reveal>
      </div>
    </ScrollSection>
  );
}
