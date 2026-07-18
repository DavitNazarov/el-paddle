import type { Metadata } from 'next';
import { AdminEventToolIndexClient } from '@/components/admin/AdminEventToolIndexClient';

export const metadata: Metadata = { title: 'Opponent requests — Admin — El Padel' };

export default function AdminOpponentRequestsIndexPage() {
  return <AdminEventToolIndexClient tool="opponents" />;
}
