'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { ArrowRight, Mail } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch, apiUrl } from '@/lib/api';

type Step = 'details' | 'verify';

const authInputClass =
  'border-[var(--padel-ink)]/18 bg-white/70 text-[var(--padel-ink)] placeholder:text-[var(--padel-ink)]/40 focus-visible:ring-[var(--padel-red)]';

function friendlyError(error: string | undefined, fallback: string) {
  if (!error) return fallback;
  if (
    error.includes('__TURBOPACK') ||
    error.includes('Prisma') ||
    error.includes('adapter') ||
    error.includes('ECONNREFUSED') ||
    error.length > 180
  ) {
    return 'Database is not ready yet. Start Docker Postgres and run the Prisma migration, then try again.';
  }
  return error;
}

export function RegisterForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('details');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const createAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const response = await apiFetch('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, name, surname, password }),
    });
    const data = (await response.json()) as { error?: string; message?: string };
    setLoading(false);

    if (!response.ok) {
      setError(friendlyError(data.error, 'Could not create account.'));
      return;
    }

    setStep('verify');
    setMessage(data.message ?? 'Verification code sent.');
  };

  const verifyAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    const response = await apiFetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });
    const data = (await response.json()) as { error?: string };
    setLoading(false);

    if (!response.ok) {
      setError(friendlyError(data.error, 'Could not verify account.'));
      return;
    }

    router.push('/dashboard');
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--padel-red)]">
          Create account
        </p>
        <h2 className="font-display mt-2 text-4xl font-semibold">
          {step === 'details' ? 'Player profile' : 'Verify email'}
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--padel-ink)]/65">
          {step === 'details'
            ? 'Use your real name and surname. Teammates are linked by email.'
            : `Enter the code sent to ${email}.`}
        </p>
      </div>

      {error ? (
        <Alert variant="destructive" className="overflow-hidden">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {message ? (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      {step === 'details' ? (
        <form onSubmit={createAccount} className="space-y-5">
          <Field id="email" label="Email">
            <Input id="email" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={authInputClass} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="name" label="Name">
              <Input id="name" required autoComplete="given-name" value={name} onChange={(event) => setName(event.target.value)} className={authInputClass} />
            </Field>
            <Field id="surname" label="Surname">
              <Input id="surname" required autoComplete="family-name" value={surname} onChange={(event) => setSurname(event.target.value)} className={authInputClass} />
            </Field>
          </div>
          <Field id="password" label="Password">
            <Input id="password" required minLength={8} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className={authInputClass} />
          </Field>
          <Button type="submit" variant="red" size="lg" disabled={loading} className="min-h-12 w-full">
            {loading ? 'Sending code' : 'Create account'}
            <ArrowRight className="h-5 w-5" />
          </Button>
        </form>
      ) : (
        <form onSubmit={verifyAccount} className="space-y-5">
          <Field id="code" label="Verification code">
            <Input id="code" required inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} placeholder="123456" className={authInputClass} />
          </Field>
          <Button type="submit" variant="red" size="lg" disabled={loading} className="min-h-12 w-full">
            {loading ? 'Verifying' : 'Verify and enter dashboard'}
            <ArrowRight className="h-5 w-5" />
          </Button>
        </form>
      )}

      <Button asChild variant="outline" size="lg" className="min-h-12 w-full border-[var(--padel-ink)]/20 bg-transparent text-[var(--padel-ink)] hover:bg-[var(--padel-ink)]/5 hover:text-[var(--padel-ink)]">
        <a href={apiUrl('/api/auth/google')}>
          <Mail className="h-5 w-5" />
          Continue with Gmail
        </a>
      </Button>

      <p className="text-center text-sm text-[var(--padel-ink)]/65">
        Already registered?{' '}
        <Link href="/login" className="font-semibold text-[var(--padel-red)] underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
