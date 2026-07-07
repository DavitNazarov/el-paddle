'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';
import { ArrowRight, Mail } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch, apiUrl } from '@/lib/api';

const authInputClass =
  'border-[var(--padel-ink)]/18 bg-white/70 text-[var(--padel-ink)] placeholder:text-[var(--padel-ink)]/40 focus-visible:ring-[var(--padel-red)]';

type LoginFormProps = {
  nextPath?: string;
  oauthError?: string;
};

export function LoginForm({ nextPath = '/dashboard', oauthError }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const oauthMessage = useMemo(() => {
    if (oauthError === 'google-not-configured') {
      return 'Gmail login needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env.';
    }
    if (oauthError) return 'Gmail login could not be completed.';
    return '';
  }, [oauthError]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    const response = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = (await response.json()) as { error?: string };
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? 'Could not log in.');
      return;
    }

    router.push(nextPath);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--padel-red)]">
          Log in
        </p>
        <h2 className="font-display mt-2 text-4xl font-semibold">Back to court</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--padel-ink)]/65">
          Use your verified email and password.
        </p>
      </div>

      {error || oauthMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{error || oauthMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={authInputClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className={authInputClass} />
        </div>
      </div>

      <Button type="submit" variant="red" size="lg" disabled={loading} className="min-h-12 w-full">
        {loading ? 'Logging in' : 'Log in'}
        <ArrowRight className="h-5 w-5" />
      </Button>

      <Button asChild variant="outline" size="lg" className="min-h-12 w-full border-[var(--padel-ink)]/20 bg-transparent text-[var(--padel-ink)] hover:bg-[var(--padel-ink)]/5 hover:text-[var(--padel-ink)]">
        <a href={apiUrl('/api/auth/google')}>
          <Mail className="h-5 w-5" />
          Continue with Gmail
        </a>
      </Button>

      <p className="text-center text-sm text-[var(--padel-ink)]/65">
        Need an account?{' '}
        <Link href="/register" className="font-semibold text-[var(--padel-red)] underline-offset-4 hover:underline">
          Create account
        </Link>
      </p>
    </form>
  );
}
