'use client';

import Link from 'next/link';
import { ArrowRight, Check, CircleAlert, Clock3 } from 'lucide-react';
import { useI18n } from '@/components/shared/I18nProvider';
import { tournamentCopy } from '@/lib/i18n/tournament';
import type { EventWorkspaceSignals } from '@/hooks/useEventWorkspaceSignals';
import type { EventDto } from '@/types/admin';
import { agendaAllClear, eventAgenda } from './eventAgenda';
import styles from './EventWorkspace.module.css';

/**
 * The one thing to do next, and a way to reach the rest.
 *
 * An operator arriving at this screen has one question, and it is not "what
 * stage is this event in" — it is "what is waiting on me". The most costly item
 * gets the headline and the button; everything else behind it is a row of links,
 * because a list of five equally-weighted cards is a list nobody reads.
 *
 * When nothing is waiting the band says so outright. An empty space would read
 * as a screen still loading, and quiet is itself worth confirming during an
 * event.
 */
export function EventAgendaBand({
  event,
  signals,
  loading,
}: {
  event: EventDto;
  signals: EventWorkspaceSignals;
  loading: boolean;
}) {
  const { locale } = useI18n();
  const copy = tournamentCopy[locale].admin.event;
  const items = eventAgenda(event, signals, copy);
  const [lead, ...rest] = items;

  if (loading && !items.length) {
    return (
      <section className={styles.agenda} data-tone="quiet" aria-labelledby="event-agenda">
        <h2 id="event-agenda" className={styles.agendaEyebrow}>{copy.agendaTitle}</h2>
        <p className={styles.agendaHeadline}>{copy.agendaCounting}</p>
      </section>
    );
  }

  if (!lead) {
    return (
      <section className={styles.agenda} data-tone="clear" aria-labelledby="event-agenda">
        <h2 id="event-agenda" className={styles.agendaEyebrow}>
          <Check aria-hidden="true" />
          {copy.agendaClearTitle}
        </h2>
        <p className={styles.agendaHeadline}>{agendaAllClear(event, copy)}</p>
      </section>
    );
  }

  return (
    <section className={styles.agenda} data-tone={lead.tone} aria-labelledby="event-agenda">
      <h2 id="event-agenda" className={styles.agendaEyebrow}>
        {lead.tone === 'urgent' ? <CircleAlert aria-hidden="true" /> : <Clock3 aria-hidden="true" />}
        {copy.agendaTitle}
      </h2>

      <div className={styles.agendaLead}>
        <p className={styles.agendaHeadline}>{lead.headline}</p>
        <Link className={styles.agendaAction} href={lead.href}>
          {lead.action}
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>

      {rest.length ? (
        <div className={styles.agendaRest}>
          <span className={styles.agendaRestLabel}>{copy.agendaAlso}</span>
          <ul className={styles.agendaRestList}>
            {rest.map((item) => (
              <li key={item.key}>
                <Link className={styles.agendaRestLink} href={item.href}>{item.headline}</Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
