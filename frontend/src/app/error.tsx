'use client';

import { RouteFailure } from '@/components/tournament/RouteScreens';

/**
 * The boundary under the root layout, so the language provider and the site
 * chrome are still mounted around the message.
 */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteFailure digest={error.digest} onRetry={reset} />;
}
