/**
 * Highlights, bookmarks and recently read chapters — kept on this device for now.
 * Keys are translation-independent verse refs ("JHN.3.16"), so a highlight shows in
 * both KJV and NIV. Everything goes through this module, so moving it to the member's
 * account later only touches this file.
 */
import { bookById } from './bibleBooks';

export const HIGHLIGHT_COLORS = ['gold', 'rose', 'blue', 'green'] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

/** Background tints; each also differs in lightness so they read apart without color. */
export const HIGHLIGHT_BG: Record<HighlightColor, string> = {
  gold: '#E8D8B2',
  rose: '#F3C6CF',
  blue: '#BFD8F2',
  green: '#C9E7CF',
};
export const HIGHLIGHT_LABEL: Record<HighlightColor, string> = {
  gold: 'Gold',
  rose: 'Rose',
  blue: 'Blue',
  green: 'Green',
};

type Marks = {
  highlights: Record<string, { color: HighlightColor; at: number }>;
  bookmarks: Record<string, { at: number }>;
};

const MARKS_KEY = 'awc.bible.marks.v1';
const RECENT_KEY = 'awc.bible.recent.v1';
const MAX_MARKS = 2000;
const MAX_RECENT = 8;
const REF_RE = /^(?:[1-3][A-Z]{2}|[A-Z]{3})\.\d{1,3}\.\d{1,3}$/;

export const verseKey = (bookId: string, chapter: number, verse: number) => `${bookId}.${chapter}.${verse}`;

export function parseVerseKey(key: string): { bookId: string; chapter: number; verse: number } | null {
  if (!REF_RE.test(key)) return null;
  const [bookId, c, v] = key.split('.');
  const book = bookById(bookId);
  const chapter = Number(c);
  const verse = Number(v);
  if (!book || chapter < 1 || chapter > book.chapters || verse < 1) return null;
  return { bookId: book.id, chapter, verse };
}

const listeners = new Set<() => void>();
export function onMarksChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function readMarks(): Marks {
  try {
    const raw = JSON.parse(localStorage.getItem(MARKS_KEY) || '{}') as Partial<Marks>;
    const highlights: Marks['highlights'] = {};
    const bookmarks: Marks['bookmarks'] = {};
    for (const [k, v] of Object.entries(raw.highlights || {})) {
      if (REF_RE.test(k) && v && (HIGHLIGHT_COLORS as readonly string[]).includes(v.color)) highlights[k] = { color: v.color, at: Number(v.at) || 0 };
    }
    for (const [k, v] of Object.entries(raw.bookmarks || {})) {
      if (REF_RE.test(k)) bookmarks[k] = { at: Number(v?.at) || 0 };
    }
    return { highlights, bookmarks };
  } catch {
    return { highlights: {}, bookmarks: {} };
  }
}

function writeMarks(m: Marks) {
  const trim = <T extends { at: number }>(rec: Record<string, T>) =>
    Object.fromEntries(Object.entries(rec).sort((a, b) => b[1].at - a[1].at).slice(0, MAX_MARKS));
  try {
    localStorage.setItem(MARKS_KEY, JSON.stringify({ highlights: trim(m.highlights), bookmarks: trim(m.bookmarks) }));
  } catch {
    /* storage full or private mode */
  }
  listeners.forEach((fn) => fn());
}

export function getMarks(): Marks {
  return readMarks();
}

export function setHighlight(keys: string[], color: HighlightColor | null): void {
  const m = readMarks();
  const at = Date.now();
  for (const k of keys) {
    if (!REF_RE.test(k)) continue;
    if (color) m.highlights[k] = { color, at };
    else delete m.highlights[k];
  }
  writeMarks(m);
}

/** Bookmarks all of `keys` unless every one is already bookmarked, in which case removes them. Returns the new state. */
export function toggleBookmarks(keys: string[]): boolean {
  const m = readMarks();
  const valid = keys.filter((k) => REF_RE.test(k));
  const allOn = valid.length > 0 && valid.every((k) => m.bookmarks[k]);
  const at = Date.now();
  for (const k of valid) {
    if (allOn) delete m.bookmarks[k];
    else m.bookmarks[k] = { at };
  }
  writeMarks(m);
  return !allOn;
}

export type MarkEntry = { key: string; bookId: string; chapter: number; verse: number; at: number; color?: HighlightColor };

export function listHighlights(): MarkEntry[] {
  return Object.entries(readMarks().highlights)
    .map(([key, v]) => ({ key, ...parseVerseKey(key)!, at: v.at, color: v.color }))
    .filter((e) => e.bookId)
    .sort((a, b) => b.at - a.at);
}

export function listBookmarks(): MarkEntry[] {
  return Object.entries(readMarks().bookmarks)
    .map(([key, v]) => ({ key, ...parseVerseKey(key)!, at: v.at }))
    .filter((e) => e.bookId)
    .sort((a, b) => b.at - a.at);
}

/* ---------------- Recently read chapters ---------------- */

export type RecentChapter = { bookId: string; chapter: number };

export function readRecent(): RecentChapter[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((r) => ({ bookId: String((r as RecentChapter)?.bookId || ''), chapter: Number((r as RecentChapter)?.chapter) }))
      .filter((r) => {
        const b = bookById(r.bookId);
        return b && r.chapter >= 1 && r.chapter <= b.chapters;
      })
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function pushRecent(bookId: string, chapter: number): void {
  const next = [{ bookId, chapter }, ...readRecent().filter((r) => !(r.bookId === bookId && r.chapter === chapter))].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* fine */
  }
}
