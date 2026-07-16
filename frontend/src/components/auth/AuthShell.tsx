'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { useI18n } from '@/components/shared/I18nProvider';

type AuthShellProps = {
  variant: 'register' | 'login' | 'invite' | 'completeClub';
  children: ReactNode;
};

export function AuthShell({ variant, children }: AuthShellProps) {
  const { dictionary, t } = useI18n();
  const content = dictionary.authShell[variant];

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[var(--padel-red)] px-4 py-5 text-[var(--padel-ivory)] sm:px-5 md:px-8 md:py-6">
      <div className="pointer-events-none fixed inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_12%,rgba(213,201,177,0.22),transparent_34%),radial-gradient(circle_at_84%_72%,rgba(134,0,12,0.72),transparent_42%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(213,201,177,0.07)_1px,transparent_1px),linear-gradient(180deg,rgba(213,201,177,0.05)_1px,transparent_1px)] bg-[size:88px_88px] opacity-30" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-7xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <Button asChild variant="outline" className="border-[var(--padel-line)] bg-transparent text-[var(--padel-ivory)] hover:bg-[var(--padel-ivory)] hover:text-[var(--padel-red)]">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              {t('authShell.backHome')}
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <LanguageSwitcher tone="dark" />
            <Image
              src="/images/el-padel-logo-mark.png"
              alt="El Padel"
              width={52}
              height={52}
              priority
              className="logo-tint h-12 w-12 object-contain"
            />
          </div>
        </header>

        <section className="grid flex-1 gap-10 py-10 md:py-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(24rem,34rem)] lg:items-center lg:gap-12 xl:grid-cols-[minmax(0,0.95fr)_minmax(28rem,38rem)] xl:gap-16">
          <div className="max-w-xl xl:max-w-2xl">
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--padel-line)] bg-[var(--padel-red)]/24 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.26em] text-[var(--padel-gold)]">
              <ShieldCheck className="h-4 w-4" aria-hidden />
              {content.kicker}
            </span>
            <h1 className="font-display text-4xl font-semibold leading-[0.98] sm:text-5xl md:text-6xl xl:text-7xl">
              {content.title}
            </h1>
            <p className="mt-7 max-w-xl text-base leading-8 text-[var(--padel-muted)] md:text-lg">
              {content.copy}
            </p>
          </div>

          <Card className="w-full max-w-[38rem] justify-self-stretch overflow-hidden rounded-sm border-[var(--padel-line-strong)] bg-[var(--padel-parchment)] text-[var(--padel-ink)] shadow-[0_34px_120px_rgba(0,0,0,0.32)] lg:justify-self-end">
            <CardContent className="p-5 sm:p-6 md:p-8">{children}</CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
