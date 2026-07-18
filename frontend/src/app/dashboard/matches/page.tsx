import { redirect } from 'next/navigation';
import { PlayerMatchHistoryClient } from '@/components/dashboard/PlayerMatchHistoryClient';
import { getCurrentUser } from '@/lib/auth';

export default async function DashboardMatchesPage() { const user = await getCurrentUser(); if (!user) redirect('/login?next=/dashboard/matches'); if (user.role !== 'USER') redirect(user.role === 'ADMIN' ? '/admin' : '/judge'); return <PlayerMatchHistoryClient user={user} />; }

