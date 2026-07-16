'use client';

export function PadelHomeStyles() {
  return (
      <style jsx global>{`
        .font-display {
          font-family: var(--font-display);
          font-optical-sizing: auto;
        }

        .font-script {
          font-family: var(--font-script);
        }

        .el-padel-page {
          background: var(--padel-red);
          isolation: isolate;
        }

        html {
          scroll-padding-top: 0;
        }

        .page-canvas {
          position: relative;
          isolation: isolate;
        }

        .page-surface {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          overflow: hidden;
        }

        .page-surface__gradient {
          position: absolute;
          inset: 0;
          background: #86000c;
        }

        .page-surface__aurora {
          position: absolute;
          inset: 0;
          z-index: 1;
        }

        .page-surface__sheen {
          position: absolute;
          inset: 0;
          z-index: 2;
          opacity: 0.22;
          background: linear-gradient(
            180deg,
            rgba(0, 0, 0, 0.08) 0%,
            transparent 18%,
            transparent 82%,
            rgba(0, 0, 0, 0.1) 100%
          );
        }

        .scroll-section {
          position: relative;
          z-index: 1;
          background: transparent;
        }

        .el-padel-page main > section.scroll-section--placeholder {
          min-height: min(100dvh, 920px);
          contain: layout style paint;
        }

        .deferred-section-loader {
          min-height: min(100dvh, 920px);
          contain: layout style paint;
        }

        @media (max-width: 768px) {
          .el-padel-page main > section.scroll-section--placeholder,
          .deferred-section-loader {
            min-height: min(88svh, 760px);
          }
        }

        .scroll-section::before {
          content: '';
          position: absolute;
          left: -5%;
          right: -5%;
          top: -10rem;
          bottom: -10rem;
          z-index: -1;
          pointer-events: none;
          opacity: 0.9;
          -webkit-mask-image: linear-gradient(
            180deg,
            transparent 0%,
            #000 10%,
            #000 90%,
            transparent 100%
          );
          mask-image: linear-gradient(
            180deg,
            transparent 0%,
            #000 10%,
            #000 90%,
            transparent 100%
          );
          background:
            radial-gradient(ellipse 58% 55% at 0% 50%, rgba(88, 16, 16, 0.38), transparent 70%),
            radial-gradient(ellipse 58% 55% at 100% 50%, rgba(88, 16, 16, 0.32), transparent 70%),
            radial-gradient(ellipse 62% 48% at 50% 50%, rgba(134, 0, 12, 0.24), transparent 72%);
        }

        .poster-hero::before {
          display: none;
        }

        .poster-hero + .scroll-section::before {
          top: -14rem;
          -webkit-mask-image: linear-gradient(
            180deg,
            transparent 0%,
            #000 16%,
            #000 90%,
            transparent 100%
          );
          mask-image: linear-gradient(
            180deg,
            transparent 0%,
            #000 16%,
            #000 90%,
            transparent 100%
          );
        }

        .scroll-section:nth-of-type(3n + 1)::before {
          background:
            radial-gradient(ellipse 52% 46% at 0% 50%, rgba(88, 16, 16, 0.22), transparent 72%),
            radial-gradient(ellipse 52% 46% at 100% 50%, rgba(88, 16, 16, 0.2), transparent 72%),
            radial-gradient(ellipse 68% 52% at 50% 50%, rgba(134, 0, 12, 0.42), transparent 74%);
        }

        .scroll-section:nth-of-type(3n + 2)::before {
          background:
            radial-gradient(ellipse 68% 54% at 0% 48%, rgba(88, 16, 16, 0.48), transparent 70%),
            radial-gradient(ellipse 50% 44% at 100% 52%, rgba(88, 16, 16, 0.2), transparent 70%),
            radial-gradient(ellipse 54% 40% at 50% 50%, rgba(134, 0, 12, 0.16), transparent 72%);
        }

        .scroll-section:nth-of-type(3n)::before {
          background:
            radial-gradient(ellipse 50% 44% at 0% 52%, rgba(88, 16, 16, 0.2), transparent 70%),
            radial-gradient(ellipse 68% 54% at 100% 48%, rgba(88, 16, 16, 0.46), transparent 70%),
            radial-gradient(ellipse 54% 40% at 50% 50%, rgba(134, 0, 12, 0.16), transparent 72%);
        }

        .el-padel-page main > section {
          min-height: 100dvh;
          overflow-anchor: none;
        }

        .el-padel-page section[id] {
          scroll-margin-top: 0;
        }

        /* ================================================================ */
        /* Creative system — aurora, gold ink, premium buttons, glass       */
        /* ================================================================ */

        /* ---- Page progress + glow trail ---- */
        .preloader {
          animation: preloader-fallback-hide 2.8s var(--padel-ease-out) forwards;
        }

        @keyframes preloader-fallback-hide {
          0%,
          88% {
            opacity: 1;
            visibility: visible;
          }

          100% {
            opacity: 0;
            pointer-events: none;
            visibility: hidden;
          }
        }

        .page-progress {
          background: linear-gradient(
            90deg,
            var(--padel-gold-deep),
            var(--padel-gold) 40%,
            #d5c9b1 55%,
            var(--padel-gold) 72%,
            var(--padel-gold-deep)
          );
          box-shadow: 0 0 18px rgba(213, 201, 177, 0.45);
        }

        .page-progress__glow {
          background: linear-gradient(
            180deg,
            rgba(213, 201, 177, 0.35),
            transparent
          );
          filter: blur(8px);
        }

        /* ---- Court divider between sections ---- */
        .court-divider {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding-inline: 1.25rem;
          background: var(--padel-ink);
        }

        .court-divider__line {
          flex: 1;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent,
            var(--padel-line-strong),
            transparent
          );
        }

        .court-divider__net {
          display: flex;
          height: 1.35rem;
          width: 2.4rem;
          align-items: center;
          justify-content: center;
          border-inline: 1px solid var(--padel-line-strong);
        }

        .court-divider__mesh {
          display: block;
          height: 100%;
          width: 100%;
          background: repeating-linear-gradient(
            90deg,
            var(--padel-line) 0 2px,
            transparent 2px 6px
          );
          opacity: 0.85;
        }

        /* ---- Floating entry bar + back to top ---- */
        .floating-entry {
          box-shadow:
            0 24px 80px rgba(0, 0, 0, 0.45),
            0 0 0 1px rgba(213, 201, 177, 0.08);
        }

        .floating-entry__pulse {
          animation: pulse-ring 2.4s ease-in-out infinite;
        }

        @keyframes float-idle {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-4px);
          }
        }

        @keyframes pulse-ring {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(213, 201, 177, 0.25);
          }
          55% {
            box-shadow: 0 0 0 8px rgba(213, 201, 177, 0);
          }
        }

        .back-to-top {
          box-shadow: 0 16px 50px rgba(0, 0, 0, 0.35);
          bottom: max(1.25rem, calc(env(safe-area-inset-bottom) + 1rem));
        }

        /* ---- Navigation shell ---- */
        .padel-nav-header {
          padding-top: max(0.75rem, calc(env(safe-area-inset-top) + 0.5rem));
        }

        @media (min-width: 768px) {
          .padel-nav-header {
            padding-top: max(1.25rem, calc(env(safe-area-inset-top) + 1rem));
          }
        }

        .nav-shell {
          box-shadow:
            inset 0 1px 0 rgba(213, 201, 177, 0.06),
            0 18px 70px rgba(0, 0, 0, 0.18);
        }

        .nav-link__underline {
          pointer-events: none;
        }

        /* ---- Hero chips + meta bars ---- */
        .hero-chip {
          display: inline-flex;
          align-items: center;
          border: 1px solid var(--padel-line);
          border-radius: 999px;
          padding: 0.28rem 0.7rem;
          font-size: 0.56rem;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--padel-muted);
          background: rgba(88, 16, 16, 0.18);
        }

        .poster-meta__bar {
          background: linear-gradient(
            90deg,
            var(--padel-ivory),
            rgba(213, 201, 177, 0.85) 55%,
            var(--padel-ivory)
          );
          box-shadow: 0 0 16px rgba(213, 201, 177, 0.18);
        }

        .scroll-cue__track {
          background: rgba(88, 16, 16, 0.28);
        }

        /* ---- Section intro frame ---- */
        .section-intro-frame {
          position: relative;
          padding-left: 0.85rem;
          border-left: 1px solid rgba(213, 201, 177, 0.28);
        }

        .section-intro-frame--center {
          padding-left: 0;
          border-left: none;
          padding-top: 0.75rem;
          border-top: 1px solid rgba(213, 201, 177, 0.28);
        }

        .section-kicker__index {
          animation: index-glow 3s ease-in-out infinite;
        }

        @keyframes index-glow {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(213, 201, 177, 0);
          }
          50% {
            box-shadow: 0 0 0 6px rgba(213, 201, 177, 0.12);
          }
        }

        /* ---- Ghost button ---- */
        .btn-ghost {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          transition:
            transform 0.32s var(--padel-ease-out),
            border-color 0.32s ease,
            color 0.32s ease;
        }

        .btn-ghost:hover {
          transform: translateY(-2px);
        }

        /* ---- Mobile menu court lines ---- */
        .mobile-menu__lines {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.35;
          background:
            linear-gradient(90deg, transparent 18%, var(--padel-line) 18%, var(--padel-line) calc(18% + 1px), transparent calc(18% + 1px)),
            linear-gradient(90deg, transparent 82%, var(--padel-line) 82%, var(--padel-line) calc(82% + 1px), transparent calc(82% + 1px)),
            linear-gradient(180deg, transparent 28%, var(--padel-line) 28%, var(--padel-line) calc(28% + 1px), transparent calc(28% + 1px));
        }

        /* ---- Animated aurora glow (used behind red sections) ---- */
        .aurora {
          position: absolute;
          inset: 0;
          height: 100%;
          z-index: -1;
          pointer-events: none;
          overflow: hidden;
        }

        .aurora::before,
        .aurora::after {
          content: none;
        }

        .aurora-orb {
          position: absolute;
          border-radius: 999px;
          pointer-events: none;
          will-change: transform;
        }

        .page-surface__aurora-a {
          top: -10%;
          left: -6%;
          height: 44rem;
          width: 44rem;
          background: radial-gradient(circle, rgba(134, 0, 12, 0.28), transparent 62%);
        }

        .page-surface__aurora-b {
          right: -10%;
          bottom: -16%;
          height: 40rem;
          width: 40rem;
          background: radial-gradient(circle, rgba(88, 16, 16, 0.32), transparent 60%);
        }

        .aurora-orb--a {
          top: -12%;
          left: -8%;
          height: 46rem;
          width: 46rem;
          background: radial-gradient(circle, rgba(134, 0, 12, 0.24), transparent 62%);
          filter: blur(70px);
          opacity: 0.55;
        }

        .aurora-orb--b {
          right: -12%;
          bottom: -18%;
          height: 42rem;
          width: 42rem;
          background: radial-gradient(circle, rgba(88, 16, 16, 0.28), transparent 60%);
          filter: blur(70px);
          opacity: 0.55;
        }

        @media (pointer: coarse) {
          .aurora-orb--a,
          .aurora-orb--b {
            filter: none;
            opacity: 0.42;
          }

          .page-surface__aurora::before,
          .page-surface__aurora::after {
            content: '';
            position: absolute;
            border-radius: 999px;
            opacity: 0.42;
          }

          .page-surface__aurora::before {
            top: -10%;
            left: -6%;
            height: 44rem;
            width: 44rem;
            background: radial-gradient(circle, rgba(134, 0, 12, 0.28), transparent 62%);
          }

          .page-surface__aurora::after {
            right: -10%;
            bottom: -16%;
            height: 40rem;
            width: 40rem;
            background: radial-gradient(circle, rgba(88, 16, 16, 0.32), transparent 60%);
          }
        }

        /* ---- Gold gradient ink (headlines / wordmarks) ---- */
        .gold-ink {
          background: linear-gradient(
            105deg,
            var(--padel-gold-deep) 0%,
            var(--padel-gold) 34%,
            var(--padel-gold-2) 52%,
            var(--padel-gold) 68%,
            var(--padel-gold-deep) 100%
          );
          background-size: 220% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: gold-shift 8s ease-in-out infinite;
        }

        @keyframes gold-shift {
          0%,
          100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        /* ---- Premium button (shared CTA behaviour) ---- */
        .btn-premium {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          transition:
            transform 0.32s cubic-bezier(0.16, 1, 0.3, 1),
            box-shadow 0.32s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .btn-premium::after {
          content: '';
          position: absolute;
          top: 0;
          left: -140%;
          z-index: 1;
          height: 100%;
          width: 55%;
          background: linear-gradient(
            100deg,
            transparent,
            rgba(213, 201, 177, 0.55),
            transparent
          );
          transform: skewX(-18deg);
          transition: left 0.7s cubic-bezier(0.16, 1, 0.3, 1);
          pointer-events: none;
        }

        .btn-premium:hover {
          transform: translateY(-2px);
          box-shadow: var(--padel-shadow-gold);
        }

        .btn-premium:hover::after {
          left: 150%;
        }

        .btn-premium > * {
          position: relative;
          z-index: 2;
        }

        /* Dark (red) variant sheen is subtler */
        .btn-premium.btn-premium--dark::after {
          background: linear-gradient(
            100deg,
            transparent,
            rgba(213, 201, 177, 0.5),
            transparent
          );
        }

        /* ---- Glass panel treatment ---- */
        .glass-card {
          position: relative;
          background: linear-gradient(
            160deg,
            rgba(213, 201, 177, 0.055),
            rgba(213, 201, 177, 0.015)
          );
          transition:
            transform 0.4s cubic-bezier(0.16, 1, 0.3, 1),
            border-color 0.4s ease,
            box-shadow 0.4s ease,
            background-color 0.4s ease;
        }

        .glass-card:hover {
          border-color: var(--padel-line-strong);
        }

        .glass-card::before {
          content: '';
          position: absolute;
          inset: 1px;
          border-radius: inherit;
          border: 1px solid rgba(213, 201, 177, 0.04);
          pointer-events: none;
        }

        @media (min-width: 769px) and (hover: hover) and (pointer: fine) {
          .glass-card {
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
          }

          .nav-shell,
          .floating-entry {
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
          }

          .back-to-top {
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
          }

          .poster-meta {
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
          }
        }

        /* ---- Custom cursor ring ---- */
        @media (hover: hover) and (pointer: fine) {
          html.padel-cursor-hidden,
          html.padel-cursor-hidden body,
          html.padel-cursor-hidden a,
          html.padel-cursor-hidden button,
          html.padel-cursor-hidden input,
          html.padel-cursor-hidden textarea,
          html.padel-cursor-hidden select,
          html.padel-cursor-hidden [role='button'] {
            cursor: none !important;
          }
        }

        @media (hover: none), (pointer: coarse) {
          .cursor-ring {
            display: none !important;
          }
        }

        .cursor-ring {
          height: 1.9rem;
          width: 1.9rem;
          margin-left: -0.95rem;
          margin-top: -0.95rem;
        }

        .cursor-ring__circle {
          position: absolute;
          inset: 0;
          display: block;
          border: 1.5px solid rgba(213, 201, 177, 0.95);
          border-radius: 999px;
          box-shadow: 0 0 0 1px rgba(88, 16, 16, 0.35);
          transform-origin: center;
          will-change: transform, opacity;
        }

        .cursor-ring__dot {
          position: absolute;
          left: calc(50% - 0.13rem);
          top: calc(50% - 0.13rem);
          display: block;
          height: 0.26rem;
          width: 0.26rem;
          border-radius: 999px;
          background: var(--padel-gold);
          box-shadow: 0 0 0 1px rgba(88, 16, 16, 0.35);
          will-change: transform;
        }

        /* ---- Film grain ---- */
        .film-grain {
          display: none;
        }

        /* ---- Mobile menu ---- */
        .mobile-menu {
          padding-top: max(5.75rem, calc(env(safe-area-inset-top) + 4.75rem));
          padding-bottom: max(2rem, calc(env(safe-area-inset-bottom) + 1.5rem));
          overscroll-behavior: contain;
        }

        .mobile-menu__link {
          transition: color 0.25s ease, padding-left 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .mobile-menu__link:hover,
        .mobile-menu__link:focus-visible {
          color: var(--padel-gold);
          padding-left: 0.6rem;
          outline: none;
        }

        /* ---- Section rail ---- */
        .snap-indicator {
          position: fixed;
          right: 1.1rem;
          top: 50%;
          z-index: 65;
          display: flex;
          flex-direction: column;
          gap: 0.7rem;
          transform: translateY(-50%);
        }

        .snap-indicator__dot {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.5rem;
          min-height: 1.25rem;
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 0;
        }

        .snap-indicator__label {
          font-size: 0.62rem;
          font-weight: 600;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--padel-ivory);
          opacity: 0;
          transform: translateX(6px);
          transition:
            opacity 0.24s ease,
            transform 0.24s ease;
          white-space: nowrap;
        }

        .snap-indicator__dot:hover .snap-indicator__label,
        .snap-indicator__dot:focus-visible .snap-indicator__label,
        .snap-indicator__dot[aria-current='true'] .snap-indicator__label {
          opacity: 0.85;
          transform: translateX(0);
        }

        .snap-indicator__mark {
          position: relative;
          display: block;
          height: 0.36rem;
          width: 1.05rem;
          border-radius: 999px;
          background: var(--padel-muted);
        }

        .snap-indicator__dot[aria-current='true'] .snap-indicator__mark {
          background: var(--padel-gold);
        }

        .snap-indicator__dot:focus-visible {
          outline: none;
        }

        .snap-indicator__dot:focus-visible .snap-indicator__mark {
          box-shadow: 0 0 0 4px rgba(213, 201, 177, 0.24);
        }

        @media (max-width: 900px) {
          .snap-indicator {
            display: none;
          }
        }

        .section-pad {
          padding-top: 5.5rem;
          padding-bottom: 5.5rem;
        }

        .section-tight {
          padding-top: 4.5rem;
          padding-bottom: 4.5rem;
        }

        .section-kicker__rule {
          display: inline-block;
          height: 1px;
          width: 2rem;
          background: linear-gradient(90deg, var(--padel-gold), transparent);
          opacity: 0.55;
        }

        .section-accent {
          font-style: italic;
          font-weight: 500;
          color: var(--padel-gold);
        }


        /* ---- Hero rotating badge ---- */
        .hero-badge {
          position: absolute;
          height: 8.5rem;
          width: 8.5rem;
        }

        .hero-badge__svg {
          height: 100%;
          width: 100%;
          animation: badge-spin 26s linear infinite;
        }

        .hero-badge__text {
          font-size: 0.62rem;
          font-weight: 600;
          letter-spacing: 0.34em;
          fill: var(--padel-ivory);
          opacity: 0.75;
        }

        .hero-badge__star {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          font-size: 1.1rem;
          color: var(--padel-gold);
        }

        @keyframes badge-spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* ---- Flow connector + traveling ball ---- */
        .flow-grid__line {
          display: none;
        }

        @media (min-width: 768px) {
          .flow-grid__line {
            display: block;
            position: absolute;
            left: 4%;
            right: 4%;
            top: 2.4rem;
            border-top: 1px dashed var(--padel-line-strong);
            pointer-events: none;
            z-index: 2;
          }
        }

        .flow-grid__ball {
          position: absolute;
          top: 0;
          height: 0.85rem;
          width: 0.85rem;
          transform: translate(-50%, -50%);
          border-radius: 999px;
          background: radial-gradient(circle at 32% 30%, #d5c9b1, var(--padel-gold) 62%, #581010);
          box-shadow:
            0 0 0 4px rgba(213, 201, 177, 0.14),
            0 4px 14px rgba(0, 0, 0, 0.45);
        }

        .flow-grid__ball::after {
          content: '';
          position: absolute;
          inset: 18%;
          border-radius: 999px;
          border-top: 1px solid rgba(88, 16, 16, 0.35);
          transform: rotate(-24deg);
        }

        /* ---- Score rail ---- */
        .score-rail {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.9rem;
          border-block: 1px solid var(--padel-line);
          padding-block: 1.1rem;
        }

        .score-rail__item {
          display: inline-flex;
          align-items: center;
          gap: 0.9rem;
        }

        .score-rail__call {
          font-size: 1.5rem;
          font-weight: 600;
          font-style: italic;
          line-height: 1;
          color: rgba(213, 201, 177, 0.22);
          transition:
            color 0.4s ease,
            text-shadow 0.4s ease;
        }

        .score-rail__call--won {
          color: rgba(213, 201, 177, 0.55);
        }

        .score-rail__call--active {
          color: var(--padel-gold);
          text-shadow: 0 0 22px rgba(213, 201, 177, 0.4);
        }

        .score-rail__sep {
          display: inline-block;
          height: 1px;
          width: 1.4rem;
          background: var(--padel-line-strong);
        }

        /* ---- Flow card score watermark + tag ---- */
        .flow-card__score {
          position: absolute;
          right: -0.6rem;
          top: 0.4rem;
          font-size: 8.5rem;
          font-weight: 700;
          font-style: italic;
          line-height: 0.8;
          color: transparent;
          -webkit-text-stroke: 1px rgba(213, 201, 177, 0.22);
          pointer-events: none;
          transition:
            -webkit-text-stroke-color 0.45s ease,
            transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .flow-card:hover .flow-card__score {
          -webkit-text-stroke-color: rgba(213, 201, 177, 0.55);
          transform: translateY(-4px);
        }

        .flow-card__tag {
          display: inline-flex;
          align-items: center;
          border: 1px solid var(--padel-line);
          border-radius: 999px;
          padding: 0.35rem 0.85rem;
          font-size: 0.62rem;
          font-weight: 600;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: var(--padel-gold);
          transition: border-color 0.3s ease, background-color 0.3s ease;
        }

        .flow-card:hover .flow-card__tag {
          border-color: rgba(213, 201, 177, 0.5);
          background: rgba(213, 201, 177, 0.06);
        }

        /* ---- Entry meter + live badge ---- */
        .entry-meter__fill {
          background: linear-gradient(
            90deg,
            var(--padel-gold),
            #d5c9b1 55%,
            var(--padel-gold)
          );
        }

        .live-badge__dot {
          display: inline-block;
          height: 0.45rem;
          width: 0.45rem;
          border-radius: 999px;
          background: var(--padel-gold);
          animation: live-pulse 2s ease-in-out infinite;
        }

        @keyframes live-pulse {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(213, 201, 177, 0.55);
          }
          55% {
            box-shadow: 0 0 0 6px rgba(213, 201, 177, 0);
          }
        }

        /* ---- Atmosphere staggered grid ---- */
        @media (min-width: 768px) {
          .atmosphere-grid > *:nth-child(2) {
            margin-top: 3.2rem;
          }

          .atmosphere-grid > *:nth-child(3) {
            margin-top: 1.4rem;
          }
        }

        .detail-row__icon {
          background: transparent;
        }

        .detail-row:hover .detail-row__icon {
          border-color: var(--padel-gold);
        }

        .detail-row::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          height: 0;
          width: 2px;
          background: var(--padel-gold);
          transform: translateY(-50%);
          transition: height 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .detail-row:hover::before {
          height: 56%;
        }

        .contact-link:hover .contact-link__icon {
          border-color: var(--padel-gold);
        }

        .section-kicker__index {
          display: inline-flex;
          height: 1.6rem;
          min-width: 1.6rem;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--padel-line-strong);
          border-radius: 999px;
          font-size: 0.68rem;
          letter-spacing: 0.05em;
          color: var(--padel-ivory);
        }

        .poster-hero {
          background: transparent;
        }

        .hero-crest {
          filter: brightness(0) saturate(100%) invert(87%) sepia(13%) saturate(412%)
            hue-rotate(359deg) brightness(90%) contrast(87%)
            drop-shadow(0 18px 40px rgba(88, 16, 16, 0.42));
        }

        .hero-chip {
          transition:
            border-color 0.35s ease,
            color 0.35s ease,
            background-color 0.35s ease;
        }

        .hero-chip:hover {
          border-color: rgba(213, 201, 177, 0.55);
          color: var(--padel-ivory);
          background: rgba(213, 201, 177, 0.08);
        }

        .upcoming-event-card {
          transition:
            border-color 0.45s ease,
            box-shadow 0.45s ease,
            transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .upcoming-event-card:hover {
          border-color: rgba(213, 201, 177, 0.45);
          box-shadow: 0 28px 80px -40px rgba(0, 0, 0, 0.55);
        }

        .prize-tier--featured .prize-tier__shine {
          opacity: 0.55;
          animation: prize-shine-drift 7s ease-in-out infinite;
        }

        @keyframes prize-shine-drift {
          0%,
          100% {
            transform: translate(0, 0);
          }
          50% {
            transform: translate(18%, 12%);
          }
        }

        .marquee-band__track--static {
          animation: none;
          width: 100%;
          justify-content: center;
        }

        .marquee-band__track--static .marquee-band__group {
          flex-wrap: wrap;
          justify-content: center;
          row-gap: 0.35rem;
        }

        .premium-noise {
          display: none;
        }

        .poster-vignette {
          background:
            radial-gradient(circle at 48% 42%, transparent 0 19rem, rgba(88, 16, 16, 0.08) 31rem, transparent 72%),
            linear-gradient(90deg, rgba(88, 16, 16, 0.14), transparent 22%, transparent 78%, rgba(88, 16, 16, 0.14)),
            linear-gradient(180deg, rgba(88, 16, 16, 0.1) 0%, transparent 22%, transparent 100%);
          pointer-events: none;
        }

        /* ---- Word reveal ---- */
        .reveal-word {
          display: inline-flex;
          overflow: hidden;
          vertical-align: top;
          padding-bottom: 0.08em;
        }

        .reveal-word__inner {
          display: inline-block;
          /* Pre-hydrate offset so Safari doesn't flash final glyphs then jump. */
          transform: translateY(115%);
        }

        .poster-ball-wrap {
          width: min(480px, 38dvh, 72vw);
          filter: drop-shadow(0 24px 50px rgba(88, 16, 16, 0.28));
        }

        .poster-ball-canvas {
          min-height: 100%;
        }

        .poster-ball-copy {
          text-shadow: 0 1px 0 rgba(213, 201, 177, 0.22);
        }

        .poster-ball-copy h1 {
          max-width: min(14ch, 82%);
          font-size: clamp(1.35rem, 3.6dvh, 2.1rem);
          line-height: 1.15;
        }

        .poster-meta {
          color: var(--padel-ivory);
        }

        .section-orbit {
          display: none;
          position: absolute;
          pointer-events: none;
          height: 28rem;
          width: 28rem;
          border: 1px solid var(--padel-line);
          opacity: 0;
        }

        .section-orbit::before,
        .section-orbit::after {
          content: '';
          position: absolute;
          border-radius: 999px;
          border: 1px solid var(--padel-line);
        }

        .section-orbit::before {
          inset: 4rem;
        }

        .section-orbit::after {
          inset: 8rem;
        }

        .section-orbit--left {
          left: -14rem;
          top: 10rem;
          transform: rotate(18deg);
        }

        .section-orbit--right {
          right: -14rem;
          top: 1rem;
          transform: rotate(-18deg);
        }

        .section-orbit--center {
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%) rotate(22deg);
          animation: orbit-drift 52s linear infinite;
        }

        @keyframes orbit-drift {
          from {
            transform: translate(-50%, -50%) rotate(22deg);
          }
          to {
            transform: translate(-50%, -50%) rotate(382deg);
          }
        }

        /* ---- Poster frame (real player poster) ---- */
        .poster-frame {
          position: relative;
          padding: 0.9rem;
          border: 1px solid var(--padel-line);
        }

        .poster-frame__media {
          position: relative;
          overflow: hidden;
          aspect-ratio: 4 / 5;
          background: var(--padel-red-3);
          box-shadow: 0 34px 110px rgba(0, 0, 0, 0.4);
        }

        .poster-frame__inner {
          position: absolute;
          inset: -8%;
          will-change: transform;
        }

        .poster-frame__caption {
          position: absolute;
          bottom: 0.35rem;
          right: 0.9rem;
          font-size: 0.66rem;
          font-weight: 600;
          letter-spacing: 0.26em;
          text-transform: uppercase;
          color: var(--padel-gold);
        }

        .poster-frame__tick {
          position: absolute;
          height: 0.85rem;
          width: 0.85rem;
          border: 0 solid var(--padel-gold);
          z-index: 2;
        }

        .poster-frame__tick--tl {
          top: -1px;
          left: -1px;
          border-top-width: 1px;
          border-left-width: 1px;
        }

        .poster-frame__tick--tr {
          top: -1px;
          right: -1px;
          border-top-width: 1px;
          border-right-width: 1px;
        }

        .poster-frame__tick--bl {
          bottom: -1px;
          left: -1px;
          border-bottom-width: 1px;
          border-left-width: 1px;
        }

        .poster-frame__tick--br {
          bottom: -1px;
          right: -1px;
          border-bottom-width: 1px;
          border-right-width: 1px;
        }

        .principle-row {
          background:
            linear-gradient(135deg, rgba(213, 201, 177, 0.04) 0%, rgba(213, 201, 177, 0.015) 62%),
            rgba(88, 16, 16, 0.16);
          box-shadow:
            inset 0 1px 0 rgba(213, 201, 177, 0.08),
            0 12px 44px rgba(88, 16, 16, 0.2);
          transition:
            border-color 0.3s ease,
            background-color 0.3s ease,
            transform 0.3s ease;
        }

        .principle-row::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 0% 50%, rgba(213, 201, 177, 0.14), transparent 52%);
          opacity: 0;
          transition: opacity 0.35s ease;
          pointer-events: none;
        }

        .principle-row:hover {
          border-color: rgba(213, 201, 177, 0.45);
          transform: translateY(-2px);
        }

        .principle-row:hover::before {
          opacity: 1;
        }

        .principle-row__num {
          display: inline-flex;
          min-width: 2.2rem;
          height: 2.2rem;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          border: 1px solid rgba(213, 201, 177, 0.35);
          background: rgba(213, 201, 177, 0.08);
          transition:
            color 0.3s ease,
            border-color 0.3s ease,
            background-color 0.3s ease;
        }

        .principle-row__copy {
          transition: color 0.3s ease;
        }

        .principle-row__check-shell {
          display: inline-flex;
          height: 2rem;
          width: 2rem;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          border: 1px solid rgba(213, 201, 177, 0.32);
          background: rgba(213, 201, 177, 0.07);
          box-shadow: 0 0 0 0 rgba(213, 201, 177, 0.28);
          transition:
            border-color 0.3s ease,
            background-color 0.3s ease,
            box-shadow 0.3s ease;
        }

        .principle-row__check {
          opacity: 0.88;
          transform: scale(0.98);
          transition:
            opacity 0.3s ease,
            transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .principle-row:hover .principle-row__num {
          color: var(--padel-gold-2);
          border-color: rgba(213, 201, 177, 0.6);
          background: rgba(213, 201, 177, 0.16);
        }

        .principle-row:hover .principle-row__copy {
          color: var(--padel-ivory);
        }

        .principle-row:hover .principle-row__check-shell {
          border-color: rgba(213, 201, 177, 0.52);
          background: rgba(213, 201, 177, 0.14);
          box-shadow: 0 0 0 6px rgba(213, 201, 177, 0.08);
        }

        .principle-row:hover .principle-row__check {
          opacity: 1;
          transform: scale(1.06);
        }

        .prize-pool-shell {
          isolation: isolate;
          background:
            radial-gradient(circle at 50% 78%, rgba(213, 201, 177, 0.1), transparent 32%),
            linear-gradient(145deg, rgba(213, 201, 177, 0.06), transparent 48%),
            rgba(88, 16, 16, 0.32);
          box-shadow:
            inset 0 1px 0 rgba(213, 201, 177, 0.08),
            0 30px 120px -42px rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(10px);
        }

        .prize-pool-shell::after {
          content: '';
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background: linear-gradient(
            105deg,
            transparent 0 42%,
            rgba(213, 201, 177, 0.035) 49%,
            transparent 56%
          );
        }

        .prize-pool__court {
          position: absolute;
          inset: 0;
          z-index: 0;
          overflow: hidden;
          pointer-events: none;
          opacity: 0.34;
        }

        .prize-pool__court-outline {
          position: absolute;
          left: 8%;
          right: 8%;
          bottom: -22%;
          height: 72%;
          border: 1px solid rgba(213, 201, 177, 0.16);
        }

        .prize-pool__court-center {
          position: absolute;
          left: 50%;
          bottom: -22%;
          height: 72%;
          width: 1px;
          background: rgba(213, 201, 177, 0.16);
        }

        .prize-pool__court-circle {
          position: absolute;
          left: 50%;
          bottom: 14%;
          width: min(38vw, 29rem);
          aspect-ratio: 1;
          border: 1px solid rgba(213, 201, 177, 0.12);
          border-radius: 999px;
          transform: translate(-50%, 50%);
        }

        .prize-total-lockup__mark {
          display: inline-flex;
          height: 3.5rem;
          width: 3.5rem;
          flex: 0 0 auto;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(213, 201, 177, 0.38);
          border-radius: 999px;
          color: var(--padel-ivory);
          background: rgba(213, 201, 177, 0.07);
          box-shadow:
            inset 0 0 0 5px rgba(213, 201, 177, 0.025),
            0 12px 40px rgba(0, 0, 0, 0.16);
        }

        .prize-total-lockup__amount {
          font-size: clamp(3.25rem, 7vw, 6.4rem);
          letter-spacing: -0.045em;
          text-shadow: 0 14px 34px rgba(0, 0, 0, 0.2);
        }

        .prize-pool-head__copy {
          position: relative;
          padding-left: 1.15rem;
        }

        .prize-pool-head__copy::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0.3rem;
          bottom: 0.3rem;
          width: 1px;
          background: var(--padel-line-strong);
        }

        .prize-podium-wrap {
          padding: 2rem 1.25rem 1.25rem;
        }

        .prize-podium {
          position: relative;
          z-index: 2;
          display: grid;
          grid-template-columns: minmax(0, 0.86fr) minmax(0, 1.16fr) minmax(0, 0.86fr);
          grid-template-rows: 1fr;
          align-items: end;
          gap: 0.75rem;
          max-width: 65rem;
          margin: 0 auto;
          padding-top: 3.75rem;
        }

        .prize-podium__item {
          align-self: end;
        }

        .prize-podium__item--1 {
          grid-column: 2;
          grid-row: 1;
        }

        .prize-podium__item--2 {
          grid-column: 1;
          grid-row: 1;
        }

        .prize-podium__item--3 {
          grid-column: 3;
          grid-row: 1;
        }

        .prize-podium__halo {
          position: absolute;
          left: 50%;
          top: 1.1rem;
          z-index: 0;
          width: min(42vw, 31rem);
          aspect-ratio: 1;
          border: 1px solid rgba(213, 201, 177, 0.13);
          border-radius: 999px;
          transform: translateX(-50%);
          box-shadow:
            0 0 0 1.8rem rgba(213, 201, 177, 0.018),
            0 0 0 3.6rem rgba(213, 201, 177, 0.012);
          pointer-events: none;
        }

        .prize-podium__baseline {
          position: relative;
          z-index: 1;
          display: block;
          height: 1px;
          max-width: 68rem;
          margin: 0 auto;
          background: linear-gradient(90deg, transparent, var(--padel-line-strong), transparent);
        }

        .prize-tier {
          min-height: 15.5rem;
          background:
            linear-gradient(155deg, rgba(213, 201, 177, 0.07), transparent 52%),
            rgba(88, 16, 16, 0.76);
          box-shadow: inset 0 1px 0 rgba(213, 201, 177, 0.08);
          transition:
            transform 0.35s var(--padel-ease-out),
            border-color 0.35s ease,
            background-color 0.35s ease,
            box-shadow 0.35s ease;
        }

        .prize-tier__shine {
          position: absolute;
          inset: -42% -22% auto auto;
          width: 14rem;
          height: 14rem;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(213, 201, 177, 0.18), transparent 68%);
          opacity: 0;
          transition: opacity 0.35s ease;
          pointer-events: none;
        }

        .prize-tier__rank {
          position: absolute;
          top: 0.4rem;
          right: 0.65rem;
          z-index: 0;
          color: rgba(213, 201, 177, 0.06);
          font-family: var(--font-display);
          font-size: clamp(4.75rem, 8vw, 7rem);
          font-weight: 600;
          line-height: 1;
          letter-spacing: -0.08em;
          pointer-events: none;
        }

        .prize-tier__medal {
          display: inline-flex;
          height: 2rem;
          width: 2rem;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(213, 201, 177, 0.28);
          border-radius: 999px;
          color: var(--padel-ivory);
          background: rgba(213, 201, 177, 0.06);
        }

        .prize-tier__place {
          color: rgba(213, 201, 177, 0.7);
        }

        .prize-tier__amount {
          color: var(--padel-ivory);
          font-size: clamp(2.25rem, 4.1vw, 3.75rem);
          letter-spacing: -0.035em;
        }

        .prize-tier__bonus {
          color: rgba(213, 201, 177, 0.82);
        }

        .prize-tier__step {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 0.28rem;
          background: rgba(213, 201, 177, 0.28);
          transform-origin: left center;
          transition: background-color 0.35s ease;
        }

        .prize-tier:hover {
          transform: translateY(-3px);
          border-color: rgba(213, 201, 177, 0.55);
          box-shadow:
            inset 0 1px 0 rgba(213, 201, 177, 0.12),
            0 24px 55px -34px rgba(0, 0, 0, 0.72);
        }

        .prize-tier:hover .prize-tier__shine {
          opacity: 1;
        }

        .prize-tier:hover .prize-tier__step {
          background: rgba(213, 201, 177, 0.72);
        }

        .prize-tier--featured {
          min-height: 19rem;
          border-color: var(--padel-parchment);
          background: var(--padel-parchment);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.28),
            0 28px 80px -35px rgba(0, 0, 0, 0.75);
        }

        .prize-tier--featured .prize-tier__rank {
          color: rgba(88, 16, 16, 0.07);
        }

        .prize-tier--featured .prize-tier__medal {
          border-color: rgba(88, 16, 16, 0.22);
          color: var(--padel-red);
          background: rgba(134, 0, 12, 0.06);
        }

        .prize-tier--featured .prize-tier__place {
          color: rgba(88, 16, 16, 0.66);
        }

        .prize-tier--featured .prize-tier__amount {
          color: var(--padel-ink);
          font-size: clamp(3rem, 5.2vw, 4.8rem);
        }

        .prize-tier--featured .prize-tier__bonus {
          color: var(--padel-red);
        }

        .prize-tier--featured .prize-tier__step {
          height: 0.38rem;
          background: var(--padel-red);
        }

        .prize-tier--featured .prize-tier__shine {
          background: radial-gradient(circle, rgba(255, 255, 255, 0.48), transparent 68%);
        }

        .stat-card {
          transition:
            background-color 0.3s ease,
            transform 0.3s ease,
            border-color 0.3s ease;
          overflow: hidden;
        }

        .stat-card__glow {
          position: absolute;
          inset: auto -30% -60% -30%;
          height: 70%;
          background: radial-gradient(circle, rgba(213, 201, 177, 0.16), transparent 68%);
          opacity: 0;
          transition: opacity 0.35s ease;
          pointer-events: none;
        }

        .stat-card:hover .stat-card__glow {
          opacity: 1;
        }

        @media (min-width: 768px) {
          .stat-card--featured {
            transform: translateY(-0.75rem);
            border-color: rgba(213, 201, 177, 0.35);
            background: rgba(213, 201, 177, 0.04);
          }

          .stat-card--featured .stat-card__glow {
            opacity: 0.65;
          }
        }

        .stat-card:hover {
          background: rgba(213, 201, 177, 0.03);
          transform: translateY(-3px);
        }

        .detail-row {
          transition:
            background-color 0.25s ease,
            transform 0.25s ease;
        }

        .detail-row:hover {
          background: rgba(213, 201, 177, 0.035);
          transform: translateX(4px);
        }

        .flow-card::before {
          content: '';
          position: absolute;
          inset: 0;
          transform: translateY(100%);
          background: linear-gradient(180deg, transparent, rgba(213, 201, 177, 0.08));
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .flow-card:hover::before {
          transform: translateY(0);
        }

        .flow-card__arrow {
          opacity: 0;
          transform: translate(-4px, 4px);
          transition:
            opacity 0.3s ease,
            transform 0.3s ease;
        }

        .flow-card:hover .flow-card__arrow {
          opacity: 1;
          transform: translate(0, 0);
        }

        .contact-link {
          position: relative;
          border-bottom: 1px solid var(--padel-line);
          transition: color 0.25s ease;
        }

        .contact-link .contact-link__text {
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .contact-link:hover {
          color: var(--padel-ivory);
        }

        .contact-link:hover .contact-link__text {
          transform: translateX(6px);
        }

        .contact-link__arrow {
          opacity: 0;
          transition:
            opacity 0.25s ease,
            transform 0.25s ease;
        }

        .contact-link:hover .contact-link__arrow {
          opacity: 1;
          transform: translate(2px, -2px);
        }

        .sponsor-chip:hover {
          background: rgba(134, 0, 12, 0.06);
          border-color: var(--padel-red);
          color: var(--padel-red);
        }

        /* ---- Hero title line mask ---- */
        .hero-title-line {
          display: block;
          overflow: hidden;
          padding-bottom: 0.06em;
        }

        .hero-title-line__inner {
          display: inline-block;
          will-change: transform;
        }

        /* ---- Marquee band ---- */
        .marquee-band {
          overflow: hidden;
          border-block: 1px solid var(--padel-line);
          background:
            linear-gradient(90deg, var(--padel-ink), rgba(88, 16, 16, 0.94) 12%, rgba(88, 16, 16, 0.94) 88%, var(--padel-ink)),
            var(--padel-ink);
          padding-block: 1.15rem;
          position: relative;
        }

        .marquee-band::before,
        .marquee-band::after {
          content: '';
          position: absolute;
          top: 0;
          bottom: 0;
          width: 4rem;
          z-index: 2;
          pointer-events: none;
        }

        .marquee-band::before {
          left: 0;
          background: linear-gradient(90deg, var(--padel-ink), transparent);
        }

        .marquee-band::after {
          right: 0;
          background: linear-gradient(270deg, var(--padel-ink), transparent);
        }

        .preloader-court__inner {
          background: rgba(134, 0, 12, 0.12);
        }

        .preloader-court__net {
          position: absolute;
          left: 50%;
          top: 0;
          bottom: 0;
          width: 1px;
          transform: translateX(-50%);
          background: var(--padel-gold);
          opacity: 0.55;
        }

        .marquee-band__track {
          display: flex;
          width: max-content;
        }

        .marquee-band__track--reverse {
          animation-direction: reverse;
        }

        .marquee-band__group {
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }

        .marquee-band__item {
          display: inline-flex;
          align-items: center;
          gap: 2.2rem;
          padding-right: 2.2rem;
          font-size: 1.05rem;
          font-weight: 600;
          font-style: italic;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          white-space: nowrap;
          color: rgba(213, 201, 177, 0.4);
        }

        .marquee-band__item:nth-child(odd) {
          color: rgba(213, 201, 177, 0.6);
        }

        .marquee-band__star {
          font-size: 0.7rem;
          font-style: normal;
          color: var(--padel-gold);
          opacity: 0.7;
        }

        @keyframes marquee-scroll {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }

        @media (pointer: coarse) {
          .gold-ink,
          .floating-entry__pulse,
          .section-kicker__index,
          .live-badge__dot,
          .hero-badge__svg,
          .section-orbit--center,
          .prize-tier--featured .prize-tier__shine {
            animation: none !important;
          }

          .glass-card,
          .poster-meta {
            backdrop-filter: none;
            -webkit-backdrop-filter: none;
          }

          .nav-shell,
          .floating-entry,
          .back-to-top {
            backdrop-filter: none;
            -webkit-backdrop-filter: none;
          }

          .poster-frame__inner {
            will-change: auto;
          }
        }

        /* ---- Submit spinner ---- */
        .submit-spinner {
          display: inline-block;
          height: 1.1rem;
          width: 1.1rem;
          border-radius: 999px;
          border: 2px solid rgba(213, 201, 177, 0.35);
          border-top-color: var(--padel-ivory);
          animation: spinner-turn 0.7s linear infinite;
        }

        @keyframes spinner-turn {
          to {
            transform: rotate(360deg);
          }
        }

        /* ---- Stat card corner ticks ---- */
        .stat-card__tick {
          position: absolute;
          height: 0.7rem;
          width: 0.7rem;
          border: 0 solid var(--padel-gold);
          opacity: 0;
          transition: opacity 0.35s ease;
        }

        .stat-card__tick--tl {
          top: -1px;
          left: -1px;
          border-top-width: 1px;
          border-left-width: 1px;
        }

        .stat-card__tick--br {
          bottom: -1px;
          right: -1px;
          border-bottom-width: 1px;
          border-right-width: 1px;
        }

        .stat-card:hover .stat-card__tick {
          opacity: 1;
        }

        .stat-card:hover .stat-card__value {
          color: var(--padel-gold);
        }

        /* ---- Touch devices: keep hover-only affordances visible ---- */
        @media (hover: none) {
          .flow-card__arrow,
          .contact-link__arrow {
            opacity: 0.75;
            transform: none;
          }

          .principle-row__check {
            opacity: 0.7;
            transform: scale(1);
          }

          .stat-card__tick {
            opacity: 0.55;
          }

          .flow-card__score {
            -webkit-text-stroke-color: rgba(213, 201, 177, 0.32);
          }
        }

        .entry-meter,
        .premium-form,
        .court-card {
          border: 1px solid var(--padel-line-strong);
        }

        .premium-form input,
        .premium-form textarea,
        .premium-form select {
          min-height: 3.2rem;
          width: 100%;
          border: none;
          border-bottom: 1px solid #d5c9b1;
          border-radius: 0;
          background: transparent;
          padding: 0.75rem 0.15rem;
          color: var(--padel-ink);
          font-family: var(--font-display);
          font-size: 1.15rem;
          outline: none;
          transition:
            border-color 0.25s ease,
            background-color 0.25s ease,
            transform 0.25s var(--padel-ease-out);
        }

        .field-select {
          appearance: none;
          cursor: pointer;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2386000c' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.15rem center;
          padding-right: 1.5rem;
        }

        .field-shell__control::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          height: 2px;
          width: 100%;
          background: var(--padel-red);
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.4s var(--padel-ease-out);
        }

        .field-shell:focus-within .field-shell__control::after {
          transform: scaleX(1);
        }

        .field-shell:focus-within input,
        .field-shell:focus-within textarea,
        .field-shell:focus-within select {
          transform: translateY(-1px);
        }

        .form-steps__dot {
          display: inline-block;
          height: 0.45rem;
          width: 0.45rem;
          border-radius: 999px;
          background: rgba(88, 16, 16, 0.14);
        }

        .form-steps__dot--active {
          width: 1.6rem;
          background: linear-gradient(90deg, var(--padel-red), #86000c);
        }

        .premium-form textarea {
          min-height: 8rem;
          resize: vertical;
        }

        .premium-form input::placeholder,
        .premium-form textarea::placeholder {
          color: rgba(88, 16, 16, 0.34);
          font-style: italic;
        }

        .premium-form label {
          position: relative;
        }

        .premium-form label::after {
          display: none;
        }

        .premium-form label:focus-within::after {
          display: none;
        }

        .premium-form input:focus,
        .premium-form textarea:focus,
        .premium-form select:focus {
          border-color: var(--padel-red);
          background: rgba(134, 0, 12, 0.028);
        }

        .visual-poster {
          position: relative;
          min-height: 600px;
          overflow: hidden;
          border: 1px solid var(--padel-line);
          background: var(--padel-red-2);
          color: var(--padel-ivory);
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.24);
        }

        .visual-poster__image {
          transition: transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .group:hover .visual-poster__image {
          transform: scale(1.06);
        }

        .visual-poster__overlay {
          position: absolute;
          inset: 0;
          z-index: 3;
          display: flex;
          align-items: flex-end;
          justify-content: flex-start;
          padding: 1.5rem;
          background: linear-gradient(180deg, transparent 35%, rgba(88, 16, 16, 0.72));
          opacity: 0;
          transition: opacity 0.45s var(--padel-ease-out);
        }

        .group:hover .visual-poster__overlay {
          opacity: 1;
        }

        .visual-poster__overlay-label {
          font-size: 0.62rem;
          font-weight: 600;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: var(--padel-gold);
        }

        .atmosphere-card:hover figcaption {
          color: var(--padel-ivory);
        }

        .court-card {
          position: relative;
          overflow: hidden;
        }

        .court-card__diagram {
          position: absolute;
          right: -1.5rem;
          top: 1.5rem;
          height: 8.5rem;
          width: 5.5rem;
          opacity: 0.16;
          pointer-events: none;
        }

        .court-card__baseline {
          position: absolute;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--padel-red);
        }

        .court-card__baseline--top {
          top: 12%;
        }

        .court-card__baseline--bottom {
          bottom: 12%;
        }

        .court-card__net {
          position: absolute;
          left: 50%;
          top: 12%;
          bottom: 12%;
          width: 2px;
          transform: translateX(-50%);
          background: var(--padel-red);
        }

        .court-card__service {
          position: absolute;
          top: 12%;
          bottom: 12%;
          width: 38%;
          border: 2px solid var(--padel-red);
        }

        .court-card__service--left {
          left: 0;
        }

        .court-card__service--right {
          right: 0;
        }

        .site-footer__mesh {
          display: none;
        }

        .footer-link {
          position: relative;
          display: inline-flex;
          min-height: 2.75rem;
          min-width: 2.75rem;
          align-items: center;
          justify-content: center;
        }

        .footer-link::after {
          content: '';
          position: absolute;
          left: 0;
          bottom: -0.2rem;
          height: 1px;
          width: 100%;
          background: var(--padel-gold);
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.3s var(--padel-ease-out);
        }

        .footer-link:hover::after {
          transform: scaleX(1);
        }

        .footer-social {
          min-height: 2.75rem;
        }

        .visual-poster__grain {
          position: absolute;
          inset: 0;
          background:
            repeating-linear-gradient(110deg, rgba(213, 201, 177, 0.035) 0 1px, transparent 1px 8px),
            linear-gradient(180deg, rgba(0, 0, 0, 0.04), rgba(0, 0, 0, 0.24));
          opacity: 0.86;
        }

        .visual-poster__small {
          position: absolute;
          left: 2rem;
          top: 2rem;
          z-index: 2;
          max-width: 8rem;
          font-size: 0.875rem;
          font-weight: 600;
          line-height: 1.45;
          color: var(--padel-muted);
        }

        .visual-poster__title {
          position: absolute;
          inset-inline: 2rem;
          bottom: 2rem;
          z-index: 2;
          font-size: clamp(2.7rem, 6vw, 4.7rem);
          font-weight: 700;
          line-height: 0.9;
        }

        .poster-court-study {
          background:
            linear-gradient(160deg, rgba(88, 16, 16, 0.66) 0 21%, transparent 21%),
            linear-gradient(135deg, #86000c, #581010);
        }

        .poster-court-study::before,
        .poster-court-study::after {
          content: '';
          position: absolute;
          border: 2px solid var(--padel-ivory);
          opacity: 0.86;
        }

        .poster-court-study::before {
          left: 18%;
          top: 28%;
          height: 42%;
          width: 64%;
        }

        .poster-court-study::after {
          left: 50%;
          top: 28%;
          height: 42%;
          width: 1px;
          border-width: 0 0 0 2px;
        }

        .poster-type-study {
          background:
            radial-gradient(circle at 74% 22%, rgba(213, 201, 177, 0.08), transparent 12rem),
            linear-gradient(135deg, #581010, #86000c 52%, #581010);
        }

        .poster-type-study::before {
          content: 'MATADOR';
          position: absolute;
          left: -0.5rem;
          top: 42%;
          color: #86000c;
          font-family: var(--font-display);
          font-size: clamp(4rem, 12vw, 8.5rem);
          font-weight: 700;
          line-height: 0.8;
          transform: translateY(-50%);
          text-shadow: 0 6px 26px rgba(0, 0, 0, 0.28);
        }

        .poster-type-study::after {
          content: '';
          position: absolute;
          right: 16%;
          top: 16%;
          height: 8rem;
          width: 4rem;
          background: var(--padel-red);
          clip-path: polygon(50% 0, 82% 26%, 68% 100%, 31% 100%, 18% 26%);
          filter: drop-shadow(0 14px 24px rgba(0, 0, 0, 0.24));
        }

        @media (max-width: 1024px) {
          .poster-ball-wrap {
            width: min(440px, 40dvh, 78vw);
          }
        }

        @media (max-width: 768px) {
          .el-padel-page main > section {
            min-height: auto;
          }

          .section-pad {
            padding-top: 4rem;
            padding-bottom: 4rem;
          }

          .section-tight {
            padding-top: 3.5rem;
            padding-bottom: 3.5rem;
          }

          .poster-hero {
            display: flex;
            height: auto;
            min-height: 100svh;
            flex-direction: column;
            padding-top: max(5.75rem, calc(env(safe-area-inset-top) + 4.75rem));
            padding-bottom: max(1.25rem, calc(env(safe-area-inset-bottom) + 1.25rem));
          }

          .hero-crest {
            width: 200px;
          }

          .hero-chips {
            margin-top: 0.875rem;
            gap: 0.4rem;
          }

          .hero-chip {
            padding: 0.3rem 0.62rem;
            font-size: 0.56rem;
            letter-spacing: 0.18em;
          }

          .poster-ball-wrap {
            margin-top: 0.35rem;
            width: min(300px, 34svh, 82vw);
          }

          .poster-ball-canvas {
            min-height: 100%;
          }

          .poster-footer {
            position: relative;
            inset: auto;
            bottom: auto;
            left: auto;
            right: auto;
            width: 100%;
            margin-top: auto;
            gap: 0.75rem;
          }

          .poster-meta {
            padding: 1rem;
            backdrop-filter: none;
            -webkit-backdrop-filter: none;
          }

          .poster-meta > p {
            margin-bottom: 0.65rem;
            letter-spacing: 0.24em;
          }

          .section-intro-frame {
            padding-left: 0.85rem;
          }

          .section-kicker {
            align-items: flex-start;
            gap: 0.6rem;
            letter-spacing: 0.18em;
          }

          .section-kicker__rule {
            width: 2rem;
          }

          .principle-row {
            align-items: flex-start;
            gap: 0.85rem;
            min-height: auto;
            padding: 1rem;
          }

          .principle-row__num {
            min-width: 1.9rem;
            height: 1.9rem;
            font-size: 0.88rem;
          }

          .principle-row__copy {
            font-size: 0.95rem;
            line-height: 1.55;
          }

          .principle-row__check-shell {
            height: 1.7rem;
            width: 1.7rem;
          }

          .prize-pool-head {
            gap: 1.1rem;
          }

          .prize-total-lockup__mark {
            height: 3rem;
            width: 3rem;
          }

          .prize-total-lockup__amount {
            font-size: clamp(2.8rem, 13.5vw, 4.2rem);
          }

          .prize-pool-head__copy {
            padding-top: 0.1rem;
            padding-left: 0;
          }

          .prize-pool-head__copy::before {
            display: none;
          }

          .prize-podium-wrap {
            padding: 1rem;
          }

          .prize-podium {
            display: flex;
            flex-direction: column;
            gap: 0.65rem;
            padding-top: 0;
          }

          .prize-podium__item {
            width: 100%;
          }

          .prize-podium__item--1 {
            order: 1;
          }

          .prize-podium__item--2 {
            order: 2;
          }

          .prize-podium__item--3 {
            order: 3;
          }

          .prize-podium__halo {
            top: 0;
            width: 82vw;
            max-width: 23rem;
          }

          .prize-tier,
          .prize-tier--featured {
            min-height: 0;
          }

          .prize-tier__content {
            min-height: 12.5rem;
            padding: 1.15rem;
          }

          .prize-tier--featured .prize-tier__content {
            min-height: 15rem;
          }

          .prize-tier__amount {
            font-size: clamp(2.45rem, 12vw, 3.55rem);
          }

          .prize-tier--featured .prize-tier__amount {
            font-size: clamp(3.25rem, 15vw, 4.5rem);
          }

          .detail-row {
            gap: 1rem;
            padding: 1.65rem 1rem;
          }

          .detail-row:hover {
            transform: none;
          }

          .detail-row__count {
            top: 1.6rem;
            right: 1rem;
          }

          .stat-card {
            padding: 1.5rem;
          }

          .stat-card__value {
            font-size: 3.5rem;
          }

          .flow-card {
            min-height: auto;
            padding: 1.5rem;
          }

          .flow-card h3 {
            padding-top: 5rem;
          }

          .flow-card__tag {
            letter-spacing: 0.18em;
          }

          .visual-poster {
            min-height: min(420px, 70svh);
          }

          .flow-card__score {
            font-size: 6.5rem;
          }

          .score-rail__call {
            font-size: 1.2rem;
          }

          .score-rail__sep {
            width: 0.9rem;
          }

          .premium-form,
          .entry-meter,
          .court-card {
            padding: 1.5rem;
          }

          .premium-form {
            min-height: auto;
          }

          .premium-form input,
          .premium-form textarea,
          .premium-form select {
            min-height: 3.35rem;
            font-size: 1rem;
          }

          .contact-link {
            gap: 1rem;
          }

          .contact-link__text {
            overflow: visible;
            text-overflow: clip;
            white-space: normal;
            overflow-wrap: anywhere;
          }

          .floating-entry {
            bottom: max(0.85rem, calc(env(safe-area-inset-bottom) + 0.65rem));
          }

          .back-to-top {
            bottom: max(5.9rem, calc(env(safe-area-inset-bottom) + 5.4rem));
            right: 1rem;
          }
        }

        @media (max-width: 460px) {
          .poster-ball-copy h1 {
            font-size: clamp(1.45rem, 4.1dvh, 1.85rem);
          }

          .poster-meta p,
          .poster-meta span {
            font-size: inherit;
          }

          .poster-meta > p {
            font-size: 0.58rem;
          }

          .poster-meta .font-display {
            font-size: 1.45rem;
          }

          .mobile-menu__link {
            padding-block: 1rem;
            font-size: 2rem;
          }

          .mobile-menu nav {
            justify-content: flex-start;
          }

          .premium-form {
            padding: 1.25rem;
          }

          .premium-form > div:first-child {
            margin-bottom: 1.5rem;
            gap: 1rem;
            padding-bottom: 1.5rem;
          }

          .field-shell__label {
            letter-spacing: 0.18em;
          }

          .form-steps {
            flex-wrap: wrap;
          }

          .contact-link__text {
            font-size: 1.45rem;
          }

          .court-card h3 {
            font-size: 2.65rem;
          }

          .site-footer .font-script {
            font-size: 4.4rem;
          }

          .marquee-band__item {
            font-size: 0.85rem;
            gap: 1.5rem;
            padding-right: 1.5rem;
          }
        }

        @media (max-height: 680px) and (max-width: 900px) {
          .mobile-menu nav {
            justify-content: flex-start;
          }

          .mobile-menu__link {
            padding-block: 0.95rem;
            font-size: 1.9rem;
          }

          .poster-hero {
            min-height: auto;
            padding-bottom: max(2rem, calc(env(safe-area-inset-bottom) + 1.5rem));
          }

          .poster-ball-wrap {
            width: min(300px, 48svh, 76vw);
          }

          .poster-footer {
            margin-top: 1rem;
          }
        }

        /* ---- Short viewports (landscape phones, small laptops) ---- */
        @media (max-height: 720px) and (min-width: 768px) {
          .poster-hero {
            padding-top: 5.5rem;
            padding-bottom: 7.5rem;
          }

          .poster-ball-wrap {
            width: min(480px, 42dvh, 70vw);
          }

          .poster-footer {
            bottom: 0.85rem;
          }

          .poster-meta .font-display {
            font-size: clamp(1rem, 2.2vw, 1.35rem);
          }

          .hero-crest {
            width: 176px;
          }
        }

        @media (max-height: 560px) {
          .poster-hero {
            height: auto;
            min-height: 100dvh;
            padding-bottom: 9rem;
          }
        }

        @media (max-width: 768px), (pointer: coarse) {
          .page-progress__glow {
            display: none;
          }

          .nav-shell,
          .floating-entry,
          .back-to-top,
          .poster-meta {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
          }

          .mobile-menu {
            will-change: transform, opacity;
          }
        }

        /* ================================================================ */
        /* 2026 homepage refinement: stable, court-first, mobile-first      */
        /* ================================================================ */

        .el-padel-page {
          background:
            linear-gradient(180deg, #86000c 0%, #6f0710 42%, #581010 100%);
        }

        .el-padel-page main > section {
          min-height: auto;
        }

        .el-padel-page main > section.poster-hero {
          min-height: 100svh;
        }

        .hero-ambient {
          overflow: hidden;
        }

        .hero-ambient__glow {
          position: absolute;
          left: 50%;
          top: 50%;
          width: min(52rem, 88vw);
          aspect-ratio: 1;
          border-radius: 999px;
          background: radial-gradient(
            circle,
            rgba(213, 201, 177, 0.16) 0%,
            rgba(134, 0, 12, 0.08) 38%,
            transparent 70%
          );
          filter: blur(10px);
          translate: -50% -50%;
          transform-origin: center;
        }

        .hero-ambient__beam {
          position: absolute;
          left: 50%;
          top: 12%;
          height: 76%;
          width: 1px;
          background: linear-gradient(
            180deg,
            transparent,
            rgba(213, 201, 177, 0.48) 35%,
            rgba(213, 201, 177, 0.18) 68%,
            transparent
          );
          box-shadow: 0 0 28px rgba(213, 201, 177, 0.24);
          transform-origin: center;
        }

        .hero-ambient__sweep {
          position: absolute;
          left: 50%;
          top: 50%;
          height: 135%;
          width: 18%;
          opacity: 0.16;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(213, 201, 177, 0.22),
            transparent
          );
          filter: blur(20px);
          translate: -50% -50%;
          rotate: 14deg;
        }

        .hero-logo-stage {
          width: min(24rem, 88vw);
          min-height: 17rem;
        }

        .hero-logo-orbit {
          position: absolute;
          left: 50%;
          top: 50%;
          border-radius: 999px;
          translate: -50% -50%;
          pointer-events: none;
        }

        .hero-logo-orbit::after {
          content: '';
          position: absolute;
          left: 50%;
          top: -3px;
          height: 6px;
          width: 6px;
          border-radius: 999px;
          background: var(--padel-gold);
          box-shadow: 0 0 14px rgba(213, 201, 177, 0.8);
          transform: translateX(-50%);
        }

        .hero-logo-orbit--outer {
          height: 17rem;
          width: 17rem;
          border: 1px solid rgba(213, 201, 177, 0.2);
          border-left-color: transparent;
        }

        .hero-logo-orbit--inner {
          height: 13.75rem;
          width: 13.75rem;
          border: 1px dashed rgba(213, 201, 177, 0.17);
          border-right-color: transparent;
        }

        .hero-logo-image {
          position: relative;
          z-index: 1;
          filter: drop-shadow(0 24px 60px rgba(0, 0, 0, 0.32));
        }

        .hero-gold-line {
          background: linear-gradient(
            90deg,
            transparent,
            var(--padel-gold),
            transparent
          );
          box-shadow: 0 0 16px rgba(213, 201, 177, 0.3);
        }

        .el-padel-page section[id] {
          scroll-margin-top: 5.75rem;
        }

        .scroll-section::before {
          opacity: 0.42;
        }

        .hero-bg {
          background: var(--padel-ink);
        }

        .hero-bg__image {
          object-position: center 54%;
          filter: saturate(1.08) contrast(1.08) brightness(0.9);
          transform: translateZ(0) scale(1.02);
          transform-origin: center;
        }

        .hero-bg__wash {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(88, 16, 16, 0.96) 0%, rgba(88, 16, 16, 0.78) 38%, rgba(88, 16, 16, 0.22) 100%),
            linear-gradient(180deg, rgba(88, 16, 16, 0.72) 0%, rgba(88, 16, 16, 0.18) 42%, rgba(88, 16, 16, 0.88) 100%);
        }

        .hero-bg__court-lines {
          position: absolute;
          inset: 0;
          opacity: 0.2;
          background:
            linear-gradient(90deg, transparent 7%, var(--padel-line) 7%, var(--padel-line) calc(7% + 1px), transparent calc(7% + 1px)),
            linear-gradient(90deg, transparent 50%, var(--padel-line) 50%, var(--padel-line) calc(50% + 1px), transparent calc(50% + 1px)),
            linear-gradient(0deg, transparent 18%, var(--padel-line) 18%, var(--padel-line) calc(18% + 1px), transparent calc(18% + 1px));
          mask-image: linear-gradient(90deg, #000, transparent 72%);
          -webkit-mask-image: linear-gradient(90deg, #000, transparent 72%);
        }

        .hero-shell {
          position: relative;
          z-index: 2;
        }

        .hero-eyebrow,
        .hero-facts__label,
        .hero-fact__label {
          letter-spacing: 0.2em;
        }

        .hero-title {
          letter-spacing: 0;
          text-shadow: 0 24px 80px rgba(0, 0, 0, 0.42);
          text-wrap: balance;
        }

        .hero-copyline {
          text-wrap: pretty;
        }

        .hero-actions a {
          transition:
            transform 0.26s var(--padel-ease-out),
            border-color 0.26s ease,
            background-color 0.26s ease,
            color 0.26s ease;
        }

        .hero-facts {
          border: 1px solid var(--padel-line-strong);
          border-radius: 8px;
          background:
            linear-gradient(145deg, rgba(213, 201, 177, 0.09), rgba(213, 201, 177, 0.03)),
            rgba(88, 16, 16, 0.56);
          box-shadow: 0 26px 80px rgba(0, 0, 0, 0.26);
          padding: 1rem;
        }

        .hero-facts__label {
          margin-bottom: 0.85rem;
          color: var(--padel-gold);
          font-size: 0.64rem;
          font-weight: 700;
          text-transform: uppercase;
        }

        .hero-facts__grid {
          display: grid;
          gap: 0.7rem;
        }

        .hero-fact {
          display: grid;
          grid-template-columns: 1.25rem minmax(0, 1fr);
          gap: 0.75rem;
          align-items: flex-start;
          border-top: 1px solid var(--padel-line);
          padding-top: 0.75rem;
        }

        .hero-fact:first-child {
          border-top: 0;
          padding-top: 0;
        }

        .hero-fact__label,
        .hero-fact__value {
          display: block;
        }

        .hero-fact__label {
          font-size: 0.56rem;
          font-weight: 700;
          text-transform: uppercase;
          color: rgba(213, 201, 177, 0.62);
        }

        .hero-fact__value {
          margin-top: 0.12rem;
          color: var(--padel-ivory);
          font-family: var(--font-display);
          font-size: 1.05rem;
          font-weight: 600;
          line-height: 1.2;
        }

        .hero-chip-rail {
          position: relative;
          z-index: 2;
        }

        .hero-scroll-cue {
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .section-pad {
          padding-top: 6.5rem;
          padding-bottom: 6.5rem;
        }

        .section-tight {
          padding-top: 5.25rem;
          padding-bottom: 5.25rem;
        }

        .section-intro-frame {
          border-left-color: rgba(213, 201, 177, 0.34);
          padding-left: 1rem;
        }

        .section-kicker {
          letter-spacing: 0.18em;
        }

        .section-accent {
          color: var(--padel-ivory);
          opacity: 0.74;
        }

        .glass-card,
        .poster-frame,
        .upcoming-event-card,
        .prize-pool-shell,
        .prize-tier,
        .premium-form,
        .court-card,
        .courts-stage__media,
        .contact-link,
        .el-padel-page .rounded-xl {
          border-radius: 8px;
        }

        .poster-frame {
          background: rgba(88, 16, 16, 0.22);
          box-shadow: 0 26px 90px rgba(0, 0, 0, 0.26);
        }

        .poster-frame__media,
        .courts-stage__media {
          border-radius: 6px;
        }

        .poster-frame__inner,
        .courts-stage__img,
        .visual-poster__image {
          transform: translateZ(0);
        }

        .principle-row,
        .prize-tier,
        .contact-link,
        .courts-stage__media {
          transition:
            transform 0.26s var(--padel-ease-out),
            border-color 0.26s ease,
            background-color 0.26s ease,
            box-shadow 0.26s ease;
        }

        .sponsors-section-card,
        .el-padel-page article {
          border-radius: 8px;
        }

        .upcoming-event-card,
        .prize-pool-shell,
        .premium-form,
        .court-card {
          box-shadow: 0 26px 90px rgba(0, 0, 0, 0.22);
        }

        .marquee-band {
          padding-block: 0.9rem;
        }

        .marquee-band__item {
          letter-spacing: 0.16em;
        }

        @media (min-width: 769px) and (hover: hover) and (pointer: fine) {
          .hero-bg__image {
            animation: hero-photo-breathe 18s ease-in-out infinite;
          }

          .hero-facts {
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
          }
        }

        @keyframes hero-photo-breathe {
          0%,
          100% {
            transform: translateZ(0) scale(1.02);
          }

          50% {
            transform: translateZ(0) scale(1.055);
          }
        }

        @media (max-width: 900px) {
          .poster-hero {
            min-height: 100svh;
            padding-top: max(6.25rem, calc(env(safe-area-inset-top) + 5.25rem));
            padding-bottom: max(4rem, calc(env(safe-area-inset-bottom) + 3rem));
          }

          .hero-bg__image {
            object-position: 64% center;
          }

          .hero-bg__wash {
            background:
              linear-gradient(180deg, rgba(88, 16, 16, 0.86) 0%, rgba(88, 16, 16, 0.68) 46%, rgba(88, 16, 16, 0.96) 100%),
              linear-gradient(90deg, rgba(88, 16, 16, 0.9), rgba(88, 16, 16, 0.34));
          }

          .hero-shell {
            min-height: auto;
            gap: 1.5rem;
          }

          .hero-logo-stage {
            min-height: 15rem;
          }

          .hero-logo-orbit--outer {
            height: 15rem;
            width: 15rem;
          }

          .hero-logo-orbit--inner {
            height: 12rem;
            width: 12rem;
          }

          .hero-brand-row {
            margin-bottom: 1.5rem;
          }

          .hero-title {
            max-width: 9ch;
            font-size: 3.65rem;
            line-height: 0.92;
          }

          .hero-copyline {
            margin-top: 1.25rem;
            font-size: 1rem;
            line-height: 1.65;
          }

          .hero-actions {
            margin-top: 1.5rem;
          }

          .hero-actions a {
            width: 100%;
          }

          .hero-facts {
            padding: 0.9rem;
          }

          .hero-facts__grid {
            gap: 0.6rem;
          }

          .hero-chip-rail {
            margin-top: 1rem;
          }

          .section-pad {
            padding-top: 4rem;
            padding-bottom: 4rem;
          }

          .section-tight {
            padding-top: 3.4rem;
            padding-bottom: 3.4rem;
          }

          .section-intro-frame {
            padding-left: 0.9rem;
          }

          .section-kicker {
            letter-spacing: 0.14em;
          }

          .section-kicker__rule {
            display: none;
          }

          .floating-entry {
            width: calc(100vw - 1rem);
            border-radius: 8px;
            bottom: max(0.6rem, calc(env(safe-area-inset-bottom) + 0.55rem));
          }

          .floating-entry .btn-premium {
            min-width: 6.8rem;
            padding-inline: 0.9rem;
          }

          /* Mobile motion budget: retain hierarchy, remove persistent paint work. */
          .scroll-section::before,
          .hero-ambient__beam,
          .hero-ambient__sweep,
          .section-orbit {
            display: none;
          }

          .hero-ambient__glow {
            filter: none;
            opacity: 0.28;
          }

          .prize-pool-shell {
            backdrop-filter: none;
            -webkit-backdrop-filter: none;
          }

          .aurora-orb,
          .poster-frame__inner,
          .courts-stage__img,
          .hero-title-line__inner,
          .hero-logo-image {
            will-change: auto;
          }

          .hero-logo-image {
            filter: drop-shadow(0 14px 28px rgba(0, 0, 0, 0.24));
          }

          .gold-ink,
          .floating-entry__pulse,
          .section-kicker__index,
          .live-badge__dot,
          .hero-logo-orbit,
          .prize-tier--featured .prize-tier__shine {
            animation: none !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .hero-ambient__glow {
            opacity: 0.28;
          }
        }

        @media (max-width: 460px) {
          .padel-nav-header {
            padding-inline: 0.6rem;
          }

          .nav-shell {
            height: 3.35rem;
            padding-inline: 0.55rem;
          }

          .hero-title {
            font-size: 3rem;
          }

          .hero-fact__value {
            font-size: 0.98rem;
          }

          .hero-chip {
            font-size: 0.52rem;
            letter-spacing: 0.12em;
          }

          .contact-link__text {
            font-size: 1.2rem;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .hero-bg__image {
            animation: none !important;
          }

          .stat-card,
          .detail-row,
          .detail-row::before,
          .flow-card::before,
          .flow-card__score,
          .flow-card__tag,
          .score-rail__call,
          .visual-poster__image,
          .visual-poster__overlay,
          .principle-row__check,
          .field-shell__control::after,
          .contact-link .contact-link__text,
          .floating-entry,
          .floating-entry__pulse,
          .section-kicker__index,
          .hero-chip,
          .upcoming-event-card,
          .prize-tier,
          .prize-tier__shine,
          .prize-tier__step {
            transition: none !important;
            animation: none !important;
          }

          .hero-badge__svg,
          .live-badge__dot,
          .section-orbit--center,
          .marquee-band__track,
          .prize-tier--featured .prize-tier__shine,
          .submit-spinner,
          .gold-ink,
          .floating-entry__pulse,
          .section-kicker__index {
            animation: none !important;
          }

          .stat-card--featured,
          .upcoming-event-card:hover,
          .prize-tier:hover {
            transform: none;
          }

          .visual-poster__overlay {
            opacity: 1;
          }

          .reveal-word__inner {
            transform: none;
          }
        }
      `}</style>
  );
}
