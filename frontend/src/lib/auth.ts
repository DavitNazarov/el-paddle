import { cookies } from 'next/headers';
import { apiUrl } from '@/lib/api';
import type { PublicUser } from '@/types/auth';

export type { PublicUser, UserRole, UserStatus } from '@/types/auth';

export async function getCurrentUser() {
  const cookieHeader = (await cookies()).toString();

  try {
    const response = await fetch(apiUrl('/api/auth/me'), {
      cache: 'no-store',
      headers: cookieHeader ? { cookie: cookieHeader } : {},
    });

    if (!response.ok) return null;
    const data = (await response.json()) as { user: PublicUser | null };
    return data.user;
  } catch {
    return null;
  }
}
