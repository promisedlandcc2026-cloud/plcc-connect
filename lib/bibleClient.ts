import { SITE_ORIGIN } from './verseShare';
import { bookById } from './bibleBooks';

/**
 * A Bible id. "kjv" is the bundled King James Version (works offline, powers
 * search); every other id is one of the church Bibles served by the PLCC
 * website (the same list as the website's /bible and Ka Link): NIV and NKJV
 * (YouVersion), Bayibuli Entukuvu (Luganda), Kiswahili and the rest.
 */
export type BibleTranslation = string;

export type TranslationInfo = {
  id: string;
  shortName: string;
  name: string;
  language: string;
  languageLabel: string;
  licenseNotice: string | null;
};

export const KJV_INFO: TranslationInfo = {
  id: 'kjv',
  shortName: 'KJV',
  name: 'King James Version',
  language: 'eng',
  languageLabel: 'English',
  licenseNotice: null,
};

/** The Bibles shown as quick buttons on the Bible home, when available. */
export const FEATURED_TRANSLATIONS = ['kjv', 'yv_niv', 'yv_nkjv'];

const registry = new Map<string, TranslationInfo>([['kjv', KJV_INFO]]);

export function translationInfo(id: string): TranslationInfo | undefined {
  return registry.get(id);
}

/** "KJV", "NIV", "LCB"… */
export function translationLabel(id: string): string {
  return registry.get(id)?.shortName ?? (id === 'yv_niv' ? 'NIV' : id === 'yv_nkjv' ? 'NKJV' : id.toUpperCase());
}

export function translationName(id: string): string {
  return registry.get(id)?.name ?? translationLabel(id);
}

type SiteTranslation = {
  id: string;
  name: string;
  englishName: string;
  shortName: string;
  language: string;
  languageLabel: string;
  licenseNotice: string | null;
};

export type TranslationList = { list: TranslationInfo[]; luganda: string | null };

let translationsPending: Promise<TranslationList> | null = null;

/** Every Bible the church offers (KJV first). Falls back to KJV alone when offline. */
export function loadTranslations(): Promise<TranslationList> {
  if (!translationsPending) {
    translationsPending = fetch(`${SITE_ORIGIN}/api/bible/translations`, { headers: { Accept: 'application/json' } })
      .then(async (r) => {
        const body = (await r.json().catch(() => null)) as { ok?: boolean; translations?: SiteTranslation[]; defaults?: { luganda?: string | null } } | null;
        if (!r.ok || !body?.ok || !Array.isArray(body.translations)) throw new Error('unavailable');
        const list: TranslationInfo[] = [KJV_INFO];
        for (const t of body.translations) {
          // The website's own KJV is the same text we bundle; keep one.
          const isKjv = t.language === 'eng' && !t.id.startsWith('yv_') && (/(^|_)kjv$/i.test(t.id) || /king james/i.test(t.englishName || ''));
          if (isKjv) continue;
          const info: TranslationInfo = {
            id: t.id,
            shortName: t.shortName || t.id,
            name: t.englishName && t.englishName !== t.name ? `${t.name} (${t.englishName})` : t.name,
            language: t.language,
            languageLabel: t.languageLabel || t.language,
            licenseNotice: t.licenseNotice ?? null,
          };
          registry.set(info.id, info);
          list.push(info);
        }
        return { list, luganda: body.defaults?.luganda ?? null };
      })
      .catch(() => {
        translationsPending = null; // try again next time
        return { list: [KJV_INFO], luganda: null };
      });
  }
  return translationsPending;
}

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

/* ---------------- Church Bibles: served by the PLCC website (/api/bible/chapter) ---------------- */

const siteCache = new Map<string, Promise<BibleChapter>>();

function loadSiteChapter(translation: string, bookId: string, chapter: number): Promise<BibleChapter> {
  const key = `${translation}:${bookId}.${chapter}`;
  let p = siteCache.get(key);
  if (!p) {
    p = (async () => {
      let r: Response;
      try {
        r = await fetch(
          `${SITE_ORIGIN}/api/bible/chapter?t=${encodeURIComponent(translation)}&b=${bookId}&c=${chapter}`,
          { headers: { Accept: 'application/json' } },
        );
      } catch {
        throw new BibleError(UNAVAILABLE);
      }
      const body = (await r.json().catch(() => null)) as { ok?: boolean; error?: string; verses?: Record<string, string> } | null;
      if (r.status === 404 && body?.error === 'missing_book') throw new BibleError('This book isn’t in this Bible yet.', 'not_found');
      if (!r.ok || !body?.ok || !body.verses) throw new BibleError(UNAVAILABLE);
      const verses = Object.entries(body.verses)
        .map(([n, text]) => ({ n: Number(n), text: String(text) }))
        .filter((v) => Number.isInteger(v.n) && v.n > 0 && v.text)
        .sort((x, y) => x.n - y.n);
      if (!verses.length) throw new BibleError(UNAVAILABLE);
      return { translation, bookId, chapter, verses, copyright: registry.get(translation)?.licenseNotice ?? undefined };
    })();
    p.catch(() => siteCache.delete(key));
    siteCache.set(key, p);
  }
  return p;
}

/* ---------------- Public API ---------------- */

export async function loadChapter(translation: BibleTranslation, bookId: string, chapter: number): Promise<BibleChapter> {
  const book = bookById(bookId);
  if (!book || chapter < 1 || chapter > book.chapters) throw new BibleError('That chapter wasn’t found.', 'not_found');
  return translation === 'kjv' ? loadKjvChapter(book.id, chapter) : loadSiteChapter(translation, book.id, chapter);
}

/* ---------------- Reading place + text size, remembered on this device ---------------- */

export type BiblePrefs = {
  translation: BibleTranslation;
  bookId: string;
  chapter: number;
  textSize: number;
  /** A second Bible shown under each verse (e.g. Luganda under English), like the website. */
  under: BibleTranslation | null;
};

const PREFS_KEY = 'awc.bible.v1';
export const TEXT_SIZES = [16, 18, 20, 23, 26] as const;
const DEFAULT_PREFS: BiblePrefs = { translation: 'kjv', bookId: 'JHN', chapter: 1, textSize: 1, under: null };
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
/** Older saves used 'niv' for the API.Bible NIV; that is YouVersion's NIV now. */
const normalizeId = (v: unknown): string | null => (v === 'niv' ? 'yv_niv' : typeof v === 'string' && ID_RE.test(v) ? v : null);

export function readBiblePrefs(): BiblePrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw) as Partial<BiblePrefs>;
    const book = bookById(p.bookId);
    const chapter = Number(p.chapter);
    return {
      translation: normalizeId(p.translation) ?? 'kjv',
      under: normalizeId(p.under),
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
