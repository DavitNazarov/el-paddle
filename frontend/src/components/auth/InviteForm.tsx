'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { API_BASE_URL, apiFetch, readApiJson } from '@/lib/api';
import { useI18n } from '@/components/shared/I18nProvider';
import { authInputClassName } from '@/constants/form-styles';

export function InviteForm({ token }: { token: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiFetch('/api/auth/invite/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, name, surname, password }),
      });
      const data = await readApiJson<{ error?: string; user?: { club?: unknown } }>(response, {});

      if (!response.ok) {
        setError(data.error ?? t('forms.invite.error'));
        return;
      }

      router.push(data.user?.club ? '/dashboard' : '/complete-club');
      router.refresh();
    } catch {
      setError(t('forms.apiConnectionError', { url: API_BASE_URL }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--padel-red)]">
          {t('forms.invite.kicker')}
        </p>
        <h2 className="font-display mt-2 text-4xl font-semibold">{t('forms.invite.title')}</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--padel-ink)]/65">
          {t('forms.invite.copy')}
        </p>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">{t('common.name')}</Label>
          <Input id="name" required value={name} onChange={(event) => setName(event.target.value)} className={authInputClassName} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="surname">{t('common.surname')}</Label>
          <Input id="surname" required value={surname} onChange={(event) => setSurname(event.target.value)} className={authInputClassName} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t('common.password')}</Label>
        <Input id="password" required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className={authInputClassName} />
      </div>
      <Button type="submit" variant="red" size="lg" disabled={loading} className="min-h-12 w-full">
        {loading ? t('forms.invite.saving') : t('forms.invite.complete')}
        <ArrowRight className="h-5 w-5" />
      </Button>
    </form>
  );
}

export function MissingInviteToken() {
  const { t } = useI18n();
  return <p className="text-sm text-[var(--padel-ink)]/70">{t('forms.invite.missingToken')}</p>;
}
