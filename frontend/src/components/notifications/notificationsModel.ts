import type { NotificationDto } from '@/types/tournament';

/**
 * Pure reading for the notification queue. Unread first, because the question
 * is "what have I not dealt with", then newest first inside each state, then
 * grouped by the day they arrived so a long history stays scannable.
 */

export function isUnread(notification: NotificationDto) {
  return notification.readAt === null;
}

/** The local calendar day a notification belongs to, as a sortable key. */
export function dayKey(iso: string) {
  const date = new Date(iso);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export type NotificationDay = {
  key: string;
  /** The first notification of the day, for formatting the heading in the reader's locale. */
  date: string;
  items: NotificationDto[];
  unread: number;
};

function byNewest(left: NotificationDto, right: NotificationDto) {
  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
}

/**
 * Unread rows are lifted out of the timeline entirely rather than merely tinted
 * where they sit: something from three days ago that still needs the reader is
 * more urgent than this morning's notice that does not.
 */
export function sortForQueue(notifications: NotificationDto[]) {
  const unread = notifications.filter(isUnread).sort(byNewest);
  const read = notifications.filter((notification) => !isUnread(notification)).sort(byNewest);
  return { unread, read };
}

/** Groups a already-ordered list into calendar days, keeping the given order. */
export function groupByDay(notifications: NotificationDto[]): NotificationDay[] {
  const days = new Map<string, NotificationDay>();
  for (const notification of notifications) {
    const key = dayKey(notification.createdAt);
    const existing = days.get(key);
    if (existing) {
      existing.items.push(notification);
      if (isUnread(notification)) existing.unread += 1;
    } else {
      days.set(key, {
        key,
        date: notification.createdAt,
        items: [notification],
        unread: isUnread(notification) ? 1 : 0,
      });
    }
  }
  return [...days.values()];
}

export type NotificationProgress = {
  read: number;
  total: number;
};

/**
 * How much of the queue is dealt with. `0 of 0` is a real, honest reading for an
 * empty inbox, but the caller hides the meter in that case rather than showing
 * a full bar for nothing.
 */
export function readProgress(notifications: NotificationDto[]): NotificationProgress {
  return {
    read: notifications.filter((notification) => !isUnread(notification)).length,
    total: notifications.length,
  };
}
