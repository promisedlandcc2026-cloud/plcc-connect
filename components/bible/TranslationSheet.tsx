import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';
import type { BibleTranslation, TranslationInfo } from '../../lib/bibleClient';

/**
 * Bottom sheet: choose a Bible (grouped by language, like the website's
 * /bible), and optionally a second Bible to show under each verse —
 * e.g. Bayibuli Entukuvu under the NIV. Same look as the book picker.
 */
export const TranslationSheet: React.FC<{
  list: TranslationInfo[];
  current: BibleTranslation;
  under: BibleTranslation | null;
  /** Hide the "under each verse" part (Bible home only switches the main Bible). */
  showUnder?: boolean;
  onPick: (id: BibleTranslation) => void;
  onUnder: (id: BibleTranslation | null) => void;
  onClose: () => void;
}> = ({ list, current, under, showUnder = true, onPick, onUnder, onClose }) => {
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

  const groups = useMemo(() => {
    const out: { label: string; items: TranslationInfo[] }[] = [];
    for (const t of list) {
      const g = out.find((x) => x.label === t.languageLabel);
      if (g) g.items.push(t);
      else out.push({ label: t.languageLabel, items: [t] });
    }
    return out;
  }, [list]);

  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose a Bible"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[500px] bg-white rounded-t-[28px] sm:rounded-[28px] shadow-2xl flex flex-col max-h-[88dvh] animate-in slide-in-from-bottom-8 duration-300"
      >
        <div className="shrink-0 flex items-center gap-2 px-5 pt-5 pb-3">
          <h2 className="flex-1 font-display text-[22px] font-bold text-ink truncate">Choose a Bible</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="h-11 w-11 -mr-2 inline-flex items-center justify-center rounded-full text-ink-soft active:bg-black/5">
            <X size={22} aria-hidden />
          </button>
        </div>

        {showUnder ? (
          <div className="shrink-0 px-5 pb-3">
            <label className="flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-200 bg-gold-cream px-3 text-sm font-semibold text-ink">
              <span className="shrink-0">Under each verse:</span>
              <select
                value={under ?? ''}
                onChange={(e) => onUnder(e.target.value || null)}
                className="min-w-0 flex-1 bg-transparent py-2 font-bold text-ink focus:outline-none"
              >
                <option value="">Nothing</option>
                {list
                  .filter((t) => t.id !== current)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.shortName} · {t.languageLabel}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        ) : null}

        <div className="overflow-y-auto px-5 pb-[max(20px,env(safe-area-inset-bottom))]">
          {groups.map((g) => (
            <section key={g.label} className="mb-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gold-ink">{g.label}</h3>
              <div className="flex flex-col gap-2">
                {g.items.map((t) => {
                  const active = t.id === current;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onPick(t.id)}
                      aria-pressed={active}
                      className={`flex min-h-[52px] items-center gap-3 rounded-2xl border px-4 py-2.5 text-left ${
                        active ? 'border-burgundy bg-burgundy/5' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <span className="w-14 shrink-0 text-[14px] font-extrabold text-burgundy">{t.shortName}</span>
                      <span className="min-w-0 flex-1 text-[14px] font-semibold text-ink leading-snug">{t.name}</span>
                      {active ? <Check size={18} className="shrink-0 text-burgundy" aria-hidden /> : null}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          {list.length <= 1 ? (
            <p className="pb-4 text-sm text-ink-soft">More Bibles appear here when you’re online.</p>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
};
