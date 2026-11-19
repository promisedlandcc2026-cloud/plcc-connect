import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { SharedVerse } from '../../lib/verseShare';
import { GoldRuleMark } from './TribesHero';

/**
 * Framed Scripture card for Tribes posts: ivory card, fine gold border,
 * forest-green type. Reference and wording come from the church Bible reader
 * (carried in the post); long passages fold.
 */
export const ScriptureCard: React.FC<{ verse: SharedVerse; size?: 'feed' | 'full' }> = ({ verse, size = 'full' }) => {
  const [open, setOpen] = useState(false);
  const lines = size === 'feed' ? 5 : 9;
  const long = verse.text.length > lines * 38;
  const clamp = long && !open;
  return (
    <figure className="tribes-verse-frame mx-1 my-2 px-5 pb-4 pt-5 text-center text-[#12301f]">
      <GoldRuleMark tone="dark" size={size === 'feed' ? 26 : 32} />
      <figcaption className="mt-3">
        <span
          className={`block font-display font-bold leading-tight ${size === 'feed' ? 'text-[26px]' : 'text-[32px] sm:text-[36px]'}`}
        >
          {verse.ref}
        </span>
        <span className="mt-1 block text-xs font-bold uppercase tracking-[0.14em] text-[#7A5C0F]">{verse.translation}</span>
      </figcaption>
      <span aria-hidden className="mx-auto mt-3 block h-px w-20 bg-[#C9A35A]/70" />
      <blockquote
        className={`mt-3 font-display italic leading-snug ${size === 'feed' ? 'text-[19px]' : 'text-[22px] sm:text-[24px]'}`}
        style={clamp ? { display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : undefined}
      >
        {verse.text}
      </blockquote>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5">
        {long ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            aria-expanded={open}
            className="min-h-[44px] text-[14px] font-bold text-[#7A5C0F] underline-offset-2 hover:underline"
          >
            {open ? 'Show less' : 'Show all'}
          </button>
        ) : null}
        <a
          href={verse.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex min-h-[44px] items-center gap-1.5 text-[14px] font-bold text-[#1d372c] underline underline-offset-2"
        >
          Open in the Bible <ExternalLink size={14} aria-hidden />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>
      <div className="mt-1 flex items-center justify-center gap-2" aria-hidden>
        <span className="h-px w-12 bg-[#C9A35A]/60" />
        <span className="h-1.5 w-1.5 rotate-45 bg-[#C9A35A]" />
        <span className="h-px w-12 bg-[#C9A35A]/60" />
      </div>
    </figure>
  );
};
