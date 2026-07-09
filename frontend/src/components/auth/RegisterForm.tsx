'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { ArrowRight, Mail } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { API_BASE_URL, apiFetch, apiUrl, readApiJson } from '@/lib/api';
import { useI18n } from '@/components/shared/I18nProvider';
import { authInputClassName } from '@/constants/form-styles';
import { friendlyError } from '@/lib/utils/errors';

type Step = 'details' | 'verify';


export function RegisterForm() {
  const router = useRouter();
  const { t } = useI18n();
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

    try {
      const response = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, name, surname, password }),
      });
      const data = await readApiJson<{ error?: string; message?: string }>(response, {});

      if (!response.ok) {
        setError(friendlyError(data.error, t('forms.register.createError'), t('forms.databaseNotReady')));
        return;
      }

      setStep('verify');
      setMessage(data.message ?? t('forms.register.sent'));
    } catch {
      setError(t('forms.apiConnectionError', { url: API_BASE_URL }));
    } finally {
      setLoading(false);
    }
  };

  const verifyAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiFetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await readApiJson<{ error?: string }>(response, {});

      if (!response.ok) {
        setError(friendlyError(data.error, t('forms.register.verifyError'), t('forms.databaseNotReady')));
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch {
      setError(t('forms.apiConnectionError', { url: API_BASE_URL }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--padel-red)]">
          {t('forms.register.kicker')}
        </p>
        <h2 className="font-display mt-2 text-4xl font-semibold">
          {step === 'details' ? t('forms.register.profileTitle') : t('forms.register.verifyTitle')}
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--padel-ink)]/65">
          {step === 'details'
            ? t('forms.register.profileCopy')
            : t('forms.register.verifyCopy', { email })}
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
          <Field id="email" label={t('common.email')}>
            <Input id="email" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={authInputClassName} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="name" label={t('common.name')}>
              <Input id="name" required autoComplete="given-name" value={name} onChange={(event) => setName(event.target.value)} className={authInputClassName} />
            </Field>
            <Field id="surname" label={t('common.surname')}>
              <Input id="surname" required autoComplete="family-name" value={surname} onChange={(event) => setSurname(event.target.value)} className={authInputClassName} />
            </Field>
          </div>
          <Field id="password" label={t('common.password')}>
            <Input id="password" required minLength={8} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className={authInputClassName} />
          </Field>
          <Button type="submit" variant="red" size="lg" disabled={loading} className="min-h-12 w-full">
            {loading ? t('forms.register.sending') : t('forms.register.create')}
            <ArrowRight className="h-5 w-5" />
          </Button>
        </form>
      ) : (
        <form onSubmit={verifyAccount} className="space-y-5">
          <Field id="code" label={t('forms.register.verificationCode')}>
            <Input id="code" required inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} placeholder="123456" className={authInputClassName} />
          </Field>
          <Button type="submit" variant="red" size="lg" disabled={loading} className="min-h-12 w-full">
            {loading ? t('forms.register.verifying') : t('forms.register.verifyAndEnter')}
            <ArrowRight className="h-5 w-5" />
          </Button>
        </form>
      )}

      <Button asChild variant="outline" size="lg" className="min-h-12 w-full border-[var(--padel-ink)]/20 bg-transparent text-[var(--padel-ink)] hover:bg-[var(--padel-ink)]/5 hover:text-[var(--padel-ink)]">
        <a href={apiUrl('/api/auth/google')}>
          <Mail className="h-5 w-5" />
          {t('forms.register.gmail')}
        </a>
      </Button>

      <p className="text-center text-sm text-[var(--padel-ink)]/65">
        {t('forms.register.alreadyRegistered')}{' '}
        <Link href="/login" className="font-semibold text-[var(--padel-red)] underline-offset-4 hover:underline">
          {t('forms.register.login')}
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
