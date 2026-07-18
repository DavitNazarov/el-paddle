import { redirect } from 'next/navigation';
import { JudgeAssignmentsClient } from '@/components/judge/JudgeAssignmentsClient';
import { getCurrentUser } from '@/lib/auth';

export default async function JudgePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/judge');
  return <JudgeAssignmentsClient user={user} />;
}

