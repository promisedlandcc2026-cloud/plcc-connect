import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, X } from 'lucide-react';
import { BIBLE_BOOKS, type BibleBook } from '../../lib/bibleBooks';

/** Bottom sheet: pick a book, then a chapter. */
export const BookPicker: React.FC<{
  current: BibleBook;
  currentChapter: number;
  onClose: () => void;
  onPick: (book: BibleBook, chapter: number) => void;
}> = ({ current, currentChapter, onClose, onPick }) => {
  const [step, setStep] = useState<BibleBook | null>(null);
  const [tab, setTab] = useState<'OT' | 'NT'>(current.testament);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const pickBook = (b: BibleBook) => {
    if (b.chapters === 1) onPick(b, 1);
    else setStep(b);
  };

  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={step ? `Chapters in ${step.name}` : 'Choose a book'}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[500px] bg-eggshell rounded-t-[28px] sm:rounded-[28px] shadow-2xl flex flex-col max-h-[88dvh] animate-in slide-in-from-bottom-8 duration-300"
      >
        <div className="shrink-0 flex items-center gap-2 px-5 pt-5 pb-3">
          {step ? (
            <button type="button" onClick={() => setStep(null)} className="-ml-2 inline-flex items-center gap-0.5 h-11 pr-2 text-burgundy font-semibold">
              <ChevronLeft size={22} aria-hidden /> Books
            </button>
          ) : null}
          <h2 className="flex-1 font-display text-[22px] font-bold text-ink truncate">{step ? step.name : 'Choose a book'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="h-11 w-11 -mr-2 inline-flex items-center justify-center rounded-full text-ink-soft active:bg-black/5">
            <X size={22} aria-hidden />
          </button>
        </div>

        {!step ? (
          <div className="shrink-0 px-5 pb-3">
            <div role="tablist" className="grid grid-cols-2 rounded-xl bg-white border border-gray-200 p-1">
              {(['OT', 'NT'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`h-10 rounded-lg text-[14px] font-bold ${tab === t ? 'bg-burgundy text-white' : 'text-ink-soft'}`}
                >
                  {t === 'OT' ? 'Old Testament' : 'New Testament'}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {step ? (
            <div className="grid grid-cols-5 gap-2 pb-2">
              {Array.from({ length: step.chapters }, (_, i) => i + 1).map((c) => {
                const here = step.id === current.id && c === currentChapter;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onPick(step, c)}
                    className={`h-12 rounded-xl text-[16px] font-bold ${here ? 'bg-burgundy text-white' : 'bg-white border border-gray-200 text-ink active:bg-gray-50'}`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-2 pb-2">
              {BIBLE_BOOKS.filter((b) => b.testament === tab).map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => pickBook(b)}
                    className={`w-full h-12 rounded-xl px-3 text-left text-[15px] font-semibold truncate ${
                      b.id === current.id ? 'bg-burgundy text-white' : 'bg-white border border-gray-200 text-ink active:bg-gray-50'
                    }`}
                  >
                    {b.name}
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
