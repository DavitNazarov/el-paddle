import { redirect } from 'next/navigation';
import { NotificationsClient } from '@/components/notifications/NotificationsClient';
import { getCurrentUser } from '@/lib/auth';

export default async function NotificationsPage() { const user = await getCurrentUser(); if (!user) redirect('/login?next=/notifications'); return <NotificationsClient user={user} />; }

