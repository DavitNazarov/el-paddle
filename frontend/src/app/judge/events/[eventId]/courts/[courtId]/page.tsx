import { redirect } from 'next/navigation';
import { JudgeQueueClient } from '@/components/judge/JudgeQueueClient';
import { getCurrentUser } from '@/lib/auth';

export default async function JudgeCourtPage({ params }: { params: Promise<{ eventId: string; courtId: string }> }) {
  const user = await getCurrentUser(); if (!user) redirect('/login?next=/judge');
  const { eventId, courtId } = await params;
  return <JudgeQueueClient user={user} eventId={eventId} courtId={courtId} />;
}

