'use client';

/** Professional dashboard styles — quiet surfaces, restrained brand accents. */
export function DashboardStyles() {
  return (
    <style jsx global>{`
      .dash-app {
        --dash-surface: rgba(246, 239, 225, 0.045);
        --dash-surface-strong: rgba(246, 239, 225, 0.08);
        --dash-border: rgba(246, 239, 225, 0.1);
        --dash-border-strong: rgba(246, 239, 225, 0.2);
        --dash-text: var(--padel-ivory);
        --dash-muted: rgba(246, 239, 225, 0.55);
        --dash-faint: rgba(246, 239, 225, 0.38);
        position: relative;
        isolation: isolate;
        min-height: 100dvh;
        overflow-x: clip;
        color: var(--dash-text);
        background: #100808;
      }

      .dash-app::before {
        content: '';
        position: fixed;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        background:
          radial-gradient(ellipse 70% 40% at 0% 0%, rgba(140, 25, 22, 0.12), transparent 55%),
          radial-gradient(ellipse 50% 30% at 100% 0%, rgba(224, 196, 119, 0.05), transparent 50%);
      }

      .dash-app > * {
        position: relative;
        z-index: 1;
      }

      .dash-kicker {
        display: inline-flex;
        align-items: center;
        gap: 0.55rem;
        font-size: 0.65rem;
        font-weight: 650;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: rgba(246, 239, 225, 0.45);
      }

      .dash-kicker::before {
        content: '';
        width: 0.85rem;
        height: 1px;
        background: rgba(224, 196, 119, 0.55);
      }

      .dash-glass {
        position: relative;
        border: 1px solid var(--dash-border);
        border-radius: 0.75rem;
        background: rgba(246, 239, 225, 0.035);
        transition:
          border-color 0.2s ease,
          background 0.2s ease;
      }

      .dash-glass:hover {
        border-color: var(--dash-border-strong);
        background: rgba(246, 239, 225, 0.05);
      }

      .dash-glass--featured {
        background: rgba(246, 239, 225, 0.055);
        border-color: rgba(246, 239, 225, 0.14);
      }

      .dash-glass--featured:hover {
        border-color: rgba(246, 239, 225, 0.22);
      }

      .dash-stat {
        position: relative;
      }

      .dash-sidebar {
        border-right: 1px solid var(--dash-border);
        background: #0c0606;
      }

      .dash-sidebar-link {
        position: relative;
        display: flex;
        align-items: center;
        gap: 0.7rem;
        min-height: 2.5rem;
        width: 100%;
        border-radius: 0.55rem;
        padding: 0 0.75rem;
        font-size: 0.875rem;
        font-weight: 550;
        color: var(--dash-muted);
        transition:
          color 0.15s ease,
          background 0.15s ease;
      }

      .dash-sidebar-link:hover {
        color: var(--padel-ivory);
        background: rgba(246, 239, 225, 0.05);
      }

      .dash-sidebar-link[data-active='true'] {
        color: var(--padel-ivory);
        background: rgba(246, 239, 225, 0.08);
        box-shadow: inset 2px 0 0 var(--padel-gold);
      }

      .dash-sidebar-link[data-active='true'] .dash-nav-badge {
        background: rgba(224, 196, 119, 0.2);
        color: var(--padel-gold-2);
      }

      .dash-nav-badge {
        margin-left: auto;
        display: inline-flex;
        min-width: 1.2rem;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        padding: 0 0.35rem;
        font-size: 0.65rem;
        font-weight: 700;
        background: rgba(224, 52, 43, 0.85);
        color: #fff;
      }

      .dash-header {
        border-bottom: 1px solid var(--dash-border);
        background: rgba(12, 6, 6, 0.88);
        backdrop-filter: blur(12px);
      }

      .dash-chip {
        display: inline-flex;
        min-height: 2.25rem;
        align-items: center;
        gap: 0.45rem;
        border-radius: 0.5rem;
        border: 1px solid var(--dash-border);
        background: transparent;
        padding: 0 0.85rem;
        font-size: 0.8125rem;
        font-weight: 550;
        color: var(--dash-muted);
        transition:
          color 0.15s ease,
          background 0.15s ease,
          border-color 0.15s ease;
      }

      .dash-chip:hover {
        color: var(--padel-ivory);
        border-color: var(--dash-border-strong);
        background: rgba(246, 239, 225, 0.04);
      }

      .dash-chip[data-active='true'] {
        color: var(--padel-ivory);
        border-color: rgba(246, 239, 225, 0.28);
        background: rgba(246, 239, 225, 0.1);
      }

      .dash-chip__count {
        display: inline-flex;
        min-width: 1.15rem;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        padding: 0 0.3rem;
        font-size: 0.68rem;
        background: rgba(246, 239, 225, 0.1);
        color: inherit;
      }

      .dash-field label {
        display: block;
        margin-bottom: 0.4rem;
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: rgba(19, 2, 2, 0.55);
      }

      .dash-progress {
        position: fixed;
        top: 0;
        left: 0;
        z-index: 60;
        height: 2px;
        background: rgba(224, 196, 119, 0.7);
        transform-origin: left;
        pointer-events: none;
      }

      .dash-mobile-nav {
        display: flex;
        gap: 0.35rem;
        overflow-x: auto;
        padding-bottom: 0.15rem;
        scrollbar-width: none;
      }

      .dash-mobile-nav::-webkit-scrollbar {
        display: none;
      }

      .dash-mobile-link {
        display: inline-flex;
        min-height: 2.35rem;
        shrink: 0;
        align-items: center;
        gap: 0.4rem;
        border-radius: 0.5rem;
        border: 1px solid var(--dash-border);
        padding: 0 0.75rem;
        font-size: 0.75rem;
        font-weight: 550;
        color: var(--dash-muted);
        white-space: nowrap;
        transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease;
      }

      .dash-mobile-link[data-active='true'] {
        color: var(--padel-ivory);
        border-color: rgba(246, 239, 225, 0.28);
        background: rgba(246, 239, 225, 0.1);
      }

      .dash-empty-icon {
        display: inline-flex;
        height: 2.5rem;
        width: 2.5rem;
        shrink: 0;
        align-items: center;
        justify-content: center;
        border-radius: 0.6rem;
        background: rgba(246, 239, 225, 0.06);
        color: rgba(246, 239, 225, 0.65);
        border: 1px solid var(--dash-border);
      }

      .dash-soft-btn {
        border-color: var(--dash-border) !important;
        background: transparent !important;
        color: var(--padel-ivory) !important;
      }

      .dash-soft-btn:hover {
        background: rgba(246, 239, 225, 0.08) !important;
        color: var(--padel-ivory) !important;
      }

      .dash-table-row {
        display: grid;
        gap: 0.75rem;
        align-items: center;
        border-bottom: 1px solid var(--dash-border);
        padding: 0.9rem 0;
      }

      .dash-table-row:last-child {
        border-bottom: none;
      }

      .dash-attention {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        border-radius: 0.65rem;
        border: 1px solid var(--dash-border);
        background: rgba(246, 239, 225, 0.03);
        padding: 0.85rem 1rem;
      }

      .dash-attention__dot {
        margin-top: 0.35rem;
        height: 0.45rem;
        width: 0.45rem;
        shrink: 0;
        border-radius: 999px;
        background: var(--padel-gold);
      }

      .dash-attention__dot--urgent {
        background: var(--padel-ember);
      }

      .dash-metric {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        border-radius: 0.65rem;
        border: 1px solid var(--dash-border);
        background: rgba(246, 239, 225, 0.03);
        padding: 0.9rem 1rem;
      }

      .dash-metric__value {
        font-size: 1.5rem;
        font-weight: 650;
        letter-spacing: -0.02em;
        color: var(--padel-ivory);
        font-family: var(--font-display), Georgia, serif;
      }

      .dash-metric__label {
        font-size: 0.68rem;
        font-weight: 650;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: rgba(246, 239, 225, 0.42);
      }
    `}</style>
  );
}
