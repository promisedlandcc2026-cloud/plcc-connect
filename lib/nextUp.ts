/**
 * Member Home "Next up": the gathering happening now (started < 2h ago) or the
 * next one on the calendar. Falls back to the regular Sunday service.
 */
import type { ChurchEvent } from '../types';
import { CHURCH_INFO } from '../data';
import { eventStartMs } from './memberHomeEvents';
import { formatServiceWhen, nextScheduledSunday } from './nextService';

export const HAPPENING_NOW_WINDOW_MS = 2 * 60 * 60 * 1000;

export type NextUp =
  | { kind: 'event'; event: ChurchEvent; happeningNow: boolean }
  | { kind: 'fallback'; title: string; when: string };

export function pickNextUp(events: ChurchEvent[], now: Date = new Date()): NextUp {
  const nowMs = now.getTime();
  const next = events
    .filter((e) => {
      const ms = eventStartMs(e);
      return Number.isFinite(ms) && ms > nowMs - HAPPENING_NOW_WINDOW_MS;
    })
    .sort((a, b) => eventStartMs(a) - eventStartMs(b))[0];
  if (next) {
    return { kind: 'event', event: next, happeningNow: eventStartMs(next) <= nowMs };
  }
  const sunday = CHURCH_INFO.schedule[0];
  return { kind: 'fallback', title: sunday.event, when: formatServiceWhen(nextScheduledSunday(now), now) };
}

export function directionsUrl(address: string = CHURCH_INFO.address): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}
