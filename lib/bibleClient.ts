import { isSupabaseConfigured, supabase } from './supabase';
import { bookById } from './bibleBooks';

export type BibleTranslation = 'kjv' | 'niv';

export const TRANSLATION_LABEL: Record<BibleTranslation, string> = {
  kjv: 'KJV',
  niv: 'NIV',
};

export type BibleVerse = { n: number; text: string };

export type BibleChapter = {
  translation: BibleTranslation;
  bookId: string;
  chapter: number;
  verses: BibleVerse[];
  /** Shown under the text when the publisher requires it (NIV). */
  copyright?: string;
};

export class BibleError extends Error {
  constructor(message: string, public code = 'unavailable') {
    super(message);
  }
}

const UNAVAILABLE = 'We couldn’t load this chapter. Check your connection and try again.';

/* ---------------- KJV: public domain, bundled as /bible/kjv/<BOOK>.json ---------------- */

const kjvBooks = new Map<string, Promise<string[][]>>();

function loadKjvBook(bookId: string): Promise<string[][]> {
  let p = kjvBooks.get(bookId);
  if (!p) {
    p = fetch(`/bible/kjv/${bookId}.json`, { headers: { Accept: 'application/json' } }).then(async (r) => {
      if (!r.ok) throw new BibleError(UNAVAILABLE);
      const data = (await r.json()) as unknown;
      if (!Array.isArray(data)) throw new BibleError(UNAVAILABLE);
      return data as string[][];
    });
    // Let a failed load (e.g. offline) try again next time.
    p.catch(() => kjvBooks.delete(bookId));
    kjvBooks.set(bookId, p);
  }
  return p;
}

/** Every chapter of a KJV book as arrays of verse text (search, previews). Cached per book. */
export function loadKjvBookText(bookId: string): Promise<string[][]> {
  return loadKjvBook(bookId);
}

async function loadKjvChapter(bookId: string, chapter: number): Promise<BibleChapter> {
  const chapters = await loadKjvBook(bookId);
  const verses = chapters[chapter - 1];
  if (!Array.isArray(verses)) throw new BibleError('That chapter wasn’t found.', 'not_found');
  return {
    translation: 'kjv',
    bookId,
    chapter,
    verses: verses.map((text, i) => ({ n: i + 1, text })),
  };
}

/* ---------------- NIV: licensed, served through /api/bible (API.Bible) ---------------- */

async function authHeaders(): Promise<Record<string, string>> {
  if (!isSupabaseConfigured) throw new BibleError('Please sign in again to continue.', 'unauthorized');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token || token.split('.').length !== 3) throw new BibleError('Please sign in again to continue.', 'unauthorized');
  return { Accept: 'application/json', Authorization: `Bearer ${token}` };
}

let nivStatus: Promise<boolean> | null = null;

/** True once the church has set up its NIV access (API key on the server). */
export function isNivAvailable(): Promise<boolean> {
  if (!nivStatus) {
    nivStatus = fetch('/api/bible?status=1', { headers: { Accept: 'application/json' } })
      .then(async (r) => {
        if (!r.ok) return false;
        const body = (await r.json()) as { ok?: boolean; niv?: boolean };
        return body.ok === true && body.niv === true;
      })
      .catch(() => false);
    nivStatus.then((ok) => {
      if (!ok) nivStatus = null; // re-check on a later visit
    });
  }
  return nivStatus;
}

type NivResponse = {
  ok?: boolean;
  message?: string;
  code?: string;
  verses?: BibleVerse[];
  copyright?: string;
  fumsToken?: string;
};

const nivCache = new Map<string, BibleChapter>();

async function loadNivChapter(bookId: string, chapter: number): Promise<BibleChapter> {
  const key = `${bookId}.${chapter}`;
  const cached = nivCache.get(key);
  if (cached) return cached;
  let r: Response;
  try {
    r = await fetch(`/api/bible?t=niv&chapter=${encodeURIComponent(key)}`, { headers: await authHeaders() });
  } catch (err) {
    if (err instanceof BibleError) throw err;
    throw new BibleError(UNAVAILABLE);
  }
  const body = (await r.json().catch(() => ({}))) as NivResponse;
  if (!r.ok || body.ok !== true || !Array.isArray(body.verses)) {
    throw new BibleError(body.message || UNAVAILABLE, body.code || 'unavailable');
  }
  if (body.fumsToken) trackFums(body.fumsToken);
  const result: BibleChapter = { translation: 'niv', bookId, chapter, verses: body.verses, copyright: body.copyright };
  nivCache.set(key, result);
  return result;
}

/* API.Bible requires its usage tracker (FUMS) on web apps that show licensed text. */
type FumsWindow = Window & { fumsData?: unknown[]; fums?: (...args: unknown[]) => void };
let fumsLoaded = false;

function trackFums(token: string): void {
  if (typeof window === 'undefined') return;
  const w = window as FumsWindow;
  if (!fumsLoaded) {
    fumsLoaded = true;
    w.fumsData = w.fumsData || [];
    w.fums =
      w.fums ||
      function (...args: unknown[]) {
        w.fumsData!.push(args);
      };
    const s = document.createElement('script');
    s.src = 'https://pkg.api.bible/fumsV3.min.js';
    s.async = true;
    document.body.appendChild(s);
  }
  try {
    w.fums?.('trackView', token);
  } catch {
    /* tracking must never break reading */
  }
}

/* ---------------- Public API ---------------- */

export async function loadChapter(translation: BibleTranslation, bookId: string, chapter: number): Promise<BibleChapter> {
  const book = bookById(bookId);
  if (!book || chapter < 1 || chapter > book.chapters) throw new BibleError('That chapter wasn’t found.', 'not_found');
  return translation === 'niv' ? loadNivChapter(book.id, chapter) : loadKjvChapter(book.id, chapter);
}

/* ---------------- Reading place + text size, remembered on this device ---------------- */

export type BiblePrefs = { translation: BibleTranslation; bookId: string; chapter: number; textSize: number };

const PREFS_KEY = 'awc.bible.v1';
export const TEXT_SIZES = [16, 18, 20, 23, 26] as const;
const DEFAULT_PREFS: BiblePrefs = { translation: 'kjv', bookId: 'JHN', chapter: 1, textSize: 1 };

export function readBiblePrefs(): BiblePrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw) as Partial<BiblePrefs>;
    const book = bookById(p.bookId);
    const chapter = Number(p.chapter);
    return {
      translation: p.translation === 'niv' ? 'niv' : 'kjv',
      bookId: book ? book.id : DEFAULT_PREFS.bookId,
      chapter: book && chapter >= 1 && chapter <= book.chapters ? chapter : 1,
      textSize: Number.isInteger(p.textSize) && p.textSize! >= 0 && p.textSize! < TEXT_SIZES.length ? p.textSize! : DEFAULT_PREFS.textSize,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function saveBiblePrefs(prefs: BiblePrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode — fine */
  }
}
