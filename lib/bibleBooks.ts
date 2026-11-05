/**
 * Bible books in canon order. `id` is the standard USFM code, which is also
 * what API.Bible uses for chapter ids (e.g. JHN.3), so KJV and NIV share one map.
 */
export type BibleBook = {
  id: string;
  name: string;
  chapters: number;
  testament: 'OT' | 'NT';
};

export const BIBLE_BOOKS: readonly BibleBook[] = [
  { id: 'GEN', name: 'Genesis', chapters: 50, testament: 'OT' },
  { id: 'EXO', name: 'Exodus', chapters: 40, testament: 'OT' },
  { id: 'LEV', name: 'Leviticus', chapters: 27, testament: 'OT' },
  { id: 'NUM', name: 'Numbers', chapters: 36, testament: 'OT' },
  { id: 'DEU', name: 'Deuteronomy', chapters: 34, testament: 'OT' },
  { id: 'JOS', name: 'Joshua', chapters: 24, testament: 'OT' },
  { id: 'JDG', name: 'Judges', chapters: 21, testament: 'OT' },
  { id: 'RUT', name: 'Ruth', chapters: 4, testament: 'OT' },
  { id: '1SA', name: '1 Samuel', chapters: 31, testament: 'OT' },
  { id: '2SA', name: '2 Samuel', chapters: 24, testament: 'OT' },
  { id: '1KI', name: '1 Kings', chapters: 22, testament: 'OT' },
  { id: '2KI', name: '2 Kings', chapters: 25, testament: 'OT' },
  { id: '1CH', name: '1 Chronicles', chapters: 29, testament: 'OT' },
  { id: '2CH', name: '2 Chronicles', chapters: 36, testament: 'OT' },
  { id: 'EZR', name: 'Ezra', chapters: 10, testament: 'OT' },
  { id: 'NEH', name: 'Nehemiah', chapters: 13, testament: 'OT' },
  { id: 'EST', name: 'Esther', chapters: 10, testament: 'OT' },
  { id: 'JOB', name: 'Job', chapters: 42, testament: 'OT' },
  { id: 'PSA', name: 'Psalms', chapters: 150, testament: 'OT' },
  { id: 'PRO', name: 'Proverbs', chapters: 31, testament: 'OT' },
  { id: 'ECC', name: 'Ecclesiastes', chapters: 12, testament: 'OT' },
  { id: 'SNG', name: 'Song of Solomon', chapters: 8, testament: 'OT' },
  { id: 'ISA', name: 'Isaiah', chapters: 66, testament: 'OT' },
  { id: 'JER', name: 'Jeremiah', chapters: 52, testament: 'OT' },
  { id: 'LAM', name: 'Lamentations', chapters: 5, testament: 'OT' },
  { id: 'EZK', name: 'Ezekiel', chapters: 48, testament: 'OT' },
  { id: 'DAN', name: 'Daniel', chapters: 12, testament: 'OT' },
  { id: 'HOS', name: 'Hosea', chapters: 14, testament: 'OT' },
  { id: 'JOL', name: 'Joel', chapters: 3, testament: 'OT' },
  { id: 'AMO', name: 'Amos', chapters: 9, testament: 'OT' },
  { id: 'OBA', name: 'Obadiah', chapters: 1, testament: 'OT' },
  { id: 'JON', name: 'Jonah', chapters: 4, testament: 'OT' },
  { id: 'MIC', name: 'Micah', chapters: 7, testament: 'OT' },
  { id: 'NAM', name: 'Nahum', chapters: 3, testament: 'OT' },
  { id: 'HAB', name: 'Habakkuk', chapters: 3, testament: 'OT' },
  { id: 'ZEP', name: 'Zephaniah', chapters: 3, testament: 'OT' },
  { id: 'HAG', name: 'Haggai', chapters: 2, testament: 'OT' },
  { id: 'ZEC', name: 'Zechariah', chapters: 14, testament: 'OT' },
  { id: 'MAL', name: 'Malachi', chapters: 4, testament: 'OT' },
  { id: 'MAT', name: 'Matthew', chapters: 28, testament: 'NT' },
  { id: 'MRK', name: 'Mark', chapters: 16, testament: 'NT' },
  { id: 'LUK', name: 'Luke', chapters: 24, testament: 'NT' },
  { id: 'JHN', name: 'John', chapters: 21, testament: 'NT' },
  { id: 'ACT', name: 'Acts', chapters: 28, testament: 'NT' },
  { id: 'ROM', name: 'Romans', chapters: 16, testament: 'NT' },
  { id: '1CO', name: '1 Corinthians', chapters: 16, testament: 'NT' },
  { id: '2CO', name: '2 Corinthians', chapters: 13, testament: 'NT' },
  { id: 'GAL', name: 'Galatians', chapters: 6, testament: 'NT' },
  { id: 'EPH', name: 'Ephesians', chapters: 6, testament: 'NT' },
  { id: 'PHP', name: 'Philippians', chapters: 4, testament: 'NT' },
  { id: 'COL', name: 'Colossians', chapters: 4, testament: 'NT' },
  { id: '1TH', name: '1 Thessalonians', chapters: 5, testament: 'NT' },
  { id: '2TH', name: '2 Thessalonians', chapters: 3, testament: 'NT' },
  { id: '1TI', name: '1 Timothy', chapters: 6, testament: 'NT' },
  { id: '2TI', name: '2 Timothy', chapters: 4, testament: 'NT' },
  { id: 'TIT', name: 'Titus', chapters: 3, testament: 'NT' },
  { id: 'PHM', name: 'Philemon', chapters: 1, testament: 'NT' },
  { id: 'HEB', name: 'Hebrews', chapters: 13, testament: 'NT' },
  { id: 'JAS', name: 'James', chapters: 5, testament: 'NT' },
  { id: '1PE', name: '1 Peter', chapters: 5, testament: 'NT' },
  { id: '2PE', name: '2 Peter', chapters: 3, testament: 'NT' },
  { id: '1JN', name: '1 John', chapters: 5, testament: 'NT' },
  { id: '2JN', name: '2 John', chapters: 1, testament: 'NT' },
  { id: '3JN', name: '3 John', chapters: 1, testament: 'NT' },
  { id: 'JUD', name: 'Jude', chapters: 1, testament: 'NT' },
  { id: 'REV', name: 'Revelation', chapters: 22, testament: 'NT' },
];

