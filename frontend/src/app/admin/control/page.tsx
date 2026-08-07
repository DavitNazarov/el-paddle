import type { Metadata } from 'next';
import { AdminEventToolIndexClient } from '@/components/admin/AdminEventToolIndexClient';

export const metadata: Metadata = { title: 'Match control — Admin — El Padel' };

export default function AdminMatchControlIndexPage() {
  return <AdminEventToolIndexClient tool="control" />;
}
