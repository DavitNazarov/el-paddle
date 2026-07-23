import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { NotificationsClient } from '@/components/notifications/NotificationsClient';
import { getCurrentUser } from '@/lib/auth';
import { noIndexMetadata } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Notifications — El Padel',
  ...noIndexMetadata,
};

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/notifications');
  return <NotificationsClient user={user} />;
}
