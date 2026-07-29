import { cookies } from 'next/headers';
import { apiUrl } from '@/lib/api';
import type { DashboardData } from '@/types/dashboard';

/**
 * Fetch the player dashboard payload on the server so the page can hydrate with
 * it directly (F6) instead of rendering, mounting, and refetching `/api/dashboard`
 * on the client. Returns null when unauthenticated so the caller can redirect.
 * The single payload also carries `user`, so it doubles as the gating check.
 */
export async function getPlayerDashboardData(): Promise<DashboardData | null> {
  const cookieHeader = (await cookies()).toString();

  try {
    const response = await fetch(apiUrl('/api/dashboard'), {
      cache: 'no-store',
      headers: cookieHeader ? { cookie: cookieHeader } : {},
    });

    if (!response.ok) return null;
    return (await response.json()) as DashboardData;
  } catch {
    return null;
  }
}
