import React, { useEffect, useRef, useState } from 'react';
import { Bookmark, BookOpenText, Highlighter, Search, Share2, X } from 'lucide-react';
import { MemberPageHeader } from '../member/MemberPageHeader';
import { bookById, parseReference } from '../../lib/bibleBooks';
import { loadKjvBookText, TRANSLATION_LABEL, type BibleTranslation } from '../../lib/bibleClient';
import { readRecent } from '../../lib/bibleMarks';
import { searchKjv, type SearchHit, type SearchProgress } from '../../lib/bibleSearch';
import { getTodaysWord } from '../../lib/todaysWord';

type Props = {
  bookId: string;
  chapter: number;
  translation: BibleTranslation;
  nivReady: boolean;
  onTranslation: (t: BibleTranslation) => void;
  onRead: (bookId: string, chapter: number, verse?: number, verseEnd?: number) => void;
  onBooks: () => void;
  onMarks: (kind: 'highlights' | 'bookmarks') => void;
  onToast: (msg: string) => void;
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Bold the searched words inside a verse. */
function Marked({ text, query }: { text: string; query: string }) {
  const words = query
    .toLowerCase()
    .replace(/[^a-z' ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  if (!words.length) return <>{text}</>;
  const re = new RegExp(`\\b(${words.map(escapeRe).join('|')})`, 'gi');
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="bg-gold-light text-ink rounded-sm">
            {p}
          </mark>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        )
      )}
    </>
  );
}

/** Verses containing the exact phrase come first; otherwise Bible order. */
function exactFirst<T extends { text: string }>(hits: T[], query: string): T[] {
  const phrase = query.toLowerCase().replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!phrase.includes(' ')) return hits;
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ');
  return [...hits.filter((h) => norm(h.text).includes(phrase)), ...hits.filter((h) => !norm(h.text).includes(phrase))];
}

