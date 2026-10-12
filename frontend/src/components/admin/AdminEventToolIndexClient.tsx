'use client';

import { useEffect, useState } from 'react';
import { InlineNotice } from '@/components/tournament/TournamentUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { useEventOperations } from '@/hooks/useEventOperations';
import { useViewer } from '@/hooks/useViewer';
import { apiFetch } from '@/lib/api';
import type { EventDto } from '@/types/admin';
import { AdminShell } from './AdminShell';
import { AdminEventBoard } from './AdminEventBoard';

type EventTool = 'workspace' | 'registrations' | 'brackets' | 'opponents' | 'schedule' | 'control';

// An empty suffix lands on the event workspace itself, so every sidebar step
// has an event picker behind it and none of them dead-end.
const toolSuffix: Record<EventTool, string> = {
  workspace: '',
  registrations: 'registrations',
  brackets: 'bracket',
  opponents: 'opponent-requests',
  schedule: 'schedule',
  control: 'control',
};

/**
 * The event picker behind each sidebar step. It reuses the role home's board so
 * choosing an event is the same act everywhere — and so the picker can say
 * which event actually needs that step, instead of listing them all alike.
 */
export function AdminEventToolIndexClient({ tool }: { tool: EventTool }) {
  const { dictionary } = useI18n();
  const copy = dictionary.dashboard.admin.operationsPages;
  const pageCopy = copy[tool];
  const { operations, loading: operationsLoading } = useEventOperations();
  const { viewer } = useViewer();
  const [events, setEvents] = useState<EventDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await apiFetch('/api/events?scope=admin', { cache: 'no-store' });
      const data = await response.json() as { events?: EventDto[]; error?: string };
      if (cancelled) return;
      if (!response.ok) setError(data.error ?? copy.loadFailed);
      else setEvents(data.events ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [copy.loadFailed]);

  return (
    <AdminShell title={pageCopy.title} description={pageCopy.description} eyebrow={copy.eyebrow}>
      {error ? <div className="mb-4"><InlineNotice kind="error" onDismiss={() => setError('')}>{error}</InlineNotice></div> : null}
      <AdminEventBoard
        events={events}
        operations={operations}
        loading={loading || operationsLoading}
        isOrganiser={viewer?.role === 'ORGANISER'}
        title={pageCopy.title}
        description={pageCopy.description}
        hrefSuffix={toolSuffix[tool]}
        actionLabel={pageCopy.action}
      />
    </AdminShell>
  );
}
