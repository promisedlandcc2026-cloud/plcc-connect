import React, { useEffect, useState } from 'react';
import { MemberHomeSection } from './MemberHomeSection';
import { BlessingSheet } from './BlessingSheet';
import { cardInitials } from '../../lib/memberCardUi';
import { listCelebrations } from '../../lib/celebrationsClient';
import { celebrationEmoji, celebrationTitle, whenLabel, type Celebration } from '../../lib/blessings';

/**
 * "Celebrating this week" — church family birthdays & anniversaries in the
 * next 7 days, each with a Send a blessing button. Hides itself when empty.
 */
export const MemberHomeCelebrations: React.FC = () => {
  const [items, setItems] = useState<Celebration[]>([]);
  const [open, setOpen] = useState<Celebration | null>(null);

  useEffect(() => {
    let alive = true;
    listCelebrations(7)
      .then((list) => alive && setItems(list))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <MemberHomeSection id="celebrations" title="Birthdays & anniversaries">
      <ul className="space-y-2">
        {items.slice(0, 8).map((c) => (
          <li
            key={`${c.directoryId}-${c.occasion}`}
            className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm"
          >
            {c.avatarUrl ? (
              <img src={c.avatarUrl} alt="" className="h-11 w-11 shrink-0 rounded-2xl object-cover" />
            ) : (
              <span className="h-11 w-11 shrink-0 rounded-2xl bg-burgundy/5 text-burgundy border border-burgundy/10 flex items-center justify-center text-xs font-black" aria-hidden>
                {cardInitials(c.displayName)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-bold text-ink truncate">{c.displayName}</p>
              <p className="text-xs text-gray-500 truncate">
                <span aria-hidden>{celebrationEmoji(c)} </span>
                {celebrationTitle(c)} · <span className={c.daysAway === 0 ? 'font-bold text-burgundy' : ''}>{whenLabel(c.daysAway)}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(c)}
              aria-label={`Send a blessing to ${c.displayName}`}
              className="shrink-0 min-h-[44px] rounded-xl bg-burgundy px-3 text-xs font-bold text-white"
            >
              💌 Bless
            </button>
          </li>
        ))}
      </ul>
      {items.length > 8 ? (
        <p className="text-xs text-gray-500 text-center">+{items.length - 8} more in the Directory</p>
      ) : null}
      <BlessingSheet celebration={open} onClose={() => setOpen(null)} />
    </MemberHomeSection>
  );
};
