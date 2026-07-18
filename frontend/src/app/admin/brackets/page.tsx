import type { Metadata } from 'next';
import { AdminEventToolIndexClient } from '@/components/admin/AdminEventToolIndexClient';

export const metadata: Metadata = { title: 'Brackets — Admin — El Padel' };

export default function AdminBracketsPage() {
  return <AdminEventToolIndexClient tool="brackets" />;
}
