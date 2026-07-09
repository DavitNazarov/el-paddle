'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Users } from 'lucide-react';
import { useI18n } from '@/components/shared/I18nProvider';
import { Counter, Parallax, Reveal } from './motion';
import { ScrollSection, SectionIntro } from './scroll';

export function RegistrationSection() {
  const { dictionary } = useI18n();
  const registration = dictionary.home.registration;

  return (
    <ScrollSection
      id="registration"
      className="section-pad relative overflow-hidden px-5 md:px-10"
    >
      <div className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-start lg:gap-12">
        <Reveal>
          <div className="lg:sticky lg:top-24">
            <SectionIntro
              index={registration.index}
              kicker={registration.kicker}
              title={registration.title}
              accent={registration.accent}
              copy={registration.copy}
            />

            <div className="entry-meter glass-card mt-8 border border-[var(--padel-line)] p-5">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <span className="live-badge mb-2 inline-flex items-center gap-2 rounded-full border border-[var(--padel-line)] px-2.5 py-1 text-[0.58rem] font-semibold uppercase tracking-[0.22em] text-[var(--padel-ivory)]">
                    <span className="live-badge__dot" aria-hidden />
                    {registration.badge}
                  </span>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[var(--padel-gold)]">
                    {registration.readiness}
                  </p>
                </div>
                <p className="font-display text-3xl font-semibold text-[var(--padel-ivory)]">
                  <Counter to={75} suffix="%" />
                </p>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--padel-ivory)]/18">
                <motion.div
                  className="entry-meter__fill h-full origin-left rounded-full"
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 0.75 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--padel-muted)]">
                {registration.meterCopy}
              </p>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <Parallax speed={0.16}>
          <div className="premium-form bg-[var(--padel-parchment)] p-5 text-[var(--padel-ink)] md:p-7">
            <div className="mb-6 flex items-start justify-between gap-4 border-b border-[#dacbb9] pb-5">
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[var(--padel-red)]">
                  {registration.cardKicker}
                </p>
                <p className="font-display mt-1.5 text-2xl font-semibold text-[var(--padel-ink)] md:text-3xl">
                  {registration.cardTitle}
                </p>
                <div className="form-steps mt-3 flex items-center gap-2" aria-hidden>
                  {[1, 2, 3].map((step) => (
                    <span key={step} className={`form-steps__dot ${step === 1 ? 'form-steps__dot--active' : ''}`} />
                  ))}
                  <span className="ml-1 text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-[var(--padel-ink)]/45">
                    {registration.stepsLabel}
                  </span>
                </div>
              </div>
              <Users className="mt-1 h-5 w-5 text-[var(--padel-red)]" />
            </div>

            <div className="grid gap-3">
              {registration.steps.map(([step, title, copy]) => (
                <div key={step} className="border-b border-[#dacbb9] pb-3 last:border-b-0">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--padel-red)]">{step}</p>
                  <h3 className="font-display mt-1 text-lg font-semibold md:text-xl">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--padel-ink)]/65">{copy}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <a
                href="/register"
                className="btn-premium btn-premium--dark group inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[var(--padel-red)] px-5 py-2.5 text-sm font-semibold text-[var(--padel-ivory)] hover:bg-[#6f1210] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-ink)]"
              >
                {dictionary.common.register}
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </a>
              <a
                href="/login"
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-[var(--padel-ink)]/25 px-5 py-2.5 text-sm font-semibold text-[var(--padel-ink)] transition-colors duration-200 hover:border-[var(--padel-red)] hover:text-[var(--padel-red)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-red)]"
              >
                {dictionary.common.login}
              </a>
            </div>
          </div>
          </Parallax>
        </Reveal>
      </div>
    </ScrollSection>
  );
}
