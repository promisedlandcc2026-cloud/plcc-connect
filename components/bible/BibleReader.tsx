import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAutoHideDock } from '../../lib/dockAutoHide';
import { useNavigate } from 'react-router-dom';
import { Bookmark, ChevronDown, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { ErrorState, SkeletonRows } from '../ui/States';
import { VerseSheet } from './VerseSheet';
import { bookById, formatReference, stepChapter } from '../../lib/bibleBooks';
import { BibleError, loadChapter, TEXT_SIZES, TRANSLATION_LABEL, type BibleChapter, type BiblePrefs, type BibleTranslation } from '../../lib/bibleClient';
import {
  getMarks,
  HIGHLIGHT_BG,
  onMarksChange,
  pushRecent,
  setHighlight,
  toggleBookmarks,
  verseKey,
  type HighlightColor,
} from '../../lib/bibleMarks';
import { readAloud, speechSupported, type Reading } from '../../lib/bibleSpeech';

export type Highlight = { from: number; to: number } | null;

type Props = {
  prefs: BiblePrefs;
  translation: BibleTranslation;
  nivReady: boolean;
  highlight: Highlight;
  onPrefs: (update: (p: BiblePrefs) => BiblePrefs) => void;
  onGoTo: (bookId: string, chapter: number, hl?: Highlight) => void;
  onBack: () => void;
  onPicker: () => void;
  onToast: (msg: string) => void;
};

const WORDS_PER_MINUTE = 200;

export const BibleReader: React.FC<Props> = ({ prefs, translation, nivReady, highlight, onPrefs, onGoTo, onBack, onPicker, onToast }) => {
  const navigate = useNavigate();
  const book = bookById(prefs.bookId)!;
  const [data, setData] = useState<BibleChapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [marks, setMarks] = useState(() => getMarks());
  const [sizeOpen, setSizeOpen] = useState(false);
  const [speakingVerse, setSpeakingVerse] = useState<number | null>(null);
  const [listening, setListening] = useState(false);
  const readingRef = useRef<Reading | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const canListen = speechSupported() && translation === 'kjv';
  // Bottom menu tucks away while reading (scroll down) and returns on scroll up.
  const dockHidden = useAutoHideDock(selected.size === 0);

  useEffect(() => onMarksChange(() => setMarks(getMarks())), []);

  const stopListening = useCallback(() => {
    readingRef.current?.stop();
    readingRef.current = null;
  }, []);

  // Stop reading aloud when leaving the chapter or the page.
  useEffect(() => stopListening, [stopListening, prefs.bookId, prefs.chapter, translation]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelected(new Set());
    try {
      setData(await loadChapter(translation, prefs.bookId, prefs.chapter));
      pushRecent(prefs.bookId, prefs.chapter);
    } catch (err) {
      setData(null);
      setError(err instanceof BibleError ? err.message : 'We couldn’t load this chapter. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [translation, prefs.bookId, prefs.chapter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (loading || !data) return;
    const target = highlight ? document.getElementById(`v${highlight.from}`) : null;
    if (target) target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    else topRef.current?.scrollIntoView({ block: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, data]);

  // Follow along while listening.
  useEffect(() => {
    if (speakingVerse) document.getElementById(`v${speakingVerse}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [speakingVerse]);

  const fontPx = TEXT_SIZES[prefs.textSize];
  const minutes = useMemo(() => {
    if (!data) return 0;
    const words = data.verses.reduce((n, v) => n + v.text.split(/\s+/).length, 0);
    return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
  }, [data]);

  const prev = stepChapter(book.id, prefs.chapter, -1);
  const next = stepChapter(book.id, prefs.chapter, 1);

  const nums = useMemo(() => [...selected].sort((a, b) => a - b), [selected]);
  const keys = useMemo(() => nums.map((n) => verseKey(book.id, prefs.chapter, n)), [nums, book.id, prefs.chapter]);
  const reference = useMemo(() => {
    if (!nums.length) return '';
    const contiguous = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
    return contiguous ? formatReference(book, prefs.chapter, nums[0], nums[nums.length - 1]) : `${book.name} ${prefs.chapter}:${nums.join(',')}`;
  }, [nums, book, prefs.chapter]);
  const selectionText = useMemo(() => {
    if (!data || !nums.length) return '';
    const body = data.verses
      .filter((v) => selected.has(v.n))
      .map((v) => (nums.length > 1 ? `${v.n} ${v.text}` : v.text))
      .join(' ');
    return `“${body}”\n— ${reference} ${TRANSLATION_LABEL[data.translation]}`;
  }, [data, nums, selected, reference]);

  const selColor: HighlightColor | null = useMemo(() => {
    const colors = keys.map((k) => marks.highlights[k]?.color);
    return colors.length && colors.every((c) => c && c === colors[0]) ? colors[0]! : null;
  }, [keys, marks]);
  const selBookmarked = keys.length > 0 && keys.every((k) => marks.bookmarks[k]);

  const toggleVerse = (n: number) => {
    setSelected((s) => {
      const nextSet = new Set(s);
      if (nextSet.has(n)) nextSet.delete(n);
      else nextSet.add(n);
      return nextSet;
    });
  };

  const clear = () => setSelected(new Set());

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(selectionText);
      onToast('Copied');
      clear();
    } catch {
      onToast('Couldn’t copy on this device');
    }
  };

  const share = async () => {
    if (!navigator.share) return void copy();
    try {
      await navigator.share({ text: selectionText });
      clear();
    } catch {
      /* cancelled */
    }
  };

  const addToNotes = () => {
    const q = new URLSearchParams({ title: reference, text: selectionText });
    stopListening();
    navigate(`/notes/new?${q.toString()}`);
  };

  const toggleListen = () => {
    if (!data) return;
    if (readingRef.current) {
      stopListening();
      return;
    }
    // Start from the first selected verse, else from the top.
    const startAt = nums.length ? Math.max(0, data.verses.findIndex((v) => v.n === nums[0])) : 0;
    clear();
    setListening(true);
    readingRef.current = readAloud(
      `${book.name}, chapter ${prefs.chapter}.`,
      data.verses,
      startAt,
      setSpeakingVerse,
      () => {
        setListening(false);
        readingRef.current = null;
      }
    );
  };

  const iconBtn = 'h-11 rounded-[14px] bg-white border border-gray-200 inline-flex items-center justify-center active:bg-gray-50';

  return (
    <>
      <div ref={topRef} className="sticky top-0 z-20 -mx-5 px-3 py-3 bg-eggshell/95 backdrop-blur border-b border-[#E8E2DA] scroll-mt-0">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack} aria-label="Back to Bible home" className="h-11 w-11 shrink-0 rounded-full inline-flex items-center justify-center text-ink active:bg-black/5">
            <ChevronLeft size={22} aria-hidden />
          </button>
          <button type="button" onClick={onPicker} aria-haspopup="dialog" className={`${iconBtn} flex-1 min-w-0 justify-between px-3`}>
            <span className="truncate font-extrabold text-ink text-[16px]">
              {book.name} {book.chapters > 1 ? prefs.chapter : ''}
            </span>
            <ChevronDown size={18} className="shrink-0 text-ink-soft" aria-hidden />
          </button>
          <button
            type="button"
            disabled={!nivReady}
            onClick={() => onPrefs((p) => ({ ...p, translation: translation === 'kjv' ? 'niv' : 'kjv' }))}
            aria-label={nivReady ? `Translation: ${TRANSLATION_LABEL[translation]}. Switch to ${translation === 'kjv' ? 'NIV' : 'KJV'}` : 'King James Version. NIV is coming soon'}
            className={`${iconBtn} px-3 text-[13px] font-extrabold text-burgundy disabled:text-burgundy`}
          >
            {TRANSLATION_LABEL[translation]}
          </button>
          <div className="relative">
            <button type="button" onClick={() => setSizeOpen((o) => !o)} aria-expanded={sizeOpen} aria-label="Text size" className={`${iconBtn} w-11 font-display text-[15px] font-bold text-ink`}>
              Aa
            </button>
            {sizeOpen ? (
              <div className="absolute right-0 top-12 z-30 flex rounded-2xl bg-white border border-gray-200 shadow-lift overflow-hidden" role="group" aria-label="Text size">
                <button
                  type="button"
                  aria-label="Smaller text"
                  disabled={prefs.textSize === 0}
                  onClick={() => onPrefs((p) => ({ ...p, textSize: Math.max(0, p.textSize - 1) }))}
                  className="h-12 w-12 text-[14px] font-bold text-ink disabled:text-gray-300"
                >
                  A
                </button>
                <button
                  type="button"
                  aria-label="Larger text"
                  disabled={prefs.textSize === TEXT_SIZES.length - 1}
                  onClick={() => onPrefs((p) => ({ ...p, textSize: Math.min(TEXT_SIZES.length - 1, p.textSize + 1) }))}
                  className="h-12 w-12 text-[21px] font-bold text-ink disabled:text-gray-300 border-l border-gray-200"
                >
                  A
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <article className="pt-6" aria-live="polite" aria-busy={loading}>
        <header className="mb-4 flex items-baseline gap-3">
          {book.chapters > 1 ? <span className="font-display text-[72px] font-bold leading-[0.9] text-burgundy">{prefs.chapter}</span> : null}
          <div>
            <h2 className="font-display text-[24px] font-bold text-ink">{book.name}</h2>
            {data && !loading ? (
              <p className="mt-0.5 text-[13px] font-semibold text-ink-soft">
                {minutes} min read · {data.verses.length} verses
              </p>
            ) : null}
          </div>
        </header>

        {loading ? (
          <SkeletonRows rows={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : data ? (
          <>
            <p className="font-display text-ink leading-[1.75]" style={{ fontSize: fontPx + 1 }}>
              {data.verses.map((v) => {
                const key = verseKey(book.id, prefs.chapter, v.n);
                const isSel = selected.has(v.n);
                const isSpeaking = speakingVerse === v.n;
                const isLinked = highlight && v.n >= highlight.from && v.n <= highlight.to;
                const color = marks.highlights[key]?.color;
                const bg = color ? HIGHLIGHT_BG[color] : isLinked || isSpeaking ? '#F4E7B3B3' : undefined;
                return (
                  <span
                    key={v.n}
                    id={`v${v.n}`}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSel}
                    onClick={() => toggleVerse(v.n)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleVerse(v.n);
                      }
                    }}
                    className={`cursor-pointer rounded-[4px] scroll-mt-32 [box-decoration-break:clone] [-webkit-box-decoration-break:clone] transition-colors ${
                      isSel ? 'underline decoration-gold decoration-[3px] underline-offset-[5px]' : ''
                    }`}
                    style={bg ? { background: bg } : undefined}
                  >
                    <sup className="mr-1 ml-0.5 font-sans font-extrabold text-burgundy" style={{ fontSize: Math.round(fontPx * 0.6) }}>
                      {v.n}
                    </sup>
                    {marks.bookmarks[key] ? (
                      <Bookmark size={Math.round(fontPx * 0.7)} className="inline -mt-1 mr-1 text-burgundy" fill="currentColor" aria-label="Bookmarked" />
                    ) : null}
                    {v.text}{' '}
                  </span>
                );
              })}
            </p>
            {data.copyright ? <p className="mt-6 text-[11px] leading-snug text-ink-soft">{data.copyright}</p> : null}
            {data.translation === 'kjv' ? <p className="mt-6 text-[11px] text-ink-soft">King James Version (public domain)</p> : null}
          </>
        ) : null}
      </article>

      {/* Chapter bar: previous · Listen · next. Hidden while verses are selected (the verse panel takes its place). */}
      {!loading && selected.size === 0 ? (
        <div
          className={`fixed left-1/2 -translate-x-1/2 z-[120] w-full max-w-[500px] px-4 bottom-[calc(max(12px,env(safe-area-inset-bottom))+84px)] transition-transform duration-300 ease-out motion-reduce:transition-none ${
            dockHidden ? 'translate-y-[84px]' : 'translate-y-0'
          }`}
        >
          <div className="flex items-center gap-1.5 rounded-[20px] bg-wine-night text-cream shadow-lift p-1.5">
            <button
              type="button"
              disabled={!prev}
              onClick={() => prev && onGoTo(prev.bookId, prev.chapter)}
              aria-label={prev ? `Previous chapter: ${bookById(prev.bookId)!.name} ${prev.chapter}` : 'No previous chapter'}
              className="h-11 w-11 shrink-0 rounded-[14px] inline-flex items-center justify-center disabled:opacity-30 active:bg-white/10"
            >
              <ChevronLeft size={20} aria-hidden />
            </button>
            {canListen ? (
              <button
                type="button"
                onClick={toggleListen}
                aria-pressed={listening}
                className="flex-1 h-11 rounded-[14px] bg-leaf text-wine-night inline-flex items-center justify-center gap-2 text-[14px] font-extrabold"
              >
                {listening ? <Pause size={16} fill="currentColor" aria-hidden /> : <Play size={16} fill="currentColor" aria-hidden />}
                <span className="truncate">{listening ? 'Stop listening' : `Listen to ${book.name} ${book.chapters > 1 ? prefs.chapter : ''}`}</span>
              </button>
            ) : (
              <span className="flex-1 text-center text-[13px] font-semibold text-cream/80 truncate">
                {book.name} {book.chapters > 1 ? prefs.chapter : ''}
              </span>
            )}
            <button
              type="button"
              disabled={!next}
              onClick={() => next && onGoTo(next.bookId, next.chapter)}
              aria-label={next ? `Next chapter: ${bookById(next.bookId)!.name} ${next.chapter}` : 'No next chapter'}
              className="h-11 w-11 shrink-0 rounded-[14px] inline-flex items-center justify-center disabled:opacity-30 active:bg-white/10"
            >
              <ChevronRight size={20} aria-hidden />
            </button>
          </div>
        </div>
      ) : null}

      {selected.size > 0 ? (
        <VerseSheet
          reference={reference}
          activeColor={selColor}
          bookmarked={selBookmarked}
          onHighlight={(c) => {
            setHighlight(keys, c);
            clear();
          }}
          onCopy={() => void copy()}
          onShare={() => void share()}
          onBookmark={() => {
            const on = toggleBookmarks(keys);
            onToast(on ? 'Bookmarked' : 'Bookmark removed');
            clear();
          }}
          onAddToNotes={addToNotes}
          onClose={clear}
        />
      ) : null}
    </>
  );
};
