'use client';

import Image from 'next/image';
import {
  ArrowRight,
  ArrowUpRight,
  Instagram,
  Mail,
  Phone,
} from 'lucide-react';
import { useI18n } from '@/components/shared/I18nProvider';
import { Magnetic, WordReveal, Parallax, Reveal } from './motion';
import { ScrollSection } from './scroll';

export function ContactSection() {
  const { dictionary } = useI18n();
  const contact = dictionary.home.contact;
  const contactLinks = [
    { href: 'tel:+995555000000', icon: Phone, ...contact.cards[0] },
    { href: 'mailto:register@elpadel.club', icon: Mail, ...contact.cards[1] },
    { href: 'https://www.instagram.com/elpadell/', icon: Instagram, ...contact.cards[2] },
  ];

  return (
    <ScrollSection
      id="contact"
      className="section-pad relative overflow-hidden px-5 text-center md:px-10"
    >
      <div className="section-orbit section-orbit--center" aria-hidden />
      <Reveal>
        <Parallax speed={0.14}>
        <div className="relative mx-auto max-w-3xl">
          <Parallax speed={0.28}>
            <Image
              src="/images/el-padel-logo.png"
              alt="El Padel — gold matador crest"
              width={280}
              height={186}
              className="mx-auto h-auto w-[100px] object-contain md:w-[120px]"
            />
          </Parallax>
          <p className="font-script mt-4 text-2xl leading-none text-[var(--padel-gold)] md:text-3xl">
            {contact.title}
          </p>
          <p className="mb-4 mt-3 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[var(--padel-muted)]">
            {contact.kicker}
          </p>
          <h2 className="font-display text-2xl font-semibold leading-[1.15] text-[var(--padel-ivory)] sm:text-3xl md:text-4xl">
            <WordReveal text={contact.headline} />{' '}
            <WordReveal text={contact.accent} delay={0.18} className="section-accent" />
          </h2>

          <div className="mt-8 grid gap-3 text-left md:grid-cols-3">
            {contactLinks.map(({ href, icon: LinkIcon, kicker, text }) => (
              <a
                key={href}
                href={href}
                className="contact-link group flex min-h-0 flex-col justify-between gap-4 rounded-sm border border-[var(--padel-line)] p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-ivory)]"
              >
                <span className="contact-link__icon flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--padel-line)] transition-colors duration-300">
                  <LinkIcon className="h-3.5 w-3.5 text-[var(--padel-ivory)]" />
                </span>
                <span>
                  <span className="block text-[0.58rem] font-semibold uppercase tracking-[0.2em] text-[var(--padel-gold)]/80">
                    {kicker}
                  </span>
                  <span className="contact-link__text font-display mt-1 block text-lg font-semibold text-[var(--padel-ivory)]">
                    {text}
                  </span>
                </span>
                <ArrowUpRight className="contact-link__arrow h-4 w-4 shrink-0 text-[var(--padel-gold)]" />
              </a>
            ))}
          </div>

          <Magnetic className="mt-8" strength={0.25}>
            <a
              href="/register"
              className="btn-premium inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[var(--padel-ivory)] px-5 py-2.5 text-sm font-semibold text-[var(--padel-red)] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]"
            >
              {dictionary.common.register}
              <ArrowRight className="h-4 w-4" />
            </a>
          </Magnetic>

          <p className="mt-10 text-[0.65rem] uppercase tracking-[0.22em] text-[var(--padel-muted)]/70">
            {contact.footer}
          </p>
        </div>
        </Parallax>
      </Reveal>
    </ScrollSection>
  );
}