const BY_ID = new Map(BIBLE_BOOKS.map((b) => [b.id, b]));

export function bookById(id: string | null | undefined): BibleBook | undefined {
  return id ? BY_ID.get(id.toUpperCase()) : undefined;
}

export function bookIndex(id: string): number {
  return BIBLE_BOOKS.findIndex((b) => b.id === id);
}

/** Common short forms people type. Keys are lowercase, no spaces or dots. */
const ALIASES: Record<string, string> = {
  gen: 'GEN', ge: 'GEN', gn: 'GEN',
  ex: 'EXO', exo: 'EXO', exod: 'EXO',
  lev: 'LEV', le: 'LEV', lv: 'LEV',
  num: 'NUM', nu: 'NUM', nm: 'NUM',
  deut: 'DEU', deu: 'DEU', dt: 'DEU',
  josh: 'JOS', jos: 'JOS',
  judg: 'JDG', jdg: 'JDG', jg: 'JDG',
  ru: 'RUT', rut: 'RUT',
  '1sam': '1SA', '1sa': '1SA', '1sm': '1SA', '2sam': '2SA', '2sa': '2SA', '2sm': '2SA',
  '1kgs': '1KI', '1ki': '1KI', '1kings': '1KI', '2kgs': '2KI', '2ki': '2KI', '2kings': '2KI',
  '1chr': '1CH', '1ch': '1CH', '2chr': '2CH', '2ch': '2CH',
  ezr: 'EZR', neh: 'NEH', ne: 'NEH', esth: 'EST', est: 'EST', es: 'EST',
  jb: 'JOB',
  ps: 'PSA', psa: 'PSA', psalm: 'PSA', pss: 'PSA', psm: 'PSA',
  prov: 'PRO', pro: 'PRO', pr: 'PRO', prv: 'PRO',
  eccl: 'ECC', ecc: 'ECC', ec: 'ECC', qoh: 'ECC',
  song: 'SNG', sos: 'SNG', sng: 'SNG', songofsongs: 'SNG', canticles: 'SNG',
  isa: 'ISA', is: 'ISA', jer: 'JER', je: 'JER', lam: 'LAM', la: 'LAM',
  ezek: 'EZK', eze: 'EZK', ezk: 'EZK', dan: 'DAN', da: 'DAN', dn: 'DAN',
  hos: 'HOS', ho: 'HOS', joel: 'JOL', jl: 'JOL', am: 'AMO', amo: 'AMO',
  obad: 'OBA', ob: 'OBA', jon: 'JON', jnh: 'JON', mic: 'MIC', mi: 'MIC',
  nah: 'NAM', na: 'NAM', hab: 'HAB', zeph: 'ZEP', zep: 'ZEP', hag: 'HAG', hg: 'HAG',
  zech: 'ZEC', zec: 'ZEC', zc: 'ZEC', mal: 'MAL', ml: 'MAL',
  matt: 'MAT', mat: 'MAT', mt: 'MAT', mk: 'MRK', mrk: 'MRK', mar: 'MRK', mr: 'MRK',
  lk: 'LUK', luk: 'LUK', lu: 'LUK', jn: 'JHN', jhn: 'JHN', joh: 'JHN',
  ac: 'ACT', act: 'ACT', rom: 'ROM', ro: 'ROM', rm: 'ROM',
  '1cor': '1CO', '1co': '1CO', '2cor': '2CO', '2co': '2CO',
  gal: 'GAL', ga: 'GAL', eph: 'EPH', ephes: 'EPH', phil: 'PHP', php: 'PHP', pp: 'PHP',
  col: 'COL', '1thess': '1TH', '1th': '1TH', '2thess': '2TH', '2th': '2TH',
  '1tim': '1TI', '1ti': '1TI', '2tim': '2TI', '2ti': '2TI', tit: 'TIT', ti: 'TIT',
  philem: 'PHM', phm: 'PHM', phlm: 'PHM', heb: 'HEB', jas: 'JAS', jm: 'JAS',
  '1pet': '1PE', '1pe': '1PE', '1pt': '1PE', '2pet': '2PE', '2pe': '2PE', '2pt': '2PE',
  '1jn': '1JN', '1jo': '1JN', '1john': '1JN', '2jn': '2JN', '2jo': '2JN', '2john': '2JN',
  '3jn': '3JN', '3jo': '3JN', '3john': '3JN', jud: 'JUD', jd: 'JUD',
  rev: 'REV', re: 'REV', rv: 'REV', revelations: 'REV', apocalypse: 'REV',
};

function normalizeBookKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^(first|i)\s+/, '1')
    .replace(/^(second|ii)\s+/, '2')
    .replace(/^(third|iii)\s+/, '3')
    .replace(/[\s.]/g, '');
}

/** Find a book from what someone typed: "John", "jn", "1 Cor", "Song of Solomon". */
export function findBook(raw: string): BibleBook | undefined {
  const key = normalizeBookKey(raw.trim());
  if (!key) return undefined;
  const aliased = ALIASES[key];
  if (aliased) return BY_ID.get(aliased);
  const exact = BIBLE_BOOKS.find((b) => b.name.toLowerCase().replace(/\s/g, '') === key);
  if (exact) return exact;
  if (key.length < 3) return undefined;
  return BIBLE_BOOKS.find((b) => b.name.toLowerCase().replace(/\s/g, '').startsWith(key));
}

export type BibleRef = { book: BibleBook; chapter: number; verse?: number; verseEnd?: number };

/**
 * Parse "John 3:16", "jn 3 16", "1 Cor 13", "Ps 23:1-4", "Jude 3" (single-chapter books
 * treat the number as a verse). Returns null when it can't be understood.
 */
export function parseReference(input: string): BibleRef | null {
  const text = input.trim().replace(/\s+/g, ' ');
  const m = text.match(/^((?:[1-3]|i{1,3}|first|second|third)?\s*[a-z][a-z .]*?)\s*(\d+)?(?:\s*[:. ]\s*(\d+))?(?:\s*[-–]\s*(\d+))?$/i);
  if (!m) return null;
  const book = findBook(m[1]);
  if (!book) return null;
  let chapter = m[2] ? Number(m[2]) : 1;
  let verse = m[3] ? Number(m[3]) : undefined;
  let verseEnd = m[4] ? Number(m[4]) : undefined;
  if (book.chapters === 1 && m[2] && !m[3]) {
    verse = chapter;
    chapter = 1;
  }
  if (chapter < 1 || chapter > book.chapters) return null;
  if (verse !== undefined && verse < 1) return null;
  if (verseEnd !== undefined && verse !== undefined && verseEnd < verse) verseEnd = undefined;
  return { book, chapter, verse, verseEnd };
}

export function formatReference(book: BibleBook, chapter: number, verse?: number, verseEnd?: number): string {
  const base = book.chapters === 1 && verse ? `${book.name} ${verse}` : `${book.name} ${chapter}${verse ? `:${verse}` : ''}`;
  return verseEnd && verseEnd !== verse ? `${base}-${verseEnd}` : base;
}

/** Next/previous chapter across book boundaries; null at Genesis 1 / Revelation 22. */
export function stepChapter(bookId: string, chapter: number, dir: 1 | -1): { bookId: string; chapter: number } | null {
  const i = bookIndex(bookId);
  if (i < 0) return null;
  const book = BIBLE_BOOKS[i];
  const next = chapter + dir;
  if (next >= 1 && next <= book.chapters) return { bookId, chapter: next };
  const nb = BIBLE_BOOKS[i + dir];
  if (!nb) return null;
  return { bookId: nb.id, chapter: dir === 1 ? 1 : nb.chapters };
}