export const BibleHome: React.FC<Props> = ({ bookId, chapter, translation, nivReady, onTranslation, onRead, onBooks, onMarks, onToast }) => {
  const [query, setQuery] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const [search, setSearch] = useState<{ q: string; p: SearchProgress } | null>(null);
  const [recent] = useState(() => readRecent());
  const cancelRef = useRef<{ cancelled: boolean } | null>(null);
  const book = bookById(bookId)!;
  const word = getTodaysWord();
  const votdRef = parseReference(word.reference);
  // The daily word mixes translations; on the Bible page show the real KJV text for it.
  const [votdText, setVotdText] = useState<string | null>(null);
  useEffect(() => {
    if (!votdRef?.verse) return;
    let alive = true;
    const { book, chapter, verse, verseEnd } = votdRef;
    void loadKjvBookText(book.id)
      .then((chapters) => {
        const verses = (chapters[chapter - 1] || []).slice(verse - 1, verseEnd ?? verse);
        if (alive && verses.length) setVotdText(verses.join(' '));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word.reference]);
  const votdVerse = votdText ?? word.verse;
  const votdLabel = votdText ? `${word.reference} KJV` : word.reference;

  useEffect(() => () => {
    if (cancelRef.current) cancelRef.current.cancelled = true;
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    (document.activeElement as HTMLElement | null)?.blur();
    const ref = parseReference(q);
    if (ref) {
      setHint(null);
      setQuery('');
      onRead(ref.book.id, ref.chapter, ref.verse, ref.verseEnd);
      return;
    }
    if (q.replace(/[^a-z]/gi, '').length < 2) {
      setHint('Try a reference like “John 3:16”, or a word like “peace”.');
      return;
    }
    setHint(null);
    if (cancelRef.current) cancelRef.current.cancelled = true;
    const signal = { cancelled: false };
    cancelRef.current = signal;
    setSearch({ q, p: { hits: [], booksDone: 0, booksTotal: 66, done: false, capped: false } });
    void searchKjv(q, (p) => !signal.cancelled && setSearch({ q, p }), signal);
  };

  const clearSearch = () => {
    if (cancelRef.current) cancelRef.current.cancelled = true;
    setSearch(null);
    setQuery('');
  };

  const shareVotd = async () => {
    const text = `“${votdVerse}”\n— ${votdLabel}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        onToast('Copied');
      }
    } catch {
      /* cancelled */
    }
  };

  const tile =
    'h-[84px] rounded-[18px] bg-white border border-gray-200 flex flex-col items-center justify-center gap-1.5 text-[13px] font-bold text-ink active:bg-gray-50';

  return (
    <>
      <MemberPageHeader
        title="Bible"
        eyebrow="Read the Word"
        backTo="/me"
        backLabel="Me"
        action={
          <div role="radiogroup" aria-label="Translation" className="flex h-10 rounded-full bg-white border border-gray-200 p-[3px]">
            {(['kjv', 'niv'] as const).map((t) => {
              const disabled = t === 'niv' && !nivReady;
              const active = translation === t;
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={disabled}
                  onClick={() => onTranslation(t)}
                  title={disabled ? 'NIV is coming soon' : undefined}
                  className={`px-3.5 rounded-full text-[13px] font-bold ${active ? 'bg-burgundy text-white' : disabled ? 'text-gray-300' : 'text-ink-soft'}`}
                >
                  {TRANSLATION_LABEL[t]}
                </button>
              );
            })}
          </div>
        }
      />

      <form onSubmit={onSubmit} className="mb-5" role="search">
        <label className="relative flex items-center">
          <span className="sr-only">Go to a verse or search the Bible</span>
          <Search size={17} className="absolute left-3.5 text-ink-soft pointer-events-none" aria-hidden />
          <input
            type="search"
            inputMode="search"
            enterKeyHint="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHint(null);
            }}
            placeholder="John 3:16, or search “peace”"
            className="w-full h-12 rounded-2xl bg-white border border-gray-200 pl-10 pr-4 text-[15px] text-ink placeholder:text-ink-soft outline-none focus:ring-2 focus:ring-gold"
          />
        </label>
        {hint ? <p className="mt-1.5 ml-1 text-sm text-burgundy">{hint}</p> : null}
      </form>

      {search ? (
        <section aria-labelledby="search-title" aria-live="polite">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="search-title" className="text-[16px] font-extrabold text-ink truncate">
              {search.p.done
                ? `${search.p.hits.length}${search.p.capped ? '+' : ''} verse${search.p.hits.length === 1 ? '' : 's'} with “${search.q}”`
                : `Searching… ${search.p.booksDone} of ${search.p.booksTotal} books`}
            </h2>
            <button type="button" onClick={clearSearch} className="h-10 px-3 inline-flex items-center gap-1 rounded-full bg-white border border-gray-200 text-[13px] font-bold text-ink shrink-0">
              <X size={15} aria-hidden /> Clear
            </button>
          </div>
          {search.p.done && search.p.hits.length === 0 ? (
            <p className="py-6 text-center text-[15px] text-ink-soft">No verses found. Try a different word.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {exactFirst<SearchHit>(search.p.hits, search.q).map((h) => (
                <li key={`${h.bookId}.${h.chapter}.${h.verse}`}>
                  <button
                    type="button"
                    onClick={() => onRead(h.bookId, h.chapter, h.verse)}
                    className="w-full text-left rounded-2xl bg-white border border-gray-200 px-4 py-3 active:bg-gray-50"
                  >
                    <span className="block text-[14px] font-bold text-burgundy">
                      {bookById(h.bookId)?.name} {h.chapter}:{h.verse}
                    </span>
                    <span className="mt-0.5 block text-[15px] leading-relaxed text-ink line-clamp-3">
                      <Marked text={h.text} query={search.q} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {search.p.capped ? <p className="mt-3 text-center text-[13px] text-ink-soft">Showing the first 200. Add another word to narrow it down.</p> : null}
          <p className="mt-3 text-center text-[12px] text-ink-soft">Search uses the King James Version.</p>
        </section>
      ) : (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => onRead(bookId, chapter)}
            className="text-left rounded-3xl bg-wine text-cream p-5 active:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            <span className="block text-[13px] font-semibold text-leaf">Continue reading</span>
            <span className="mt-1.5 block font-display text-[30px] font-bold text-white leading-tight">
              {book.name} {book.chapters > 1 ? chapter : ''}
            </span>
            <span className="mt-1 block text-[14px] text-cream/75">{translation === 'niv' ? 'New International Version' : 'King James Version'}</span>
            <span className="mt-4 flex items-center gap-3">
              <span className="flex-1 h-1.5 rounded-full bg-white/15 overflow-hidden" aria-hidden>
                <span className="block h-full rounded-full bg-leaf" style={{ width: `${Math.max(4, Math.round((chapter / book.chapters) * 100))}%` }} />
              </span>
              <span className="text-[12px] font-bold text-leaf">
                Chapter {chapter} of {book.chapters}
              </span>
            </span>
          </button>

          <section aria-labelledby="votd" className="rounded-3xl bg-white border border-[#EFE7D6] p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h2 id="votd" className="text-[13px] font-bold text-gold-ink">
                Verse of the day
              </h2>
              <button type="button" onClick={() => void shareVotd()} aria-label="Share verse of the day" className="h-10 w-10 -mr-1 rounded-full bg-eggshell inline-flex items-center justify-center text-burgundy">
                <Share2 size={16} aria-hidden />
              </button>
            </div>
            <p className="mt-2.5 font-display text-[21px] italic font-semibold leading-snug text-wine-night">“{votdVerse}”</p>
            {votdRef ? (
              <button
                type="button"
                onClick={() => onRead(votdRef.book.id, votdRef.chapter, votdRef.verse, votdRef.verseEnd)}
                className="mt-2.5 text-[14px] font-bold text-burgundy underline-offset-4 hover:underline"
              >
                {votdLabel}
              </button>
            ) : (
              <p className="mt-2.5 text-[14px] font-bold text-burgundy">{votdLabel}</p>
            )}
          </section>

          <div className="grid grid-cols-3 gap-2.5">
            <button type="button" onClick={onBooks} className={tile}>
              <BookOpenText size={20} className="text-burgundy" aria-hidden /> Books
            </button>
            <button type="button" onClick={() => onMarks('highlights')} className={tile}>
              <Highlighter size={20} className="text-burgundy" aria-hidden /> Highlights
            </button>
            <button type="button" onClick={() => onMarks('bookmarks')} className={tile}>
              <Bookmark size={20} className="text-burgundy" aria-hidden /> Bookmarks
            </button>
          </div>

          {recent.length > 0 ? (
            <section aria-labelledby="recent">
              <h2 id="recent" className="mb-2 text-[15px] font-extrabold text-ink">
                Recently read
              </h2>
              <div className="-mx-5 px-5 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {recent.map((r) => {
                  const b = bookById(r.bookId)!;
                  return (
                    <button
                      key={`${r.bookId}.${r.chapter}`}
                      type="button"
                      onClick={() => onRead(r.bookId, r.chapter)}
                      className="shrink-0 h-10 px-4 rounded-full bg-white border border-gray-200 text-[14px] font-semibold text-ink active:bg-gray-50"
                    >
                      {b.name} {b.chapters > 1 ? r.chapter : ''}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </>
  );
};
