'use client';

import { Crown, Medal, Sparkles, Trophy } from 'lucide-react';
import { useI18n } from '@/components/shared/I18nProvider';
import { Parallax, ParallaxLayer, Reveal, Stagger, StaggerItem } from './motion';
import { ScrollSection, SectionIntro } from './scroll';

export function FeaturesSection() {
  const { dictionary } = useI18n();
  const features = dictionary.home.features;

  return (
    <ScrollSection
      className="section-tight relative overflow-hidden px-5 md:px-10"
    >
      <ParallaxLayer className="section-orbit section-orbit--right" speed={-0.45} rotate={-18} />
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <Parallax speed={0.24}>
            <div className="max-w-3xl">
              <SectionIntro
                index={features.index}
                kicker={features.kicker}
                title={features.title}
                accent={features.accent}
                copy={features.copy}
              />
            </div>
          </Parallax>
        </Reveal>

        <Reveal delay={0.1}>
          <Parallax speed={0.18} className="mt-8">
            <div className="prize-pool-shell relative overflow-hidden border border-[var(--padel-line-strong)]">
              <div className="prize-pool__court" aria-hidden>
                <span className="prize-pool__court-outline" />
                <span className="prize-pool__court-center" />
                <span className="prize-pool__court-circle" />
              </div>

              <div className="prize-pool-head relative z-[1] grid gap-5 border-b border-[var(--padel-line)] p-5 md:grid-cols-[1fr_0.9fr] md:items-end md:p-8">
                <div className="prize-total-lockup flex items-center gap-4 md:gap-5">
                  <span className="prize-total-lockup__mark" aria-hidden>
                    <Trophy className="h-5 w-5 md:h-6 md:w-6" strokeWidth={1.6} />
                  </span>
                  <div>
                    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-[var(--padel-gold)]">
                      {features.poolLabel}
                    </p>
                    <h3 className="prize-total-lockup__amount font-display mt-1 font-semibold leading-none text-[var(--padel-ivory)]">
                      {features.total}
                    </h3>
                  </div>
                </div>
                <p className="prize-pool-head__copy max-w-lg text-sm leading-6 text-[var(--padel-muted)]">
                  {features.poolCopy}
                </p>
              </div>

              <div className="prize-podium-wrap relative z-[1]">
                <span className="prize-podium__halo" aria-hidden />
                <Stagger
                  className="prize-podium"
                  delay={0.12}
                  stagger={0.09}
                >
                  {features.tiers.map((tier, index) => {
                    const TierIcon = index === 0 ? Crown : Medal;

                    return (
                      <StaggerItem
                        key={tier.place}
                        className={`prize-podium__item prize-podium__item--${index + 1}`}
                      >
                        <article
                          className={`prize-tier relative flex h-full overflow-hidden border border-[var(--padel-line)] ${
                            index === 0 ? 'prize-tier--featured' : ''
                          }`}
                        >
                          <span className="prize-tier__shine" aria-hidden />
                          <span className="prize-tier__rank" aria-hidden>
                            0{index + 1}
                          </span>

                          <div className="prize-tier__content relative z-[1] flex min-w-0 flex-1 flex-col p-5 md:p-6">
                            <span className="prize-tier__medal" aria-hidden>
                              <TierIcon className="h-4 w-4" strokeWidth={1.7} />
                            </span>
                            <div className="mt-auto pt-10">
                              <p className="prize-tier__place text-[0.62rem] font-semibold uppercase tracking-[0.2em]">
                                {tier.place}
                              </p>
                              <p className="prize-tier__amount font-display mt-2 font-semibold leading-none">
                                {tier.amount}
                              </p>
                              <p className="prize-tier__bonus mt-4 flex items-center gap-1.5 text-[0.58rem] font-semibold uppercase tracking-[0.15em]">
                                <Sparkles className="h-3 w-3 shrink-0" aria-hidden />
                                {tier.bonus}
                              </p>
                            </div>
                          </div>

                          <span className="prize-tier__step" aria-hidden />
                        </article>
                      </StaggerItem>
                    );
                  })}
                </Stagger>
                <span className="prize-podium__baseline" aria-hidden />
              </div>
            </div>
          </Parallax>
        </Reveal>
      </div>
    </ScrollSection>
  );
}
