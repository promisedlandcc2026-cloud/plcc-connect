import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BibleHome } from '../components/bible/BibleHome';
import { BibleReader, type Highlight } from '../components/bible/BibleReader';
import { BookPicker } from '../components/bible/BookPicker';
import { MarksSheet } from '../components/bible/MarksSheet';
import { BIBLE_BOOKS, bookById, parseReference } from '../lib/bibleBooks';
import { isNivAvailable, readBiblePrefs, saveBiblePrefs, type BiblePrefs, type BibleTranslation } from '../lib/bibleClient';

/** Read "?ref=JHN.3.16" (deep links) or "?q=John 3:16" into a place in the Bible. */
function placeFromParams(params: URLSearchParams): { bookId: string; chapter: number; highlight: Highlight } | null {
  const ref = params.get('ref');
  if (ref) {
    const [b, c, v] = ref.split('.');
    const book = bookById(b);
    const chapter = Number(c) || 1;
    if (book && chapter >= 1 && chapter <= book.chapters) {
      const verse = Number(v);
      return { bookId: book.id, chapter, highlight: verse > 0 ? { from: verse, to: verse } : null };
    }
  }
  const q = params.get('q');
  if (q) {
    const r = parseReference(q);
    if (r) return { bookId: r.book.id, chapter: r.chapter, highlight: r.verse ? { from: r.verse, to: r.verseEnd ?? r.verse } : null };
  }
  return null;
}

/**
 * Bible — home (search, continue reading, verse of the day, highlights, bookmarks) and
 * the reader. KJV is bundled (public domain); NIV turns on once the church's API.Bible
 * key is set. Reading place, highlights and bookmarks are remembered on this device.
 * The reader is "?view=read", so the phone's back button returns to the Bible home.
 */
export const MemberBiblePage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [prefs, setPrefs] = useState<BiblePrefs>(() => {
    const saved = readBiblePrefs();
    const fromLink = placeFromParams(params);
    return fromLink ? { ...saved, bookId: fromLink.bookId, chapter: fromLink.chapter } : saved;
  });
  const [highlight, setHighlight] = useState<Highlight>(() => placeFromParams(params)?.highlight ?? null);
  const [nivReady, setNivReady] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [marksOpen, setMarksOpen] = useState<'highlights' | 'bookmarks' | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const reading = params.get('view') === 'read';
  const book = bookById(prefs.bookId) ?? BIBLE_BOOKS[42];
  const translation: BibleTranslation = prefs.translation === 'niv' && nivReady ? 'niv' : 'kjv';

  useEffect(() => {
    let alive = true;
    void isNivAvailable().then((ok) => alive && setNivReady(ok));
    return () => {
      alive = false;
    };
  }, []);

  // A deep link (?ref / ?q) opens the reader at that place.
  useEffect(() => {
    const place = placeFromParams(params);
    if (!place) return;
    setPrefs((p) => ({ ...p, bookId: place.bookId, chapter: place.chapter }));
    setHighlight(place.highlight);
    setParams({ view: 'read' }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => saveBiblePrefs(prefs), [prefs]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [reading]);

  const goTo = useCallback(
    (bookId: string, chapter: number, hl: Highlight = null) => {
      setHighlight(hl);
      setPrefs((p) => ({ ...p, bookId, chapter }));
      if (!reading) setParams({ view: 'read' });
    },
    [reading, setParams]
  );

  const backToHome = () => {
    // Came from the Bible home: go back in history so the phone's back button stays in sync.
    if (window.history.state && (window.history.state as { idx?: number }).idx) window.history.back();
    else setParams({}, { replace: true });
  };

  return (
    <main className="flex-1 px-5 pt-10 pb-44">
      {reading ? (
        <BibleReader
          prefs={{ ...prefs, bookId: book.id }}
          translation={translation}
          nivReady={nivReady}
          highlight={highlight}
          onPrefs={setPrefs}
          onGoTo={goTo}
          onBack={backToHome}
          onPicker={() => setPickerOpen(true)}
          onToast={setToast}
        />
      ) : (
        <BibleHome
          bookId={book.id}
          chapter={prefs.chapter}
          translation={translation}
          nivReady={nivReady}
          onTranslation={(t) => setPrefs((p) => ({ ...p, translation: t }))}
          onRead={(b, c, v, ve) => goTo(b, c, v ? { from: v, to: ve ?? v } : null)}
          onBooks={() => setPickerOpen(true)}
          onMarks={setMarksOpen}
          onToast={setToast}
        />
      )}

      {toast ? (
        <div role="status" className="fixed top-6 left-1/2 -translate-x-1/2 z-[430] rounded-full bg-wine-night text-cream text-sm font-semibold px-4 py-2 shadow-lift">
          {toast}
        </div>
      ) : null}

      {pickerOpen ? (
        <BookPicker
          current={book}
          currentChapter={prefs.chapter}
          onClose={() => setPickerOpen(false)}
          onPick={(b, c) => {
            setPickerOpen(false);
            goTo(b.id, c);
          }}
        />
      ) : null}

      {marksOpen ? (
        <MarksSheet
          kind={marksOpen}
          onClose={() => setMarksOpen(null)}
          onOpen={(b, c, v) => {
            setMarksOpen(null);
            goTo(b, c, { from: v, to: v });
          }}
        />
      ) : null}
    </main>
  );
};
