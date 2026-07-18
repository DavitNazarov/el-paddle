'use client';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from 'framer-motion';
import {
  ArrowRight,
  ArrowUp,
  Instagram,
  Menu,
  Phone,
  X,
  Zap,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import type { PublicUser } from '@/lib/auth';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { useI18n } from '@/components/shared/I18nProvider';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import { navItems } from './constants';
import { useCoarsePointer } from './device';
import { Magnetic } from './motion';

export function useSessionUser() {
  const [user, setUser] = useState<PublicUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiFetch('/api/auth/me')
      .then(async (response) => {
        if (!response.ok) return null;
        const data = (await response.json()) as { user: PublicUser | null };
        return data.user;
      })
      .then((nextUser) => {
        if (!cancelled) setUser(nextUser);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return user;
}

export function authEntryHref(user: PublicUser | null) {
  if (!user) return '/register';
  return user.role === 'ADMIN' ? '/admin' : '/dashboard';
}

export function FloatingEntryBar() {
  const reduceMotion = useReducedMotion();
  const coarse = useCoarsePointer();
  const { dictionary } = useI18n();
  const user = useSessionUser();
  const floating = dictionary.home.floating;
  const { scrollY } = useScroll();
  const [visible, setVisible] = useState(false);
  const [contactReached, setContactReached] = useState(false);
  const entryHref = authEntryHref(user);
  const entryLabel = user ? dictionary.common.dashboard : floating.cta;

  const shouldShow = useCallback((latest: number) => {
    return latest > window.innerHeight * 0.72 && !contactReached;
  }, [contactReached]);

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setVisible((previous) => {
      const next = shouldShow(latest);
      return previous === next ? previous : next;
    });
  });

  useEffect(() => {
    const update = () => setVisible(shouldShow(window.scrollY));
    const frame = window.requestAnimationFrame(update);
    window.addEventListener('resize', update);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
    };
  }, [shouldShow]);

  useEffect(() => {
    const contact = document.getElementById('contact');
    if (!contact) return;

    const observer = new IntersectionObserver(
      ([entry]) => setContactReached(entry.isIntersecting),
      { rootMargin: '0px 0px 80px 0px' },
    );
    observer.observe(contact);
    return () => observer.disconnect();
  }, []);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.aside
          initial={reduceMotion ? false : coarse ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={coarse ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: coarse ? 0.18 : 0.36, ease: [0.16, 1, 0.3, 1] }}
          className="floating-entry fixed bottom-5 left-1/2 z-[80] flex w-[min(92vw,26rem)] -translate-x-1/2 items-center gap-3 rounded-full border border-[var(--padel-line-strong)] bg-[var(--padel-ink)]/88 px-3 py-2.5 shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:bottom-7"
          aria-label={floating.cta}
        >
          <span className="floating-entry__pulse hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--padel-line)] sm:flex">
            <Zap className="h-4 w-4 text-[var(--padel-gold)]" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 pl-1 sm:pl-0">
            <p className="truncate text-[0.58rem] font-semibold uppercase tracking-[0.32em] text-[var(--padel-gold)]">
              {floating.title}
            </p>
            <p className="truncate text-sm font-medium text-[var(--padel-ivory)]">
              {floating.copy}
            </p>
          </div>
          <Magnetic strength={0.18}>
            <Button
              asChild
              variant="gold"
              className="btn-premium min-h-11 shrink-0 rounded-full px-4 focus-visible:ring-[var(--padel-gold)]"
            >
              <a href={entryHref}>
                {entryLabel}
                <ArrowRight />
              </a>
            </Button>
          </Magnetic>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

export function BackToTop() {
  const reduceMotion = useReducedMotion();
  const coarse = useCoarsePointer();
  const { dictionary } = useI18n();
  const { scrollY } = useScroll();
  const [visible, setVisible] = useState(false);

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setVisible((previous) => {
      const next = latest > window.innerHeight * 1.4;
      return previous === next ? previous : next;
    });
  });

  const scrollUp = () => {
    window.scrollTo({
      top: 0,
      behavior: reduceMotion || coarse ? 'auto' : 'smooth',
    });
  };

  return (
    <AnimatePresence>
      {visible ? (
        <motion.button
          type="button"
          initial={reduceMotion ? false : coarse ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={coarse ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
          transition={{ duration: coarse ? 0.16 : 0.26, ease: [0.16, 1, 0.3, 1] }}
          onClick={scrollUp}
          aria-label={dictionary.home.footer.backTop}
          className="back-to-top fixed bottom-5 right-5 z-[75] flex h-12 w-12 items-center justify-center rounded-full border border-[var(--padel-line-strong)] bg-[var(--padel-ink)]/80 text-[var(--padel-ivory)] transition-colors duration-200 hover:border-[var(--padel-gold)] hover:text-[var(--padel-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)] md:bottom-7 md:right-7"
        >
          <ArrowUp className="h-5 w-5" />
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}

export function MobileMenu({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: PublicUser | null;
}) {
  const { dictionary } = useI18n();
  const nav = dictionary.home.nav;
  const a11y = dictionary.home.a11y;
  const entryHref = authEntryHref(user);
  const entryLabel = user ? dictionary.common.dashboard : dictionary.common.register;

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <SheetContent
        side="top"
        className="mobile-menu flex h-dvh flex-col px-5 pb-8 pt-20 sm:px-6"
        aria-describedby={undefined}
      >
        <SheetTitle className="sr-only">{a11y.siteMenu}</SheetTitle>
        <div className="mobile-menu__lines" aria-hidden />
        <SheetClose asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={a11y.closeMenu}
            className="absolute right-4 top-4 h-11 w-11 rounded-full border border-[var(--padel-line)] text-[var(--padel-ivory)] hover:bg-[var(--padel-ivory)]/10 hover:text-[var(--padel-ivory)] focus-visible:ring-[var(--padel-gold)]"
          >
            <X />
          </Button>
        </SheetClose>

        <nav aria-label={a11y.mobileNavigation} className="mt-4 flex flex-1 flex-col justify-center gap-1">
          {navItems.map((item, index) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="mobile-menu__link font-display flex min-h-12 items-baseline gap-3 border-b border-[var(--padel-line)] py-3 text-2xl font-semibold text-[var(--padel-ivory)]"
            >
              <span className="text-xs font-semibold tracking-[0.3em] text-[var(--padel-gold)]">
                {`0${index + 1}`}
              </span>
              {nav[item.key]}
            </Link>
          ))}
        </nav>

        <Button
          asChild
          variant="gold"
          size="lg"
          className="btn-premium mt-6 min-h-12 w-full rounded-full text-base"
        >
          <Link href={entryHref} onClick={onClose}>
            {entryLabel}
            <ArrowRight className="h-5 w-5" />
          </Link>
        </Button>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--padel-line)] pt-4 text-sm font-medium text-[var(--padel-muted)]">
          <a
            href="tel:+995555000000"
            className="inline-flex min-h-11 items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]"
          >
            <Phone className="h-4 w-4 text-[var(--padel-gold)]" />
            +995 555 000 000
          </a>
          <a
            href="https://www.instagram.com/elpadell/"
            aria-label={a11y.instagram}
            className="inline-flex min-h-11 items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]"
          >
            <Instagram className="h-4 w-4 text-[var(--padel-gold)]" />
            Instagram
          </a>
        </div>
        <div className="mt-4 flex justify-center">
          <LanguageSwitcher tone="dark" />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function PadelNav() {
  const { scrollY } = useScroll();
  const pathname = usePathname();
  const { dictionary } = useI18n();
  const user = useSessionUser();
  const nav = dictionary.home.nav;
  const a11y = dictionary.home.a11y;
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const entryHref = authEntryHref(user);
  const entryLabel = user ? dictionary.common.dashboard : dictionary.common.register;

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setScrolled((previous) => {
      const next = latest > 24;
      return previous === next ? previous : next;
    });
  });

  return (
    <header className="padel-nav-header fixed inset-x-0 top-0 z-[70] px-3 pt-3 md:px-6 md:pt-5">
      <motion.div
        animate={{
          backgroundColor: scrolled ? 'rgba(88,16,16,0.62)' : 'rgba(88,16,16,0.28)',
          boxShadow: scrolled
            ? '0 22px 80px rgba(0,0,0,0.4)'
            : '0 18px 70px rgba(0,0,0,0.18)',
        }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 rounded-full border border-[var(--padel-line)] px-3 text-[var(--padel-ivory)] md:h-16 md:px-4 nav-shell"
      >
        <Link
          href="/"
          aria-label={dictionary.home.hero.ariaHome}
          className="flex min-h-11 items-center gap-2.5 rounded-full pl-1 pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]"
        >
          <Image
            src="/images/el-padel-logo-mark.png"
            alt="El Padel"
            width={44}
            height={44}
            priority
            className="logo-tint h-9 w-9 object-contain md:h-10 md:w-10"
          />
          <span className="gold-ink font-display hidden text-[0.82rem] font-semibold uppercase tracking-[0.34em] sm:inline">
            El Padel
          </span>
        </Link>

        <nav aria-label={a11y.primaryNavigation} className="hidden items-center gap-1 xl:flex">
          {navItems.map((item) => {
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'true' : undefined}
                className="nav-link group relative rounded-full px-4 py-2 text-sm font-medium text-[var(--padel-muted)] transition-colors duration-200 hover:text-[var(--padel-ivory)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]"
              >
                <span className={isActive ? 'text-[var(--padel-ivory)]' : ''}>
                  {nav[item.key]}
                </span>
                <span
                  className={`nav-link__underline absolute bottom-1 left-4 right-4 h-px origin-left bg-[var(--padel-gold)] transition-transform duration-300 ${
                    isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                  }`}
                  aria-hidden
                />
                {isActive ? (
                  <motion.span
                    layoutId="nav-active-pill"
                    className="absolute inset-0 -z-10 rounded-full border border-[var(--padel-line-strong)] bg-[var(--padel-ivory)]/[0.08]"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher tone="dark" className="hidden md:inline-flex" />
          <Magnetic strength={0.22}>
            <Button
              asChild
              variant="gold"
              className="btn-premium group hidden min-h-11 rounded-full px-4 sm:inline-flex md:px-5"
            >
              <Link href={entryHref}>
                {entryLabel}
                <ArrowRight className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </Button>
          </Magnetic>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={a11y.openMenu}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            className="h-11 w-11 rounded-full border border-[var(--padel-line)] text-[var(--padel-ivory)] hover:border-[var(--padel-line-strong)] hover:bg-[var(--padel-ivory)]/10 hover:text-[var(--padel-ivory)] focus-visible:ring-[var(--padel-gold)] xl:hidden"
          >
            <Menu />
          </Button>
        </div>
      </motion.div>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} user={user} />
    </header>
  );
}

export function SiteFooter() {
  const { dictionary, locale } = useI18n();
  const nav = dictionary.home.nav;
  const footer = dictionary.home.footer;
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer relative overflow-hidden border-t border-[var(--padel-line)] bg-[var(--padel-ink)] px-5 pb-8 pt-10 md:px-10">
      <div className="site-footer__mesh" aria-hidden />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-8">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <p className="font-script select-none text-3xl leading-[0.95] text-[var(--padel-gold)] md:text-4xl">
            El Padel
          </p>
          <div className="flex flex-wrap items-center justify-between gap-4 lg:justify-end">
            <nav
              aria-label={footer.nav}
              className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-[var(--padel-muted)]"
            >
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="footer-link transition-colors duration-200 hover:text-[var(--padel-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]"
                >
                  {nav[item.key]}
                </Link>
              ))}
            </nav>
            <Magnetic strength={0.3}>
              <a
                href="#top"
                aria-label={footer.backTop}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--padel-line-strong)] text-[var(--padel-ivory)] transition-colors duration-200 hover:border-[var(--padel-gold)] hover:text-[var(--padel-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]"
              >
                <ArrowUp className="h-4 w-4" />
              </a>
            </Magnetic>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--padel-line)] pt-5 text-[0.65rem] font-medium uppercase tracking-[0.18em] text-[var(--padel-muted)]/70">
          <span>© {year} El Padel Tournament Tbilisi</span>
          <span className="hidden md:inline">{footer.motto}</span>
          <div className="flex items-center gap-5">
            <nav aria-label={locale === 'ka' ? 'იურიდიული დოკუმენტები' : 'Legal documents'} className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Link href="/legal/privacy" className="footer-link hover:text-[var(--padel-gold)]">{locale === 'ka' ? 'კონფიდენციალურობა' : 'Privacy'}</Link>
              <Link href="/legal/terms" className="footer-link hover:text-[var(--padel-gold)]">{locale === 'ka' ? 'პირობები' : 'Terms'}</Link>
              <Link href="/legal/refunds" className="footer-link hover:text-[var(--padel-gold)]">{locale === 'ka' ? 'დაბრუნება' : 'Refunds'}</Link>
              <Link href="/legal/cookies" className="footer-link hover:text-[var(--padel-gold)]">Cookie</Link>
            </nav>
            <a
              href="https://www.instagram.com/elpadell/"
              className="footer-social inline-flex items-center gap-2 transition-colors duration-200 hover:text-[var(--padel-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--padel-gold)]"
            >
              <Instagram className="h-4 w-4" />
              Instagram
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
