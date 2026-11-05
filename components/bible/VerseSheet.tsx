import React from 'react';
import { Bookmark, Copy, PenLine, Share2, X } from 'lucide-react';
import { HIGHLIGHT_BG, HIGHLIGHT_COLORS, HIGHLIGHT_LABEL, type HighlightColor } from '../../lib/bibleMarks';

type Props = {
  reference: string;
  activeColor: HighlightColor | null;
  bookmarked: boolean;
  onHighlight: (color: HighlightColor | null) => void;
  onCopy: () => void;
  onShare: () => void;
  onBookmark: () => void;
  onAddToNotes: () => void;
  onClose: () => void;
};

/** Slides up when verses are tapped: highlight colors plus Copy, Share, Bookmark, Add to notes. */
export const VerseSheet: React.FC<Props> = ({
  reference,
  activeColor,
  bookmarked,
  onHighlight,
  onCopy,
  onShare,
  onBookmark,
  onAddToNotes,
  onClose,
}) => {
  const action =
    'h-[72px] rounded-2xl bg-white/[0.08] active:bg-white/[0.14] text-cream flex flex-col items-center justify-center gap-1.5 text-[12px] font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-leaf';
  return (
    <section
      aria-label={`Verse actions for ${reference}`}
      className="fixed left-1/2 -translate-x-1/2 bottom-0 z-[300] w-full max-w-[500px] rounded-t-[28px] bg-wine-night text-cream shadow-lift px-5 pt-2.5 pb-[max(1.5rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-8 duration-200"
    >
      <div className="mx-auto mb-3 h-[5px] w-10 rounded-full bg-cream/25" aria-hidden />
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-[22px] font-bold truncate">{reference}</p>
        <button type="button" onClick={onClose} aria-label="Clear selection" className="h-11 w-11 shrink-0 rounded-full bg-white/[0.08] inline-flex items-center justify-center">
          <X size={18} aria-hidden />
        </button>
      </div>

      <p className="mt-4 mb-2.5 text-[13px] font-bold text-leaf">Highlight</p>
      <div className="flex gap-3.5" role="group" aria-label="Highlight color">
        {HIGHLIGHT_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`${HIGHLIGHT_LABEL[c]} highlight`}
            aria-pressed={activeColor === c}
            onClick={() => onHighlight(c)}
            className={`h-11 w-11 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-leaf ${activeColor === c ? 'ring-[3px] ring-cream ring-offset-2 ring-offset-wine-night' : ''}`}
            style={{ background: HIGHLIGHT_BG[c] }}
          />
        ))}
        <button
          type="button"
          aria-label="Remove highlight"
          disabled={!activeColor}
          onClick={() => onHighlight(null)}
          className="h-11 w-11 rounded-full border-2 border-dashed border-cream/45 inline-flex items-center justify-center disabled:opacity-35"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2">
        <button type="button" onClick={onCopy} className={action}>
          <Copy size={20} className="text-leaf" aria-hidden /> Copy
        </button>
        <button type="button" onClick={onShare} className={action}>
          <Share2 size={20} className="text-leaf" aria-hidden /> Share
        </button>
        <button type="button" onClick={onBookmark} aria-pressed={bookmarked} className={action}>
          <Bookmark size={20} className="text-leaf" fill={bookmarked ? 'currentColor' : 'none'} aria-hidden />
          {bookmarked ? 'Bookmarked' : 'Bookmark'}
        </button>
        <button type="button" onClick={onAddToNotes} className={action}>
          <PenLine size={20} className="text-leaf" aria-hidden /> Add to notes
        </button>
      </div>
    </section>
  );
};
