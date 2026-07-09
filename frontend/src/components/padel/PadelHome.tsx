'use client';

import { padelVars } from './home/constants';
import {
  Preloader,
  CursorRing,
  FilmGrain,
  PageProgress,
  PageSurface,
} from './home/effects';
import { SnapScrollController } from './home/scroll';
import {
  FloatingEntryBar,
  BackToTop,
  PadelNav,
  SiteFooter,
} from './home/chrome';
import { Hero } from './home/Hero';
import { HistorySection } from './home/HistorySection';
import { CourtsSection } from './home/CourtsSection';
import { CompetitionSection } from './home/CompetitionSection';
import { FeaturesSection } from './home/FeaturesSection';
import { SponsorsSection } from './home/SponsorsSection';
import { RegistrationSection } from './home/RegistrationSection';
import { WeatherRouteSection } from './home/WeatherRouteSection';
import { ContactSection } from './home/ContactSection';
import { PadelHomeStyles } from './home/PadelHomeStyles';

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
        <HistorySection />
        <CourtsSection />
        <CompetitionSection />
        <FeaturesSection />
        <SponsorsSection />
        <RegistrationSection />
        <WeatherRouteSection />
        <ContactSection />
      </main>
      <SiteFooter />

      <PadelHomeStyles />
    </div>
  );
}
