'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';

const authInputClass =
  'border-[var(--padel-ink)]/18 bg-white/70 text-[var(--padel-ink)] placeholder:text-[var(--padel-ink)]/40 focus-visible:ring-[var(--padel-red)]';

export function InviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    const response = await apiFetch('/api/auth/invite/complete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, name, surname, password }),
    });
    const data = (await response.json()) as { error?: string };
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? 'Could not complete invite.');
      return;
    }

    router.push('/dashboard');
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--padel-red)]">
          Teammate invite
        </p>
        <h2 className="font-display mt-2 text-4xl font-semibold">Create your password</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--padel-ink)]/65">
          Finish your profile to see the team registration in your dashboard.
        </p>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" required value={name} onChange={(event) => setName(event.target.value)} className={authInputClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="surname">Surname</Label>
          <Input id="surname" required value={surname} onChange={(event) => setSurname(event.target.value)} className={authInputClass} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className={authInputClass} />
      </div>
      <Button type="submit" variant="red" size="lg" disabled={loading} className="min-h-12 w-full">
        {loading ? 'Saving' : 'Complete profile'}
        <ArrowRight className="h-5 w-5" />
      </Button>
    </form>
  );
}
