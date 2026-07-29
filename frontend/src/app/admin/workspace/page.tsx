import type { Metadata } from 'next';
import { AdminEventToolIndexClient } from '@/components/admin/AdminEventToolIndexClient';

export const metadata: Metadata = { title: 'Event workspace — Admin — El Padel' };

export default function AdminEventWorkspaceIndexPage() {
  return <AdminEventToolIndexClient tool="workspace" />;
}
