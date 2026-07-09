import type { Metadata } from 'next';
import { AdminSettingsClient } from '@/components/admin/AdminSettingsClient';

export const metadata: Metadata = {
  title: 'Settings — Admin — El Padel',
};

export default function AdminSettingsPage() {
  return <AdminSettingsClient />;
}
