/**
 * Daily — the devotional, the Psalms reading plan, and three small daily pauses.
 *
 * The devotional comes from the Vault (/api/daily): Pastor/staff write days there;
 * any other day uses the Vault's built-in starter set. Verse text comes from the
 * bundled KJV unless staff pasted their own.
 *
 * Reading-plan progress, pauses, and text size are remembered on this device,
 * like Bible highlights and bookmarks.
 */
import { parseReference } from './bibleBooks';
import { loadKjvBookText } from './bibleClient';

export type DailyDay = {
  day: string;
  source: 'church' | 'starter';
  title: string;
  ref: string;
  verseText: string | null;
  body: string;
  question: string | null;
  prayer: string | null;
};

export type DailyWeek = { today: string; monday: string; seriesTitle: string | null; days: DailyDay[] };

/** Today's date on this phone, "YYYY-MM-DD". */
export function localToday(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(y, m - 1, d + n);
  return localToday(t);
}

/** "Sat", "24", "Saturday, October 24" for a "YYYY-MM-DD". */
export function dayParts(day: string): { dow: string; num: string; long: string } {
  const d = new Date(`${day}T12:00:00`);
  return {
    dow: d.toLocaleDateString('en-US', { weekday: 'short' }),
    num: String(d.getDate()),
    long: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
  };
}

const weekCache = new Map<string, Promise<DailyWeek>>();

export function fetchDailyWeek(date: string): Promise<DailyWeek> {
  let p = weekCache.get(date);
  if (!p) {
    p = fetch(`/api/daily?date=${encodeURIComponent(date)}`, { headers: { Accept: 'application/json' } }).then(async (r) => {
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok || !Array.isArray(data.days)) {
        throw new Error(data?.error || 'Today’s devotional is not available right now. Please try again.');
      }
      return data as DailyWeek;
    });
    p.catch(() => weekCache.delete(date));
    weekCache.set(date, p);
  }
  return p;
}

/** Tidy KJV text from the bundled files ("O LORD ," → "O LORD,"). */
export function tidyVerse(text: string): string {
  return String(text || '').replace(/\s+([,;:.!?’”])/g, '$1').replace(/\s+/g, ' ').trim();
}

/** The KJV words for "Lamentations 3:22-23"; null when the reference can't be found. */
export async function kjvTextFor(ref: string): Promise<string | null> {
  const r = parseReference(ref);
  if (!r) return null;
  try {
    const chapters = await loadKjvBookText(r.book.id);
    const verses = chapters[r.chapter - 1];
    if (!Array.isArray(verses) || !verses.length) return null;
    const from = r.verse ?? 1;
    const to = r.verseEnd ?? r.verse ?? verses.length;
    const picked = verses.slice(from - 1, to).filter(Boolean);
    return picked.length ? tidyVerse(picked.join(' ')) : null;
  } catch {
    return null;
  }
}

/** Link that opens the Bible reader at a reference. */
export function bibleLink(ref: string): string {
  return `/bible?q=${encodeURIComponent(ref)}`;
}

/** Split a reflection into paragraphs (blank line between). */
export function paragraphs(body: string): string[] {
  return String(body || '')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
}

/* ---------------- device storage (safe in private mode) ---------------- */

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode or full storage: progress just isn't kept */
  }
}

/* ---------------- text size ---------------- */

export const DAILY_TEXT_SIZES = [17, 19, 22, 25] as const;
const TEXT_KEY = 'awc_daily_text_size';

export function readTextSize(): number {
  const i = readJson<number>(TEXT_KEY, 1);
  return Number.isInteger(i) && i >= 0 && i < DAILY_TEXT_SIZES.length ? i : 1;
}

export function saveTextSize(i: number) {
  writeJson(TEXT_KEY, i);
}

/* ---------------- Psalms in 30 days ---------------- */

export const PLAN_DAYS = 30;
export const PLAN_TITLE = 'Through the Psalms in 30 Days';
const PLAN_KEY = 'awc_daily_psalms_plan_v1';

/** Psalms for plan day n (1–30): five a day, 1–5, 6–10 … 146–150. */
export function psalmsForDay(n: number): number[] {
  const start = (Math.min(Math.max(n, 1), PLAN_DAYS) - 1) * 5 + 1;
  return [start, start + 1, start + 2, start + 3, start + 4];
}

export type PlanState = {
  /** Current plan day, 1–30. */
  day: number;
  /** Psalms finished for the current day. */
  done: number[];
  /** Phone date when the current day was finished (moves on the next calendar day). */
  finishedOn: string | null;
  /** True after day 30 is finished. */
  complete: boolean;
};

