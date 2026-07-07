import { cookies } from 'next/headers';
import { apiUrl } from '@/lib/api';

export type UserRole = 'USER' | 'ADMIN';
export type UserStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'INVITED';

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  surname: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  isVerified: boolean;
  stats: {
    matchesPlayed: number;
    wins: number;
    losses: number;
  };
};

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
