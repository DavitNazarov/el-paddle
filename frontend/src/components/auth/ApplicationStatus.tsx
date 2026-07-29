'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { apiFetch, readApiJson } from '@/lib/api';
import { useI18n } from '@/components/shared/I18nProvider';
import type { ClubApplication } from '@/types/auth';

/**
 * Where an applicant lands when they come back later. The request lives in a
 * short-lived cookie, so this can only report on the browser that filed it —
 * the decision always arrives by email regardless.
 */
export function ApplicationStatus() {
  const { t } = useI18n();
  const [application, setApplication] = useState<ClubApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await apiFetch('/api/applications/current');
        const data = await readApiJson<{ application?: ClubApplication | null }>(response, {});
        if (!active) return;
        setApplication(response.ok ? (data.application ?? null) : null);
      } catch {
        if (active) setError(t('forms.apiConnectionError'));
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [t]);

  const submitted = application?.status === 'SUBMITTED';

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--padel-red)]">
          {t('forms.register.kicker')}
        </p>
        <h2 className="font-display mt-2 text-4xl font-semibold">{t('forms.register.statusTitle')}</h2>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--padel-ink)]/65">{t('common.loading')}</p>
      ) : (
        <div className="space-y-5">
          <div className="rounded-lg border border-[var(--padel-ink)]/12 bg-[var(--padel-ink)]/[0.035] p-4 text-sm leading-6">
            <p>
              {submitted
                ? t('forms.register.statusPending', { email: application!.email })
                : application
                  ? t('forms.register.statusDraft')
                  : t('forms.register.statusNone')}
            </p>
          </div>

          {application && !submitted ? (
            <Button asChild variant="red" size="lg" className="min-h-12 w-full">
              <Link href="/register">{t('forms.register.statusContinue')}</Link>
            </Button>
          ) : null}

          <p className="text-center text-sm text-[var(--padel-ink)]/65">
            {t('forms.register.alreadyRegistered')}{' '}
            <Link href="/login" className="font-semibold text-[var(--padel-red)] underline-offset-4 hover:underline">
              {t('forms.register.login')}
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
