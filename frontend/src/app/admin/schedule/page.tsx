import type { Metadata } from 'next';
import { AdminEventToolIndexClient } from '@/components/admin/AdminEventToolIndexClient';

export const metadata: Metadata = { title: 'Courts & schedule — Admin — El Padel' };

export default function AdminScheduleIndexPage() {
  return <AdminEventToolIndexClient tool="schedule" />;
}
