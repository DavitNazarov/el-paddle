'use client';

import { padelVars } from './home/constants';
import {
  CursorRing,
  FilmGrain,
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
import { ViewportDeferredSection } from './home/scroll';
import {
  PadelNav,
  SiteFooter,
} from './home/chrome';
import { Hero } from './home/Hero';
import { MarqueeBand } from './home/motion';
import { PadelHomeStyles } from './home/PadelHomeStyles';

export function PadelHome() {
  return (
    <div
      style={padelVars}
      className="el-padel-page min-h-screen overflow-x-clip bg-[var(--padel-red)] text-[var(--padel-ivory)]"
    >
      <CursorRing />
      <FilmGrain />
      <PadelNav />
      <main className="page-canvas relative">
        <PageSurface />
        <Hero />
        <MarqueeBand />
        <ViewportDeferredSection id="history">
          <HistorySection />
        </ViewportDeferredSection>
        <ViewportDeferredSection id="courts">
          <CourtsSection />
        </ViewportDeferredSection>
        <ViewportDeferredSection id="visit">
          <WeatherRouteSection />
        </ViewportDeferredSection>
        <ViewportDeferredSection id="competition">
          <CompetitionSection />
        </ViewportDeferredSection>
        <ViewportDeferredSection id="features">
          <FeaturesSection />
        </ViewportDeferredSection>
        <ViewportDeferredSection id="sponsors">
          <SponsorsSection />
        </ViewportDeferredSection>
        <ViewportDeferredSection id="registration">
          <RegistrationSection />
        </ViewportDeferredSection>
        <ViewportDeferredSection id="contact">
          <ContactSection />
        </ViewportDeferredSection>
      </main>
      <SiteFooter />

      <PadelHomeStyles />
    </div>
  );
}
