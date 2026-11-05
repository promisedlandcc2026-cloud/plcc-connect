import type { ChurchEvent } from '../types';

/** Local calendar day bounds (browser timezone). */
export function localDayBounds(now: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function eventStartMs(event: ChurchEvent): number {
  const raw = event.starts_at || event.date;
  if (!raw) return Number.NaN;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : Number.NaN;
}

/** Events whose start falls on the local calendar day. */
export function filterEventsToday(events: ChurchEvent[], now: Date = new Date()): ChurchEvent[] {
  const { start, end } = localDayBounds(now);
  const startMs = start.getTime();
  const endMs = end.getTime();
  return events
    .filter((e) => {
      const ms = eventStartMs(e);
      return Number.isFinite(ms) && ms >= startMs && ms <= endMs;
    })
    .sort((a, b) => eventStartMs(a) - eventStartMs(b));
}

/**
 * Future events after "now", excluding those already shown as today if desired.
 * Default: starts strictly after now.
 */
export function filterUpcomingEvents(
  events: ChurchEvent[],
  opts?: { now?: Date; limit?: number; excludeIds?: Set<string> }
): ChurchEvent[] {
  const now = opts?.now ?? new Date();
  const limit = opts?.limit ?? 3;
  const exclude = opts?.excludeIds;
  const nowMs = now.getTime();

  return events
    .filter((e) => {
      if (exclude?.has(e.id)) return false;
      const ms = eventStartMs(e);
      return Number.isFinite(ms) && ms > nowMs;
    })
    .sort((a, b) => eventStartMs(a) - eventStartMs(b))
    .slice(0, limit);
}

export function formatEventTime(startsAt: string | undefined, fallbackTime?: string): string {
  if (fallbackTime && !startsAt) return fallbackTime;
  if (!startsAt) return fallbackTime || '';
  const d = new Date(startsAt);
  if (!Number.isFinite(d.getTime())) return fallbackTime || '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function formatEventDateShort(startsAt: string | undefined, fallbackDate?: string): string {
  if (!startsAt) return fallbackDate || '';
  const d = new Date(startsAt);
  if (!Number.isFinite(d.getTime())) return fallbackDate || '';
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function truncateText(text: string, max = 140): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}
