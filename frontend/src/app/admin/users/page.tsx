import { redirect } from 'next/navigation';

/** Accounts are managed one role at a time; players are the busiest list. */
export default function AdminUsersPage() {
  redirect('/admin/users/players');
}
