import React from 'react';
import { ANNIVERSARY_LABEL_MAX, OTHER_ANNIVERSARY_IDEAS, type AnniversaryKind } from '../../lib/blessings';

type Props = {
  kind: AnniversaryKind | null;
  label: string;
  onKind: (kind: AnniversaryKind) => void;
  onLabel: (label: string) => void;
};

/** "What are you celebrating?" — Wedding, or Other with the member's own name for it. */
export const AnniversaryKindPicker: React.FC<Props> = ({ kind, label, onKind, onLabel }) => {
  const chip = (active: boolean) =>
    `min-h-[48px] rounded-xl border-2 px-3 text-sm font-bold transition-colors ${
      active ? 'border-burgundy bg-burgundy text-white' : 'border-gray-200 bg-white text-[#1A1A1A]'
    }`;

  return (
    <div className="space-y-2" role="group" aria-labelledby="anniversary-kind-heading">
      <span id="anniversary-kind-heading" className="block text-xs font-black uppercase tracking-widest text-gold-ink">
        What is this anniversary?
      </span>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" aria-pressed={kind === 'wedding'} onClick={() => onKind('wedding')} className={chip(kind === 'wedding')}>
          💍 Wedding
        </button>
        <button type="button" aria-pressed={kind === 'other'} onClick={() => onKind('other')} className={chip(kind === 'other')}>
          ✨ Other
        </button>
      </div>
      {kind === 'other' ? (
        <div className="space-y-2">
          <input
            value={label}
            onChange={(e) => onLabel(e.target.value)}
            maxLength={ANNIVERSARY_LABEL_MAX}
            aria-label="Name your anniversary"
            placeholder="Name it, e.g. Salvation"
            className="w-full min-h-[48px] rounded-xl bg-gray-50 px-3 text-base font-semibold text-[#1A1A1A] outline-none focus:ring-2 focus:ring-gold/40"
          />
          <div className="flex flex-wrap gap-1.5">
            {OTHER_ANNIVERSARY_IDEAS.map((idea) => (
              <button
                key={idea}
                type="button"
                onClick={() => onLabel(idea)}
                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-burgundy"
              >
                {idea}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <span className="block text-xs text-gray-500">
        Your birthday has its own field above. Church family can send you a blessing on your day if you show it in the directory.
      </span>
    </div>
  );
};
