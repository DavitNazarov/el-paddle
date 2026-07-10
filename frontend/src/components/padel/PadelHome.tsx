'use client';

import { Suspense } from 'react';
import { padelVars } from './home/constants';
import {
  Preloader,
  CursorRing,
  FilmGrain,
  PageProgress,
  PageSurface,
} from './home/effects';
import {
  ContactSection,
  CompetitionSection,
  CourtsSection,
  FeaturesSection,
  HistorySection,
  RegistrationSection,
  SponsorsSection,
  WeatherRouteSection,
} from './home/lazy-sections';
import {
  SnapScrollController,
  LazyMount,
  ViewportDeferredSection,
} from './home/scroll';
import {
  FloatingEntryBar,
  BackToTop,
  PadelNav,
  SiteFooter,
} from './home/chrome';
import { Hero } from './home/Hero';
import { MarqueeBand } from './home/motion';
import { PadelHomeStyles } from './home/PadelHomeStyles';

function DeferredSection({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

export function PadelHome() {
  return (
    <div
      style={padelVars}
      className="el-padel-page min-h-screen overflow-x-clip bg-[var(--padel-red)] text-white"
    >
      <Preloader />
      <CursorRing />
      <FilmGrain />
      <PageProgress />
      <PadelNav />
      <SnapScrollController />
      <FloatingEntryBar />
      <BackToTop />
      <main className="page-canvas relative">
        <PageSurface />
        <Hero />
        <LazyMount>
          <MarqueeBand />
        </LazyMount>
        <ViewportDeferredSection id="history">
          <DeferredSection><HistorySection /></DeferredSection>
        </ViewportDeferredSection>
        <ViewportDeferredSection id="courts">
          <DeferredSection><CourtsSection /></DeferredSection>
        </ViewportDeferredSection>
        <ViewportDeferredSection id="competition">
          <DeferredSection><CompetitionSection /></DeferredSection>
        </ViewportDeferredSection>
        <ViewportDeferredSection id="features">
          <DeferredSection><FeaturesSection /></DeferredSection>
        </ViewportDeferredSection>
        <ViewportDeferredSection id="sponsors">
          <DeferredSection><SponsorsSection /></DeferredSection>
        </ViewportDeferredSection>
        <ViewportDeferredSection id="registration">
          <DeferredSection><RegistrationSection /></DeferredSection>
        </ViewportDeferredSection>
        <ViewportDeferredSection id="visit">
          <DeferredSection><WeatherRouteSection /></DeferredSection>
        </ViewportDeferredSection>
        <ViewportDeferredSection id="contact">
          <DeferredSection><ContactSection /></DeferredSection>
        </ViewportDeferredSection>
      </main>
      <LazyMount eager>
        <SiteFooter />
      </LazyMount>

      <PadelHomeStyles />
    </div>
  );
}
