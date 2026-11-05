/**
 * Next worship service — from the calendar when Vault has one, otherwise the
 * regular Sunday service from CHURCH_INFO. Replaces the hardcoded
 * "Sun @ 10:30 AM" in Watch so the two can't drift apart.
 */
import type { ChurchEvent } from '../types';
import { CHURCH_INFO } from '../data';
import { eventStartMs } from './memberHomeEvents';

const SERVICE_RE = /worship|service|celebration/i;
/** A service is "on" until 2 hours after it starts. */
const SERVICE_LENGTH_MS = 2 * 60 * 60 * 1000;

export function isServiceEvent(e: ChurchEvent): boolean {
  return SERVICE_RE.test(e.title || '') || SERVICE_RE.test(e.type || '');
}

/** Parse "10:30 AM – 12:30 PM" → { h: 10, m: 30 } (start time). */
export function parseStartTime(label: string): { h: number; m: number } | null {
  const match = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(label || '');
  if (!match) return null;
  let h = Number(match[1]) % 12;
  if (match[3].toUpperCase() === 'PM') h += 12;
  return { h, m: Number(match[2]) };
}

/** Next regular Sunday service (local time) that hasn't finished yet. */
export function nextScheduledSunday(now: Date = new Date()): Date {
  const start = parseStartTime(CHURCH_INFO.schedule[0]?.time || '') || { h: 10, m: 30 };
  const d = new Date(now);
  d.setHours(start.h, start.m, 0, 0);
  const daysAhead = (7 - d.getDay()) % 7;
  d.setDate(d.getDate() + daysAhead);
  if (d.getTime() + SERVICE_LENGTH_MS <= now.getTime()) d.setDate(d.getDate() + 7);
  return d;
}

export type NextService = { title: string; startsAt: Date; fromCalendar: boolean };

export function pickNextService(events: ChurchEvent[], now: Date = new Date()): NextService {
  const nowMs = now.getTime();
  const fromCalendar = events
    .filter(isServiceEvent)
    .filter((e) => {
      const ms = eventStartMs(e);
      return Number.isFinite(ms) && ms + SERVICE_LENGTH_MS > nowMs;
    })
    .sort((a, b) => eventStartMs(a) - eventStartMs(b))[0];
  const scheduled = nextScheduledSunday(now);
  if (fromCalendar && eventStartMs(fromCalendar) <= scheduled.getTime()) {
    return { title: fromCalendar.title, startsAt: new Date(eventStartMs(fromCalendar)), fromCalendar: true };
  }
  return { title: CHURCH_INFO.schedule[0]?.event || 'Sunday service', startsAt: scheduled, fromCalendar: false };
}

/** "Today · 10:30 AM", "Tomorrow · 7:30 PM", "Sun, Oct 18 · 10:30 AM". */
export function formatServiceWhen(startsAt: Date, now: Date = new Date()): string {
  const time = startsAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const day0 = new Date(now);
  day0.setHours(0, 0, 0, 0);
  const target = new Date(startsAt);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - day0.getTime()) / 86_400_000);
  if (diffDays === 0) return `Today · ${time}`;
  if (diffDays === 1) return `Tomorrow · ${time}`;
  const date = startsAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return `${date} · ${time}`;
}
