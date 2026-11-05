import React from 'react';
import { Link } from 'react-router-dom';
import { Sun } from 'lucide-react';
import { isLocalSunday } from '../../lib/sundayMode';
import { prefetchSundayChunk } from '../../lib/prefetchMemberChunks';

/**
 * Prominent Sunday Mode entry on approved Member Home — only on local Sunday.
 * Outside Sunday the route remains reachable from More.
 */
export const SundayModeBanner: React.FC = () => {
  if (!isLocalSunday()) return null;

  return (
    <section aria-labelledby="sunday-mode-banner-heading" className="pt-1">
      <Link
        to="/sunday"
        onFocus={() => prefetchSundayChunk()}
        onMouseEnter={() => prefetchSundayChunk()}
        onTouchStart={() => prefetchSundayChunk()}
        className="flex items-start gap-3 rounded-2xl border border-burgundy/20 bg-burgundy text-white px-4 py-4 min-h-[56px] shadow-sm active:scale-[0.99] transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 shrink-0">
          <Sun size={20} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="sunday-mode-banner-heading" className="text-base font-bold leading-snug">
            Sunday Mode
          </h2>
          <p className="mt-0.5 text-xs text-white/85 leading-relaxed">
            Watch, serve, pray, and give — focused for today.
          </p>
        </div>
        <span className="text-xs font-black uppercase tracking-widest text-gold shrink-0 self-center">
          Open
        </span>
      </Link>
    </section>
  );
};
