'use client';

import { useI18n } from '@/components/shared/I18nProvider';
import { Parallax, ParallaxLayer, Reveal } from './motion';
import { ScrollSection, SectionIntro } from './scroll';

export function FeaturesSection() {
  const { dictionary } = useI18n();
  const features = dictionary.home.features;

  return (
    <ScrollSection
      id="features"
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
            <div className="prize-pool-shell border border-[var(--padel-line)] p-4 md:p-6">
              <div className="prize-pool-head flex flex-col gap-3 border-b border-[var(--padel-line)] pb-5 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[var(--padel-gold)]">
                    {features.poolLabel}
                  </p>
                  <h3 className="font-display mt-2 text-3xl font-semibold leading-tight text-[var(--padel-ivory)] md:text-4xl">
                    {features.total}
                  </h3>
                </div>
                <p className="max-w-lg text-sm leading-6 text-[var(--padel-muted)]">
                  {features.poolCopy}
                </p>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {features.tiers.map((tier, index) => (
                  <article
                    key={tier.place}
                    className={`prize-tier relative overflow-hidden border border-[var(--padel-line)] p-4 ${
                      index === 0 ? 'prize-tier--featured' : ''
                    }`}
                  >
                    <span className="prize-tier__shine" aria-hidden />
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--padel-muted)]/85">
                      {tier.place}
                    </p>
                    <p className="font-display mt-2 text-2xl font-semibold leading-none text-[var(--padel-ivory)] md:text-3xl">
                      {tier.amount}
                    </p>
                    <p className="mt-2 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--padel-gold)]/90">
                      {tier.bonus}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </Parallax>
        </Reveal>
      </div>
    </ScrollSection>
  );
}
