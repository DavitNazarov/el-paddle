'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { NotificationDto } from '@/types/tournament';
import { StatusLabel } from '@/components/tournament/TournamentUI';
import { useI18n } from '@/components/shared/I18nProvider';
import { fillTemplate, tournamentCopy } from '@/lib/i18n/tournament';
import { groupByDay, isUnread, type NotificationDay } from './notificationsModel';
import styles from './Notifications.module.css';

/**
 * One day of notifications. The heading carries its own unread count, so a
 * reader scrolling a long history can see which days still hold something for
 * them without reading every row.
 */
function DayGroup({ day, onOpen }: { day: NotificationDay; onOpen: (notification: NotificationDto) => void }) {
  const { locale, formatDate } = useI18n();
  const copy = tournamentCopy[locale].notifications;

  return (
    <section className={styles.group} aria-label={formatDate(day.date, { dateStyle: 'full' })}>
      <div className={styles.dayHead}>
        <h3 className={styles.dayName}>{formatDate(day.date, { dateStyle: 'full' })}</h3>
        {day.unread ? (
          <span className={styles.dayCount}>{fillTemplate(copy.unreadCount, { count: day.unread })}</span>
        ) : null}
      </div>
      {day.items.map((notification) => {
        const unread = isUnread(notification);
        return (
          <Link
            key={notification.id}
            href={notification.actionPath}
            className={styles.row}
            data-unread={unread}
            onClick={() => onOpen(notification)}
          >
            <div className={styles.rowTop}>
              <h4 className={styles.rowTitle}>{notification.title}</h4>
              <StatusLabel icon={unread ? 'dot' : 'check'}>{unread ? copy.unread : copy.read}</StatusLabel>
            </div>
            <p className={styles.rowMessage}>{notification.message}</p>
            <div className={styles.rowFoot}>
              <time className={styles.rowTime} dateTime={notification.createdAt}>
                {formatDate(notification.createdAt, { timeStyle: 'short' })}
              </time>
              <span className={styles.rowGo}>
                {copy.openTarget}
                <ArrowRight aria-hidden="true" />
              </span>
            </div>
          </Link>
        );
      })}
    </section>
  );
}

/** The whole queue, already ordered by the caller. */
export function NotificationQueue({
  notifications,
  onOpen,
}: {
  notifications: NotificationDto[];
  onOpen: (notification: NotificationDto) => void;
}) {
  return (
    <>
      {groupByDay(notifications).map((day) => (
        <DayGroup key={day.key} day={day} onOpen={onOpen} />
      ))}
    </>
  );
}

export const queueClassName = styles.queue;
export const meterClassName = styles.meter;
