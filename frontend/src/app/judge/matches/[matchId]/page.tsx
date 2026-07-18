import { redirect } from 'next/navigation';
import { JudgeMatchClient } from '@/components/judge/JudgeMatchClient';
import { getCurrentUser } from '@/lib/auth';

export default async function JudgeMatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const user = await getCurrentUser(); if (!user) redirect('/login?next=/judge');
  const { matchId } = await params;
  return <JudgeMatchClient user={user} matchId={matchId} />;
}

