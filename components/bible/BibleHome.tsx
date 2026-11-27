import React, { useEffect, useRef, useState } from 'react';
import { Bookmark, BookOpen, BookOpenText, CalendarDays, ChevronRight, Highlighter, Languages, Search, Share2, X } from 'lucide-react';
import { MemberPageHeader } from '../member/MemberPageHeader';
import { bookById, parseReference } from '../../lib/bibleBooks';
import { FEATURED_TRANSLATIONS, loadKjvBookText, translationLabel, translationName, type BibleTranslation, type TranslationInfo } from '../../lib/bibleClient';
import { TranslationSheet } from './TranslationSheet';
import { readRecent } from '../../lib/bibleMarks';
import { searchKjv, type SearchHit, type SearchProgress } from '../../lib/bibleSearch';
import { getTodaysWord } from '../../lib/todaysWord';

type Props = {
  bookId: string;
  chapter: number;
  translation: BibleTranslation;
  /** Every Bible the church offers (from the website). */
  translations: TranslationInfo[];
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

export const BibleHome: React.FC<Props> = ({ bookId, chapter, translation, translations, onTranslation, onRead, onBooks, onMarks, onToast }) => {
  const [bibleOpen, setBibleOpen] = useState(false);
  const quick = FEATURED_TRANSLATIONS.filter((id) => translations.some((t) => t.id === id));
  if (!quick.includes(translation)) quick.push(translation);
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

  // PLCC Bible tiles: cream cards with deep-green icons; the first (Read) is gold.
  const tile =
    'h-[88px] rounded-[18px] bg-[#fbf7ee] border border-[#ece3cf] shadow-[0_2px_8px_rgba(29,55,44,0.06)] flex flex-col items-center justify-center gap-1.5 text-[14px] font-bold text-[#16251f] active:bg-[#f4ecd9] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold';
  const tileIcon = 'text-[#1d372c]';

  return (
    <>
      <MemberPageHeader
        title="Bible"
        eyebrow="Read the Word"
        backTo="/me"
        backLabel="Me"
        action={
          <div role="radiogroup" aria-label="Translation" className="flex h-10 rounded-full bg-white border border-gray-200 p-[3px]">
            {quick.map((t) => {
              const active = translation === t;
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onTranslation(t)}
                  className={`px-3 rounded-full text-[13px] font-bold ${active ? 'bg-[#1d372c] text-[#f3d27a]' : 'text-ink-soft'}`}
                >
                  {translationLabel(t)}
                </button>
              );
            })}
            {translations.length > quick.length ? (
              <button
                type="button"
                onClick={() => setBibleOpen(true)}
                aria-haspopup="dialog"
                aria-label="More Bibles"
                className="px-2.5 rounded-full text-[13px] font-bold text-ink-soft"
              >
                More
              </button>
            ) : null}
          </div>
        }
      />

      {/* PLCC Bible banner (its words are part of the picture). */}
      <div className="-mt-1 mb-4 overflow-hidden rounded-[24px] bg-[#12241c] shadow-[0_10px_30px_rgba(18,36,28,0.25)]">
        <img src="/brand/plcc-bible-banner.webp" alt="PLCC Bible: Read, Study, Reflect, Share" width={1080} height={360} className="block h-auto w-full" />
      </div>

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
            className="w-full h-12 rounded-2xl bg-white border border-[#e6dcc6] pl-10 pr-4 text-[15px] text-ink placeholder:text-ink-soft outline-none focus:ring-2 focus:ring-gold"
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
          <div className="grid grid-cols-3 gap-2.5">
            <button type="button" onClick={() => onRead(bookId, chapter)} className={`${tile} !border-[#d9a83a] !bg-gradient-to-b !from-[#f6d77e] !to-[#dcae45] shadow-[0_6px_16px_rgba(201,163,90,0.45)]`}>
              <BookOpen size={22} className={tileIcon} aria-hidden /> Bible
            </button>
            <button type="button" onClick={onBooks} className={tile}>
              <BookOpenText size={22} className={tileIcon} aria-hidden /> Books
            </button>
            <button type="button" onClick={() => document.querySelector<HTMLInputElement>('form[role="search"] input')?.focus()} className={tile}>
              <Search size={22} className={tileIcon} aria-hidden /> Search
            </button>
            <button type="button" onClick={() => onMarks('highlights')} className={tile}>
              <Highlighter size={22} className={tileIcon} aria-hidden /> Highlights
            </button>
            <button type="button" onClick={() => onMarks('bookmarks')} className={tile}>
              <Bookmark size={22} className={tileIcon} aria-hidden /> Bookmarks
            </button>
            <button type="button" onClick={() => setBibleOpen(true)} className={tile} aria-haspopup="dialog">
              <Languages size={22} className={tileIcon} aria-hidden /> Bibles
            </button>
          </div>

          <button
            type="button"
            onClick={() => onRead(bookId, chapter)}
            className="text-left rounded-3xl bg-[#fbf7ee] border border-[#ece3cf] p-5 shadow-[0_4px_14px_rgba(29,55,44,0.06)] active:bg-[#f4ecd9] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            <span className="flex items-center gap-2 text-[15px] font-bold text-[#3b2a12]">
              <BookOpen size={18} className="text-[#a8833c]" aria-hidden /> Continue Reading
            </span>
            <span className="mt-1.5 flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block font-display text-[28px] font-bold leading-tight text-[#16251f]">
                  {book.name} {book.chapters > 1 ? chapter : ''}
                </span>
                <span className="mt-0.5 block text-[14px] text-ink-soft">{translationName(translation)}</span>
              </span>
              <ChevronRight size={24} className="shrink-0 text-[#a8833c]" aria-hidden />
            </span>
            <span className="mt-4 flex items-center gap-3">
              <span className="flex-1 h-1.5 rounded-full bg-[#1d372c]/10 overflow-hidden" aria-hidden>
                <span className="block h-full rounded-full bg-gradient-to-r from-[#c9a35a] to-[#e4c36a]" style={{ width: `${Math.max(4, Math.round((chapter / book.chapters) * 100))}%` }} />
              </span>
              <span className="text-[12px] font-bold text-gold-ink">
                Chapter {chapter} of {book.chapters}
              </span>
            </span>
          </button>

          <section aria-labelledby="votd" className="rounded-3xl bg-[#fbf7ee] border border-[#ece3cf] p-5 shadow-[0_4px_14px_rgba(29,55,44,0.06)]">
            <div className="flex items-center justify-between">
              <h2 id="votd" className="flex items-center gap-2 text-[15px] font-bold text-[#3b2a12]">
                <CalendarDays size={18} className="text-[#a8833c]" aria-hidden /> Verse of the Day
              </h2>
              <button type="button" onClick={() => void shareVotd()} aria-label="Share verse of the day" className="h-10 w-10 -mr-1 rounded-full bg-white border border-[#ece3cf] inline-flex items-center justify-center text-[#1d372c]">
                <Share2 size={16} aria-hidden />
              </button>
            </div>
            <p className="mt-3 text-center font-display text-[20px] italic leading-snug text-[#16251f]">“{votdVerse}”</p>
            {votdRef ? (
              <button
                type="button"
                onClick={() => onRead(votdRef.book.id, votdRef.chapter, votdRef.verse, votdRef.verseEnd)}
                className="mx-auto mt-2.5 block text-[15px] font-bold text-[#16251f] underline-offset-4 hover:underline"
              >
                {votdLabel}
              </button>
            ) : (
              <p className="mt-2.5 text-center text-[15px] font-bold text-[#16251f]">{votdLabel}</p>
            )}
            <span aria-hidden className="mx-auto mt-3 block h-[3px] w-28 rounded-full bg-gradient-to-r from-[#c9a35a]/20 via-[#c9a35a] to-[#c9a35a]/20" />
          </section>

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
                      className="shrink-0 h-10 px-4 rounded-full bg-[#fbf3df] border border-[#d9b86a] text-[14px] font-semibold text-ink active:bg-[#f4ecd9]"
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
      {bibleOpen ? (
        <TranslationSheet
          list={translations}
          current={translation}
          under={null}
          showUnder={false}
          onPick={(id) => {
            onTranslation(id);
            setBibleOpen(false);
          }}
          onUnder={() => {}}
          onClose={() => setBibleOpen(false)}
        />
      ) : null}
    </>
  );
};