const EMPTY_PLAN: PlanState = { day: 1, done: [], finishedOn: null, complete: false };

function sanitizePlan(raw: any): PlanState {
  const day = Number(raw?.day);
  const s: PlanState = {
    day: Number.isInteger(day) && day >= 1 && day <= PLAN_DAYS ? day : 1,
    done: Array.isArray(raw?.done) ? raw.done.filter((n: unknown) => Number.isInteger(n)) : [],
    finishedOn: typeof raw?.finishedOn === 'string' ? raw.finishedOn : null,
    complete: raw?.complete === true,
  };
  const allowed = new Set(psalmsForDay(s.day));
  s.done = [...new Set(s.done)].filter((n) => allowed.has(n));
  return s;
}

/**
 * Plan for today. A day finished on an earlier date moves on to the next day —
 * the plan moves with you, no catching up required.
 */
export function readPlan(today = localToday()): PlanState {
  const s = sanitizePlan(readJson(PLAN_KEY, EMPTY_PLAN));
  if (s.finishedOn && s.finishedOn < today && !s.complete) {
    const next = { day: Math.min(s.day + 1, PLAN_DAYS), done: [], finishedOn: null, complete: false };
    writeJson(PLAN_KEY, next);
    return next;
  }
  return s;
}

export function togglePsalm(psalm: number, today = localToday()): PlanState {
  const s = readPlan(today);
  if (!psalmsForDay(s.day).includes(psalm)) return s;
  const done = new Set(s.done);
  if (done.has(psalm)) done.delete(psalm);
  else done.add(psalm);
  const all = psalmsForDay(s.day).every((p) => done.has(p));
  const next: PlanState = {
    day: s.day,
    done: [...done].sort((a, b) => a - b),
    finishedOn: all ? s.finishedOn || today : null,
    complete: all && s.day === PLAN_DAYS,
  };
  writeJson(PLAN_KEY, next);
  return next;
}

export function restartPlan(): PlanState {
  writeJson(PLAN_KEY, EMPTY_PLAN);
  return { ...EMPTY_PLAN };
}

/** Days finished so far (for the progress bar). */
export function planDaysDone(s: PlanState): number {
  if (s.complete) return PLAN_DAYS;
  return s.day - 1 + (s.finishedOn ? 1 : 0);
}

/** First verse and an estimated reading time for a psalm. */
export async function psalmPreview(psalm: number): Promise<{ firstLine: string; minutes: number } | null> {
  try {
    const chapters = await loadKjvBookText('PSA');
    const verses = chapters[psalm - 1];
    if (!Array.isArray(verses)) return null;
    const words = verses.join(' ').split(/\s+/).length;
    const first = tidyVerse(verses[0] || '');
    const short = first.length > 90 ? `${first.slice(0, 88).replace(/\s+\S*$/, '')}…` : first;
    return { firstLine: short, minutes: Math.max(1, Math.round(words / 180)) };
  } catch {
    return null;
  }
}

/* ---------------- three small pauses ---------------- */

export type Pause = 'morning' | 'midday' | 'evening';
export const PAUSES: Pause[] = ['morning', 'midday', 'evening'];
const PAUSE_KEY = 'awc_daily_pauses_v1';

type PauseLog = Record<string, Pause[]>;

function readPauseLog(): PauseLog {
  const raw = readJson<PauseLog>(PAUSE_KEY, {});
  return raw && typeof raw === 'object' ? raw : {};
}

export function pausesOn(day: string): Pause[] {
  const list = readPauseLog()[day];
  return Array.isArray(list) ? list.filter((p) => PAUSES.includes(p)) : [];
}

export function togglePause(day: string, pause: Pause): Pause[] {
  const log = readPauseLog();
  const set = new Set(pausesOn(day));
  if (set.has(pause)) set.delete(pause);
  else set.add(pause);
  log[day] = PAUSES.filter((p) => set.has(p));
  // Keep about a month on the phone.
  const cutoff = addDays(day, -35);
  for (const k of Object.keys(log)) if (k < cutoff || !log[k].length) delete log[k];
  writeJson(PAUSE_KEY, log);
  return log[day] || [];
}

/** Days this week (Monday → today) with at least one pause. */
export function pauseDaysThisWeek(monday: string, today: string): { withPause: number; daysSoFar: number } {
  const log = readPauseLog();
  let withPause = 0;
  let daysSoFar = 0;
  for (let d = monday; d <= today; d = addDays(d, 1)) {
    daysSoFar += 1;
    if ((log[d] || []).length) withPause += 1;
    if (daysSoFar > 7) break;
  }
  return { withPause, daysSoFar };
}
