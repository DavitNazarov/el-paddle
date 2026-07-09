import type { CSSProperties } from 'react';

export const padelVars = {
  '--padel-red': '#801917',
  '--padel-red-2': '#641410',
  '--padel-red-3': '#4a0f0d',
  '--padel-red-light': '#962622',
  '--padel-red-left': '#5a1210',
  '--padel-red-right': '#6b1a18',
  '--padel-ink': '#130202',
  '--padel-ivory': '#f6efe1',
  '--padel-parchment': '#fff5e6',
  '--padel-muted': '#decfbd',
  '--padel-line': 'rgba(246, 239, 225, 0.18)',
  '--padel-line-strong': 'rgba(246, 239, 225, 0.36)',
  '--padel-gold': '#e0c477',
  '--padel-gold-2': '#f2e3ad',
  '--padel-gold-deep': '#a8863c',
  '--padel-ember': '#e0342b',
  '--padel-glow': 'rgba(224, 196, 119, 0.5)',
  '--padel-shadow': '0 30px 90px -30px rgba(0, 0, 0, 0.65)',
  '--padel-shadow-gold': '0 24px 70px -28px rgba(224, 196, 119, 0.35)',
} as CSSProperties;

export const navItems = [
  { key: 'history', href: '#history' },
  { key: 'courts', href: '#courts' },
  { key: 'competition', href: '#competition' },
  { key: 'sponsors', href: '#sponsors' },
  { key: 'registration', href: '#registration' },
  { key: 'contact', href: '#contact' },
] as const;

export const snapStops = [
  { id: 'top', key: 'intro' },
  { id: 'history', key: 'history' },
  { id: 'courts', key: 'courts' },
  { id: 'competition', key: 'event' },
  { id: 'features', key: 'format' },
  { id: 'sponsors', key: 'sponsors' },
  { id: 'registration', key: 'register' },
  { id: 'visit', key: 'visit' },
  { id: 'contact', key: 'contact' },
] as const;

export type SnapStopId = (typeof snapStops)[number]['id'];

export const navSectionIds = navItems.map((item) => item.href.slice(1));
