import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { JudgeSettingsClient } from '@/components/judge/JudgeSettingsClient';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Settings — Judge — El Padel',
};

export default async function JudgeSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/judge/settings');
  return <JudgeSettingsClient user={user} />;
}
