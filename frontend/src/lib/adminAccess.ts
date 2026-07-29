import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import type { PublicUser } from '@/types/auth';

/**
 * Gates for the /admin area, which admins and organisers share.
 *
 * These mirror the server's authorization rather than replace it — every
 * endpoint behind them checks again. Their job is to keep an organiser from
 * landing on a screen whose every action would 403.
 */

/** Screens only an admin may open: accounts, clubs, setup, and platform tools. */
export async function requireAdminOnlyPage(): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/admin');
  if (user.role !== 'ADMIN') redirect('/admin');
  return user;
}

/**
 * Screens that belong to the signed-in person rather than the platform, so
 * everyone with an /admin workspace may open them — organisers included.
 */
export async function requireAdminAreaPage(): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/admin');
  if (user.role !== 'ADMIN' && user.role !== 'ORGANISER') redirect('/dashboard');
  return user;
}

/** One event's workspace: any admin, or the organiser it was handed to. */
export async function requireEventWorkspace(eventId: string): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/admin/events/${eventId}`);
  if (user.role === 'ADMIN') return user;
  if (user.role === 'ORGANISER' && user.organiserEventIds.includes(eventId)) return user;
  redirect('/admin');
}
