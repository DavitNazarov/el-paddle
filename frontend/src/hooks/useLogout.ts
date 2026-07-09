'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { apiFetch } from '@/lib/api';

export function useLogout(redirectTo = '/login') {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push(redirectTo);
      router.refresh();
    }
  }, [redirectTo, router]);

  return { logout, loggingOut };
}
