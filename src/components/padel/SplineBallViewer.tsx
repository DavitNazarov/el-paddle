'use client';

import Script from 'next/script';

const SPLINE_VIEWER_SCRIPT =
  'https://unpkg.com/@splinetool/viewer@1.12.98/build/spline-viewer.js';

type SplineBallViewerProps = {
  url: string;
  className?: string;
};

export function SplineBallViewer({ url, className }: SplineBallViewerProps) {
  if (!url) return null;

  return (
    <>
      <Script src={SPLINE_VIEWER_SCRIPT} type="module" strategy="afterInteractive" />
      <spline-viewer loading-anim-type="none" url={url} className={className} />
    </>
  );
}
