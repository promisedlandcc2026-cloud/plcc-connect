/**
 * Sunday Mode — pure helpers (no I/O).
 */

import type { ServeMyItem } from './serveUi';
import { isActiveSignupStatus } from './serveUi';
import { localDayBounds } from './memberHomeEvents';

/** Local calendar Sunday (browser timezone). */
export function isLocalSunday(now: Date = new Date()): boolean {
  return now.getDay() === 0;
}

export function formatSundayDateLabel(now: Date = new Date()): string {
  return now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function sundayGreeting(name: string | null | undefined, now: Date = new Date()): string {
  const hour = now.getHours();
  const first = String(name || '')
    .trim()
    .split(/\s+/)[0];
  const part =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  if (first) return `${part}, ${first}`;
  return part;
}

/**
 * Active Serve commitments whose opportunity starts on the local calendar day.
 * Uses API dates only — cancelled/declined excluded via isActiveSignupStatus.
 */
export function filterServingToday(items: ServeMyItem[], now: Date = new Date()): ServeMyItem[] {
  const { start, end } = localDayBounds(now);
  const startMs = start.getTime();
  const endMs = end.getTime();

  return (items || []).filter((item) => {
    if (!isActiveSignupStatus(item.status)) return false;
    const raw = item.opportunity?.startsAt;
    if (!raw) return false;
    const ms = Date.parse(raw);
    if (!Number.isFinite(ms)) return false;
    return ms >= startMs && ms <= endMs;
  });
}

/** Cap announcements for Sunday Mode (MVP: 3). */
export function limitSundayAnnouncements<T>(items: T[], limit = 3): T[] {
  return (items || []).slice(0, Math.max(0, limit));
}
