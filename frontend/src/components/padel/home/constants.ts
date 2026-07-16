import type { CSSProperties } from 'react';

export const padelVars = {
  '--padel-red': '#86000c',
  '--padel-red-2': '#581010',
  '--padel-red-3': '#581010',
  '--padel-red-light': '#86000c',
  '--padel-red-left': '#581010',
  '--padel-red-right': '#581010',
  '--padel-ink': '#581010',
  '--padel-ivory': '#d5c9b1',
  '--padel-parchment': '#d5c9b1',
  '--padel-muted': '#d5c9b1',
  '--padel-line': 'rgba(213, 201, 177, 0.18)',
  '--padel-line-strong': 'rgba(213, 201, 177, 0.36)',
  '--padel-gold': '#d5c9b1',
  '--padel-gold-2': '#d5c9b1',
  '--padel-gold-deep': '#d5c9b1',
  '--padel-ember': '#86000c',
  '--padel-glow': 'rgba(213, 201, 177, 0.5)',
  '--padel-shadow': '0 30px 90px -30px rgba(0, 0, 0, 0.65)',
  '--padel-shadow-gold': '0 24px 70px -28px rgba(213, 201, 177, 0.35)',
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
  { id: 'visit', key: 'visit' },
  { id: 'registration', key: 'register' },
  { id: 'contact', key: 'contact' },
] as const;

export type SnapStopId = (typeof snapStops)[number]['id'];

export const navSectionIds = navItems.map((item) => item.href.slice(1));
