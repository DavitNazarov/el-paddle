import type { Metadata } from 'next';
import { requireAdminAreaPage } from '@/lib/adminAccess';
import { getCurrentUser } from '@/lib/auth';
import { AdminSettingsClient } from '@/components/admin/AdminSettingsClient';

// Admins and organisers share this screen, so the tab title follows the reader
// rather than the route it happens to live on.
export async function generateMetadata(): Promise<Metadata> {
  const user = await getCurrentUser();
  const area = user?.role === 'ORGANISER' ? 'Organiser' : 'Admin';
  return { title: `Settings — ${area} — El Padel` };
}

export default async function AdminSettingsPage() {
  const user = await requireAdminAreaPage();
  return <AdminSettingsClient user={user} />;
}
