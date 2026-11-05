import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bookmark, Highlighter, X } from 'lucide-react';
import { bookById } from '../../lib/bibleBooks';
import { loadKjvBookText } from '../../lib/bibleClient';
import { HIGHLIGHT_BG, listBookmarks, listHighlights, type MarkEntry } from '../../lib/bibleMarks';

type Props = {
  kind: 'highlights' | 'bookmarks';
  onClose: () => void;
  onOpen: (bookId: string, chapter: number, verse: number) => void;
};

/** Bottom sheet listing saved highlights or bookmarks, newest first, with a KJV preview line. */
export const MarksSheet: React.FC<Props> = ({ kind, onClose, onOpen }) => {
  const [entries] = useState<MarkEntry[]>(() => (kind === 'highlights' ? listHighlights() : listBookmarks()));
  const [previews, setPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    let alive = true;
    const first = entries.slice(0, 60);
    const books = Array.from(new Set<string>(first.map((e) => e.bookId)));
    void Promise.all(books.map((b) => loadKjvBookText(b).then((t) => [b, t] as const).catch(() => null))).then((loaded) => {
      if (!alive) return;
      const byBook = new Map(loaded.filter(Boolean) as [string, string[][]][]);
      const out: Record<string, string> = {};
      for (const e of first) {
        const text = byBook.get(e.bookId)?.[e.chapter - 1]?.[e.verse - 1];
        if (text) out[e.key] = text;
      }
      setPreviews(out);
    });
    return () => {
      alive = false;
    };
  }, [entries]);

  const title = kind === 'highlights' ? 'Highlights' : 'Bookmarks';
  const Icon = kind === 'highlights' ? Highlighter : Bookmark;

  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[500px] bg-eggshell rounded-t-[28px] sm:rounded-[28px] shadow-2xl flex flex-col max-h-[85dvh] animate-in slide-in-from-bottom-8 duration-300"
      >
        <div className="shrink-0 flex items-center gap-2 px-5 pt-5 pb-3">
          <h2 className="flex-1 font-display text-[22px] font-bold text-ink">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="h-11 w-11 -mr-2 inline-flex items-center justify-center rounded-full text-ink-soft active:bg-black/5">
            <X size={22} aria-hidden />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {entries.length === 0 ? (
            <div className="py-10 text-center flex flex-col items-center">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-burgundy/[0.07] text-burgundy">
                <Icon size={22} aria-hidden />
              </span>
              <p className="text-[15px] font-semibold text-ink">No {title.toLowerCase()} yet</p>
              <p className="mt-1.5 text-sm text-ink-soft max-w-xs">
                Tap any verse while reading, then choose {kind === 'highlights' ? 'a color' : 'Bookmark'}.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2 pb-2">
              {entries.map((e) => (
                <li key={e.key}>
                  <button
                    type="button"
                    onClick={() => onOpen(e.bookId, e.chapter, e.verse)}
                    className="w-full text-left rounded-2xl bg-white border border-gray-200 px-4 py-3 active:bg-gray-50 flex gap-3"
                  >
                    {e.color ? <span className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: HIGHLIGHT_BG[e.color] }} aria-hidden /> : null}
                    <span className="min-w-0">
                      <span className="block text-[15px] font-bold text-ink">
                        {bookById(e.bookId)?.name} {e.chapter}:{e.verse}
                      </span>
                      {previews[e.key] ? <span className="mt-0.5 block text-[14px] text-ink-soft line-clamp-2">{previews[e.key]}</span> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
