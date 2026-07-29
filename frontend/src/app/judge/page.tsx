import { redirect } from 'next/navigation';
import { JudgeHomeClient } from '@/components/judge/JudgeHomeClient';
import { getCurrentUser } from '@/lib/auth';

export default async function JudgePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/judge');
  return <JudgeHomeClient user={user} />;
}

