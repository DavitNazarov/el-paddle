'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';
import { ArrowRight, Mail } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { API_BASE_URL, apiFetch, apiUrl, readApiJson } from '@/lib/api';
import { useI18n } from '@/components/shared/I18nProvider';
import { authInputClassName } from '@/constants/form-styles';


type LoginFormProps = {
  nextPath?: string;
  oauthError?: string;
};

export function LoginForm({ nextPath = '/dashboard', oauthError }: LoginFormProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const oauthMessage = useMemo(() => {
    if (oauthError === 'google-not-configured') {
      return t('forms.login.googleConfig');
    }
    if (oauthError === 'legal-consent-required') {
      return t('forms.login.googleError');
    }
    if (oauthError) return t('forms.login.googleError');
    return '';
  }, [oauthError, t]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await readApiJson<{ error?: string; user?: { role?: string; club?: unknown } }>(response, {});

      if (!response.ok) {
        setError(data.error ?? t('forms.login.loginError'));
        return;
      }

      const destination =
        data.user?.role === 'ADMIN'
          ? '/admin'
          : data.user?.role === 'JUDGE'
            ? '/judge'
          : data.user?.club
            ? nextPath
            : '/complete-club';
      router.push(destination);
      router.refresh();
    } catch {
      setError(t('forms.apiConnectionError', { url: API_BASE_URL }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--padel-red)]">
          {t('forms.login.kicker')}
        </p>
        <h2 className="font-display mt-2 text-4xl font-semibold">{t('forms.login.title')}</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--padel-ink)]/65">
          {t('forms.login.copy')}
        </p>
      </div>

      {error || oauthMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{error || oauthMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">{t('common.email')}</Label>
          <Input id="email" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={authInputClassName} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{t('common.password')}</Label>
          <Input id="password" required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className={authInputClassName} />
        </div>
      </div>

      <Button type="submit" variant="red" size="lg" disabled={loading} className="min-h-12 w-full">
        {loading ? t('forms.login.loggingIn') : t('forms.login.submit')}
        <ArrowRight className="h-5 w-5" />
      </Button>

      <Button asChild variant="outline" size="lg" className="min-h-12 w-full border-[var(--padel-ink)]/20 bg-transparent text-[var(--padel-ink)] hover:bg-[var(--padel-ink)]/5 hover:text-[var(--padel-ink)]">
        <a href={apiUrl('/api/auth/google')}>
          <Mail className="h-5 w-5" />
          {t('forms.login.gmail')}
        </a>
      </Button>

      <p className="text-center text-sm text-[var(--padel-ink)]/65">
        {t('forms.login.needAccount')}{' '}
        <Link href="/register" className="font-semibold text-[var(--padel-red)] underline-offset-4 hover:underline">
          {t('forms.login.createAccount')}
        </Link>
      </p>
    </form>
  );
}
