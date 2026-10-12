'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle, MonitorSmartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FeedbackBanner, SurfaceCard } from '@/components/shared/dashboard/DashboardUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { tournamentCopy, fillTemplate } from '@/lib/i18n/tournament';
import { apiFetch, readApiJson } from '@/lib/api';

type SessionRow = {
  id: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
};

/**
 * The devices this account is signed in on.
 *
 * "Sign out everywhere" existed with nothing to look at first, so the only way
 * to deal with one forgotten browser was to sign out of all of them and log
 * back in on each. This lists them and revokes one.
 *
 * It says exactly as much as the record holds: when a session started and when
 * it expires. No session carries a user agent or an address, so the list never
 * claims to name a device — inventing "Chrome on Windows" from nothing would be
 * the one thing worse than not saying.
 */
export function AccountSessions() {
  const { locale, formatDate } = useI18n();
  const router = useRouter();
  const copy = tournamentCopy[locale].account.sessions;
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/account/sessions', { cache: 'no-store' });
      const data = await readApiJson<{ sessions?: SessionRow[]; error?: string }>(response, {});
      if (!response.ok) {
        setError(data.error ?? copy.loadError);
        return;
      }
      setSessions(data.sessions ?? []);
      setError('');
    } catch {
      setError(copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.loadError]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function revoke(session: SessionRow) {
    setBusy(session.id);
    try {
      const response = await apiFetch(`/api/account/sessions/${session.id}`, { method: 'DELETE' });
      const data = await readApiJson<{ signedOut?: boolean; error?: string }>(response, {});
      if (!response.ok) {
        setError(data.error ?? copy.revokeError);
        return;
      }
      // Revoking the device you are reading from ends this session too, so the
      // only honest next screen is the login page.
      if (data.signedOut) {
        router.push('/login');
        router.refresh();
        return;
      }
      await load();
    } catch {
      setError(copy.revokeError);
    } finally {
      setBusy('');
    }
  }

  return (
    <SurfaceCard className="mt-4 overflow-hidden">
      <div className="border-b border-[var(--dash-border)] p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[var(--dash-border)] bg-[var(--dash-tint)] text-[var(--dash-muted)]">
            <MonitorSmartphone className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--dash-text)]">{copy.title}</h3>
            <p className="mt-1 text-sm leading-5 text-[var(--dash-muted)]">{copy.description}</p>
          </div>
        </div>
      </div>

      <div className="p-5">
        {error ? <FeedbackBanner kind="error">{error}</FeedbackBanner> : null}
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-[var(--dash-muted)]">
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            {copy.loading}
          </p>
        ) : null}
        {!loading && !sessions.length ? (
          <p className="text-sm text-[var(--dash-muted)]">{copy.empty}</p>
        ) : null}
        {sessions.length ? (
          <ul className="grid gap-2">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--dash-border)] px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--dash-text)]">
                    {session.current ? copy.thisDevice : copy.otherDevice}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--dash-muted)]">
                    {fillTemplate(copy.since, {
                      date: formatDate(session.createdAt, { dateStyle: 'medium', timeStyle: 'short' }),
                    })}
                    {' · '}
                    {fillTemplate(copy.until, {
                      date: formatDate(session.expiresAt, { dateStyle: 'medium' }),
                    })}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={Boolean(busy)}
                  onClick={() => void revoke(session)}
                  className="min-h-11 rounded-md px-4"
                >
                  {busy === session.id
                    ? copy.revoking
                    : session.current ? copy.signOutThis : copy.revoke}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </SurfaceCard>
  );
}
