/**
 * Sanctuary redesign — pure helpers (no I/O) for the Home ticket, Sunday live
 * view, season chip and order of service. Kept framework-free so node:test can
 * bundle and exercise them directly.
 */
import type { NextUp } from './nextUp';
import { eventStartMs } from './memberHomeEvents';
import { nextScheduledSunday } from './nextService';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** The ring fills over the last week before a gathering. */
export const COUNTDOWN_WINDOW_MS = 7 * DAY;
/** Sunday Home switches to live a little before the service starts. */
export const LIVE_LEAD_MS = 15 * MINUTE;
/** …and stays live for the length of the service. */
export const LIVE_LENGTH_MS = 2 * HOUR;

export type Countdown = {
  /** Big line inside the ring: "2d", "5h", "42m", "Now". */
  big: string;
  /** Small line under it: "22 hrs", "12 min", "starting", "". */
  small: string;
  /** Screen-reader sentence. */
  spoken: string;
  /** 0…1 — how much of the ring is filled. */
  fraction: number;
  started: boolean;
};

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function countdownTo(target: Date, now: Date = new Date()): Countdown {
  const ms = target.getTime() - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) {
    return { big: 'Now', small: '', spoken: 'Happening now', fraction: 1, started: true };
  }
  const fraction = Math.min(1, Math.max(0.04, 1 - ms / COUNTDOWN_WINDOW_MS));
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / HOUR);
  const minutes = Math.max(1, Math.floor((ms % HOUR) / MINUTE));
  if (days >= 1) {
    return {
      big: `${days}d`,
      small: hours ? `${hours} hr${hours === 1 ? '' : 's'}` : '',
      spoken: `${plural(days, 'day')}${hours ? ` and ${plural(hours, 'hour')}` : ''} to go`,
      fraction,
      started: false,
    };
  }
  if (hours >= 1) {
    return {
      big: `${hours}h`,
      small: `${minutes} min`,
      spoken: `${plural(hours, 'hour')} and ${plural(minutes, 'minute')} to go`,
      fraction,
      started: false,
    };
  }
  return {
    big: `${minutes}m`,
    small: 'starting',
    spoken: `${plural(minutes, 'minute')} to go`,
    fraction,
    started: false,
  };
}

/** Start time of whatever the ticket shows. */
export function nextUpStartsAt(next: NextUp, now: Date = new Date()): Date {
  if (next.kind === 'event') {
    const ms = eventStartMs(next.event);
    if (Number.isFinite(ms)) return new Date(ms);
  }
  return nextScheduledSunday(now);
}

/** "YYYY-MM-DD" in the browser's local calendar. */
export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Stable key for an "I'll be there" plan (matches the attendance_plans check):
 * `event:<uuid>` for a calendar event, otherwise `sunday:YYYY-MM-DD`.
 */
export function planKeyFor(next: NextUp, now: Date = new Date()): string {
  if (next.kind === 'event' && UUID_RE.test(String(next.event.id || ''))) {
    return `event:${String(next.event.id).toLowerCase()}`;
  }
  return `sunday:${localDateKey(nextUpStartsAt(next, now))}`;
}

/**
 * Sunday Home turns into the in-service view when the stream is live, or on
 * Sunday from 15 minutes before the service until it ends.
 */
export function isSundayLive(opts: {
  now?: Date;
  serviceStartsAt: Date | null;
  streamLive: boolean;
}): boolean {
  if (opts.streamLive) return true;
  const now = opts.now ?? new Date();
  if (now.getDay() !== 0 || !opts.serviceStartsAt) return false;
  const start = opts.serviceStartsAt.getTime();
  const t = now.getTime();
  return t >= start - LIVE_LEAD_MS && t < start + LIVE_LENGTH_MS;
}

/** Whole days from `now` to a YYYY-MM-DD church date (0 on the day). */
export function daysUntilDate(dateKey: string, now: Date = new Date()): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return 0;
  const target = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((target.getTime() - today.getTime()) / DAY));
}

const SEASON_LABEL: Record<string, string> = {
  fall: 'Fall',
  winter: 'Winter',
  spring: 'Spring',
  summer: 'Summer',
};

/** "Fall at PLCC · Thanksgiving Dinner in 38 days" (holiday part optional). */
export function seasonChipLabel(opts: {
  season: string;
  holidayTitle?: string | null;
  holidayDate?: string | null;
  now?: Date;
}): string {
  const season = SEASON_LABEL[opts.season] || 'Season';
  const base = `${season} at PLCC`;
  if (!opts.holidayTitle || !opts.holidayDate) return base;
  const days = daysUntilDate(opts.holidayDate, opts.now);
  const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
  return `${base} · ${opts.holidayTitle} ${when}`;
}

// —— Order of service ———————————————————————————————————————————————

export type ServiceStep = {
  id: string;
  title: string;
  /** "10:30 AM" when the run of show has a time; null for the typical order. */
  timeLabel: string | null;
  startsAt: Date | null;
};

/** Parse "10:30 AM", "10:30", "14:05" on the service day. */
export function parseStepTime(label: string | null | undefined, day: Date): Date | null {
  const raw = String(label || '').trim();
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i.exec(raw);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (m[3]) {
    h = h % 12;
    if (m[3].toUpperCase() === 'PM') h += 12;
  }
  if (h > 23 || min > 59) return null;
  const d = new Date(day);
  d.setHours(h, min, 0, 0);
  return d;
}

export function formatStepTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/**
 * Turn Vault run-of-show rows into timed steps. Rows without a time get one
 * from the previous row's start + duration, so a run of show that only times
 * the first item still lines up.
 */
export function buildServiceSteps(
  rows: Array<{ id: string; title: string; start_time?: string | null; duration_minutes?: number | null }>,
  serviceStart: Date
): ServiceStep[] {
  let cursor: Date | null = serviceStart;
  return rows
    .filter((r) => r && String(r.title || '').trim())
    .map((r) => {
      const explicit = parseStepTime(r.start_time ?? null, serviceStart);
      const startsAt = explicit ?? cursor;
      const minutes = Number(r.duration_minutes) || 0;
      cursor = startsAt && minutes > 0 ? new Date(startsAt.getTime() + minutes * MINUTE) : null;
      return {
        id: String(r.id),
        title: String(r.title).trim().slice(0, 120),
        timeLabel: startsAt ? formatStepTime(startsAt) : null,
        startsAt,
      };
    });
}

/** Index of the step happening now, or -1 when there are no times yet. */
export function currentStepIndex(steps: ServiceStep[], now: Date = new Date()): number {
  const t = now.getTime();
  let idx = -1;
  steps.forEach((s, i) => {
    if (s.startsAt && s.startsAt.getTime() <= t) idx = i;
  });
  return idx;
}

/** The usual Sunday flow, shown (without times) when Vault has no run of show. */
export const TYPICAL_SUNDAY_ORDER = [
  'Opening prayer & worship',
  'Welcome & announcements',
  'Tithes & offerings',
  'The Spoken Word',
  'Altar call & benediction',
];
