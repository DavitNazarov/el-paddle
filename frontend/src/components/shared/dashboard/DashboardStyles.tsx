'use client';

/** Professional dashboard styles — light surfaces, restrained semantic accents. */
export function DashboardStyles() {
  return (
    <style jsx global>{`
      .dash-app {
        --padel-ink: #19324d;
        --padel-red: #245f9b;
        --padel-red-2: #1c4a7a;
        --padel-red-3: #15385e;
        --padel-gold: #245f9b;
        --padel-gold-2: #245f9b;
        --padel-ember: #c2413b;
        --padel-focus-ring: rgba(36, 95, 155, 0.28);
        --dash-surface: rgba(255, 255, 255, 0.82);
        --dash-surface-strong: #ffffff;
        --dash-border: rgba(25, 50, 77, 0.12);
        --dash-border-strong: rgba(36, 95, 155, 0.3);
        --dash-text: #19324d;
        --dash-muted: #627287;
        --dash-faint: #8491a2;
        /* Familiar business semantics: blue leads; status colours stay clear. */
        --dash-teal: #16806a;
        --dash-teal-soft: rgba(22, 128, 106, 0.12);
        --dash-amber: #a86712;
        --dash-amber-soft: rgba(168, 103, 18, 0.12);
        --dash-coral: #c2413b;
        --dash-coral-soft: rgba(194, 65, 59, 0.11);
        --dash-sky: #2f6fed;
        --dash-sky-soft: rgba(47, 111, 237, 0.11);
        position: relative;
        isolation: isolate;
        min-height: 100dvh;
        overflow-x: clip;
        color: var(--dash-text);
        background: #f6f8fc;
      }

      .dash-app::before {
        content: '';
        position: fixed;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        background:
          radial-gradient(ellipse 70% 42% at 0% 0%, rgba(47, 111, 237, 0.11), transparent 55%),
          radial-gradient(ellipse 50% 30% at 100% 0%, rgba(22, 128, 106, 0.07), transparent 50%);
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
        color: var(--dash-sky);
      }

      .dash-kicker::before {
        content: '';
        width: 0.85rem;
        height: 1px;
        background: var(--dash-sky);
      }

      .dash-glass {
        position: relative;
        border: 1px solid var(--dash-border);
        border-radius: 0.75rem;
        background: var(--dash-surface);
        box-shadow: 0 1px 2px rgba(25, 50, 77, 0.035);
        transition:
          border-color 0.2s ease,
          background 0.2s ease;
      }

      .dash-glass:hover {
        border-color: var(--dash-border-strong);
        background: #ffffff;
      }

      .dash-glass--featured {
        background: linear-gradient(135deg, rgba(47, 111, 237, 0.1), rgba(255, 255, 255, 0.9) 55%, rgba(22, 128, 106, 0.07));
        border-color: rgba(47, 111, 237, 0.22);
      }

      .dash-glass--featured:hover {
        border-color: rgba(213, 201, 177, 0.22);
      }

      .dash-stat {
        position: relative;
      }

      .dash-sidebar {
        border-right: 1px solid var(--dash-border);
        background: rgba(240, 245, 252, 0.94);
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
        color: #51647a;
        transition:
          color 0.15s ease,
          background 0.15s ease;
      }

      .dash-sidebar-link:hover {
        color: var(--dash-text);
        background: rgba(47, 111, 237, 0.06);
      }

      .dash-sidebar-link[data-active='true'] {
        color: var(--dash-text);
        background: var(--dash-sky-soft);
        box-shadow: inset 2px 0 0 var(--dash-sky);
      }

      .dash-sidebar-link[data-active='true'] .dash-nav-badge {
        background: rgba(47, 111, 237, 0.14);
        color: var(--dash-sky);
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
        background: var(--dash-amber-soft);
        color: var(--dash-amber);
      }

      .dash-header {
        border-bottom: 1px solid var(--dash-border);
        background: rgba(245, 247, 244, 0.88);
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
        color: #53667d;
        transition:
          color 0.15s ease,
          background 0.15s ease,
          border-color 0.15s ease;
      }

      .dash-chip:hover {
        color: var(--dash-text);
        border-color: var(--dash-border-strong);
        background: rgba(47, 111, 237, 0.06);
      }

      .dash-chip[data-active='true'] {
        color: var(--dash-text);
        border-color: rgba(47, 111, 237, 0.32);
        background: var(--dash-sky-soft);
      }

      .dash-chip__count {
        display: inline-flex;
        min-width: 1.15rem;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        padding: 0 0.3rem;
        font-size: 0.68rem;
        background: rgba(213, 201, 177, 0.1);
        color: inherit;
      }

      .dash-field label {
        display: block;
        margin-bottom: 0.4rem;
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: rgba(88, 16, 16, 0.55);
      }

      .dash-progress {
        position: fixed;
        top: 0;
        left: 0;
        z-index: 60;
        height: 2px;
        background: var(--dash-sky);
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
        color: var(--dash-text);
        border-color: rgba(47, 111, 237, 0.32);
        background: var(--dash-sky-soft);
      }

      .dash-empty-icon {
        display: inline-flex;
        height: 2.5rem;
        width: 2.5rem;
        shrink: 0;
        align-items: center;
        justify-content: center;
        border-radius: 0.6rem;
        background: rgba(47, 111, 237, 0.08);
        color: var(--padel-red);
        border: 1px solid var(--dash-border);
      }

      .dash-soft-btn {
        border-color: var(--dash-border) !important;
        background: transparent !important;
        color: var(--dash-text) !important;
      }

      .dash-soft-btn:hover {
        background: rgba(47, 111, 237, 0.08) !important;
        color: var(--dash-text) !important;
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
        background: rgba(255, 255, 255, 0.72);
        padding: 0.85rem 1rem;
      }

      .dash-attention__dot {
        margin-top: 0.35rem;
        height: 0.45rem;
        width: 0.45rem;
        shrink: 0;
        border-radius: 999px;
        background: var(--dash-amber);
      }

      .dash-attention__dot--urgent {
        background: var(--dash-coral);
      }

      .dash-metric {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        border-radius: 0.65rem;
        border: 1px solid var(--dash-border);
        background: rgba(255, 255, 255, 0.74);
        padding: 0.9rem 1rem;
      }

      .dash-metric__value {
        font-size: 1.5rem;
        font-weight: 650;
        letter-spacing: -0.02em;
        color: var(--dash-text);
        font-family: var(--font-display), Georgia, serif;
      }

      .dash-metric__label {
        font-size: 0.68rem;
        font-weight: 650;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #718198;
      }

      /* Existing dashboards use a few explicit legacy text utilities. Scope
         their light-theme equivalents here so every route changes together. */
      .dash-app [class*='text-[var(--padel-ivory)]'] { color: var(--dash-text) !important; }
      .dash-app [class*='text-[rgba(213,201,177'] { color: var(--dash-muted) !important; }
      .dash-app [class*='text-[rgba(246,239,225'] { color: var(--dash-muted) !important; }
      .dash-app [class*='bg-[#102927]'] { background-color: #f0f5fc !important; }
      /* Filled controls need their own foreground token. The light-theme text
         fallback above is intentionally for content, not for action labels. */
      .dash-app :is(button, a)[class*='bg-[var(--padel-red)]'],
      .dash-app :is(button, a)[class*='bg-primary'],
      .dash-app :is(button, a)[class*='bg-emerald'][class*='text-[var(--padel-ivory)]'],
      .dash-app :is(button, a)[class*='bg-orange'][class*='text-[var(--padel-ivory)]'] {
        color: #ffffff !important;
      }
      .dash-app .admin-field input,
      .dash-app .admin-field textarea {
        border-color: rgba(25, 50, 77, 0.16);
        background: #ffffff;
        color: var(--dash-text);
      }
      .dash-app .admin-field span { color: var(--padel-red); }

      /* Dialogs intentionally return to the product's charcoal tournament
         palette instead of inheriting the light admin canvas overrides. */
      .dashboard-dialog-content {
        --padel-ink: #19324d;
        --padel-ivory: #ffffff;
        --padel-focus-ring: rgba(47, 111, 237, 0.32);
      }
      .dashboard-dialog-content .dashboard-dialog-scroll {
        background: #f7f9fc;
      }
      .dashboard-dialog-content .dashboard-form-control {
        border-color: #cbd7e4 !important;
        background: #ffffff !important;
        color: #19324d !important;
        box-shadow: 0 1px 2px rgba(15, 35, 58, 0.035);
      }
      .dashboard-dialog-content .dashboard-form-control::placeholder {
        color: #8293a7 !important;
      }
      .dashboard-dialog-content .dashboard-form-control:hover:not(:disabled) {
        border-color: #aebfd1 !important;
      }
      .dashboard-dialog-content .dashboard-form-control:focus-visible {
        border-color: #2f6fed !important;
        box-shadow: 0 0 0 3px rgba(47, 111, 237, 0.14) !important;
      }
      .dashboard-dialog-content select.dashboard-form-control,
      .dashboard-dialog-content select.dashboard-form-control option {
        background-color: #ffffff !important;
        color: #19324d !important;
      }
      .dashboard-dialog-content .dash-field label,
      .dashboard-dialog-content .dashboard-field-label {
        color: #4d6178 !important;
      }
      .dashboard-dialog-content .dashboard-field-hint {
        color: #6b7f95 !important;
      }
      .dashboard-dialog-content [class*='text-[rgba(246,239,225'] {
        color: #60748b !important;
      }
      .dashboard-dialog-content .dashboard-modal-soft-button {
        border-color: #c8d5e3 !important;
        background: #ffffff !important;
        color: #19324d !important;
      }
      .dashboard-dialog-content .dashboard-modal-soft-button:hover:not(:disabled) {
        border-color: #aebfd1 !important;
        background: #f1f5fa !important;
      }
      .dashboard-dialog-content button[class*='bg-[var(--padel-red)]'] {
        border-color: transparent !important;
        background: #2f6fed !important;
        color: #ffffff !important;
      }
      .dashboard-dialog-content button[class*='bg-[var(--padel-red)]']:hover:not(:disabled) {
        background: #245bc7 !important;
      }
      .dashboard-dialog-content input[type='checkbox'] {
        accent-color: #2f6fed;
      }

      /* Event metadata deliberately uses a dark business-blue surface. Keep
         its labels and values high contrast instead of applying light-card text. */
      .dash-app .tournament-key-value {
        border-color: rgba(25, 50, 77, 0.22);
        background: rgba(25, 50, 77, 0.22);
      }
      .dash-app .tournament-key-value__item { background: #19324d; }
      .dash-app .tournament-key-value__label { color: #b7c9df !important; }
      .dash-app .tournament-key-value__value { color: #ffffff !important; }

      .dash-metric[data-tone='success'] { border-color: rgba(22, 128, 106, 0.24); }
      .dash-metric[data-tone='success'] .dash-metric__value { color: var(--dash-teal); }
      .dash-metric[data-tone='warning'] { border-color: rgba(168, 103, 18, 0.24); }
      .dash-metric[data-tone='warning'] .dash-metric__value { color: var(--dash-amber); }
      .dash-metric[data-tone='danger'] { border-color: rgba(194, 65, 59, 0.24); }
      .dash-metric[data-tone='danger'] .dash-metric__value { color: var(--dash-coral); }
      .dash-metric[data-tone='info'] { border-color: rgba(47, 111, 237, 0.24); }
      .dash-metric[data-tone='info'] .dash-metric__value { color: var(--dash-sky); }

      .dash-tone-icon { border: 1px solid transparent; }
      .dash-tone-icon--neutral { background: rgba(213, 201, 177, 0.08); color: rgba(213, 201, 177, 0.7); }
      .dash-tone-icon--success { background: var(--dash-teal-soft); border-color: rgba(22, 128, 106, 0.2); color: var(--dash-teal); }
      .dash-tone-icon--warning { background: var(--dash-amber-soft); border-color: rgba(168, 103, 18, 0.2); color: var(--dash-amber); }
      .dash-tone-icon--danger { background: var(--dash-coral-soft); border-color: rgba(194, 65, 59, 0.2); color: var(--dash-coral); }

      .dash-status { border: 1px solid transparent; }
      .dash-status--approved { background: var(--dash-teal-soft); border-color: rgba(22, 128, 106, 0.28); color: var(--dash-teal); }
      .dash-status--pending, .dash-status--waitlisted, .dash-status--needs-changes { background: var(--dash-amber-soft); border-color: rgba(168, 103, 18, 0.28); color: var(--dash-amber); }
      .dash-status--declined, .dash-status--withdrawn, .dash-status--cancelled { background: var(--dash-coral-soft); border-color: rgba(194, 65, 59, 0.28); color: var(--dash-coral); }

      /* Compatibility layer for tournament-era cards used inside the three
         workspaces. It keeps legacy utility markup aligned with the current
         light operations system while those routes share the same components. */
      .dash-app [class*='border-[rgba(213,201,177'] { border-color: var(--dash-border) !important; }
      .dash-app [class*='divide-[rgba(213,201,177'] > :not(:last-child) { border-color: var(--dash-border) !important; }
      .dash-app [class*='text-emerald-300'] { color: var(--dash-teal) !important; }
      .dash-app [class*='text-red-200'] { color: var(--dash-coral) !important; }
      .dash-app [class*='border-red-400'] { border-color: rgba(194, 65, 59, 0.28) !important; }

      @media (prefers-reduced-motion: reduce) {
        .dash-app *,
        .dash-app *::before,
        .dash-app *::after {
          scroll-behavior: auto !important;
          transition-duration: 0.01ms !important;
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
        }
      }
    `}</style>
  );
}
