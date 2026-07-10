'use client';

import { useI18n } from '@/components/shared/I18nProvider';
import { Parallax, Reveal, Stagger, StaggerItem, Tilt } from './motion';
import { ScrollSection, SectionIntro } from './scroll';

export function SponsorsSection() {
  const { dictionary } = useI18n();
  const sponsors = dictionary.home.sponsors;
  const accentGradients = [
    'from-[var(--padel-red)]/40 via-[var(--padel-red-right)]/18 to-transparent',
    'from-[var(--padel-gold)]/40 via-[var(--padel-gold)]/15 to-transparent',
    'from-[#f39d55]/35 via-[var(--padel-red)]/12 to-transparent',
    'from-[#8f5f52]/35 via-[var(--padel-gold)]/12 to-transparent',
  ] as const;

  return (
    <ScrollSection className="section-pad relative overflow-hidden px-5 md:px-10">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <Parallax speed={0.2}>
          <div className="grid gap-6 border-b border-[var(--padel-line)] pb-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <SectionIntro
              index={sponsors.index}
              kicker={sponsors.kicker}
              title={sponsors.title}
              accent={sponsors.accent}
            />
            <p className="max-w-xl text-sm leading-6 text-[var(--padel-muted)] lg:justify-self-end">
              {sponsors.copy}
            </p>
          </div>
          </Parallax>
        </Reveal>

        <Stagger className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-4" delay={0.08} stagger={0.07}>
          {sponsors.items.map((sponsor, index) => (
            <StaggerItem key={sponsor.title}>
              <Tilt max={5}>
              <article className="group relative h-full overflow-hidden rounded-xl border border-[var(--padel-line)]/80 bg-[var(--padel-ink)]/45 p-4 backdrop-blur-sm transition-all duration-300 hover:border-[var(--padel-line-strong)]">
                <div
                  className={`pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-r ${
                    accentGradients[index % accentGradients.length]
                  } opacity-60`}
                  aria-hidden
                />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="rounded-lg border border-[var(--padel-line)] bg-black/20 px-2.5 py-1.5">
                    <span className="font-display text-sm font-semibold text-[var(--padel-gold)]">
                      {`0${index + 1}`}
                    </span>
                  </div>
                  <span className="inline-flex items-center rounded-full border border-[var(--padel-line)] bg-black/20 px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-[var(--padel-gold)]/85">
                    {sponsors.tag}
                  </span>
                </div>
                <h3 className="font-display mt-3 text-lg font-semibold text-[var(--padel-ivory)] md:text-xl">
                  {sponsor.title}
                </h3>
                <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[var(--padel-gold)]">
                  {sponsor.role}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--padel-muted)]">
                  {sponsor.copy}
                </p>
              </article>
              </Tilt>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal delay={0.1}>
          <div className="mt-5 rounded-xl border border-[var(--padel-line)] bg-[var(--padel-red)]/8 px-4 py-3 text-sm leading-6 text-[var(--padel-muted)]">
            {sponsors.note}
          </div>
        </Reveal>
      </div>
    </ScrollSection>
  );
}
