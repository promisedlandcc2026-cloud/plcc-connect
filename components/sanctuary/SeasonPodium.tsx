/**
 * Season podium — the top three on this season's check-in leaderboard
 * (first name + last initial, as the bridge returns them), 2 · 1 · 3.
 */
import React from 'react';
import type { Leaderboard } from '../../lib/checkinPointsClient';

const HEIGHTS = { 1: 'h-[74px]', 2: 'h-[54px]', 3: 'h-10' } as const;

export const SeasonPodium: React.FC<{ board: Leaderboard }> = ({ board }) => {
  const top = board.leaders.filter((l) => l.rank >= 1 && l.rank <= 3).slice(0, 3);
  if (top.length < 2) return null;
  const byRank = (r: number) => top.find((l) => l.rank === r);
  const order = [byRank(2), byRank(1), byRank(3)].filter(Boolean) as typeof top;
  const meInTop = top.some((l) => l.isMe);

  return (
    <div className="mt-4">
      <ol aria-label="Top three this season" className="grid grid-cols-3 items-end gap-2">
        {order.map((l) => {
          const first = l.rank === 1;
          const tone = l.isMe
            ? 'bg-burgundy text-white'
            : first
              ? 'bg-gradient-to-b from-leaf to-[#B8862B] text-wine'
              : 'bg-[#EFE6DA] text-[#5A606C]';
          return (
            <li key={`${l.rank}-${l.name}`} className="flex min-w-0 flex-col items-center gap-1.5">
              <span className={`max-w-full truncate text-[13px] ${l.isMe ? 'font-extrabold text-burgundy' : 'font-bold text-ink'}`}>
                {l.isMe ? 'You' : l.name}
              </span>
              <span
                className={`flex w-full items-center justify-center rounded-t-xl rounded-b-md text-lg font-extrabold ${HEIGHTS[l.rank as 1 | 2 | 3] || 'h-10'} ${tone}`}
                aria-label={`Number ${l.rank}, ${l.points} points`}
              >
                {l.rank}
              </span>
            </li>
          );
        })}
      </ol>
      {!meInTop && board.me?.rank ? (
        <p className="mt-2 text-center text-xs font-semibold text-ink-soft">
          You’re #{board.me.rank} with {board.me.points} points
        </p>
      ) : null}
    </div>
  );
};
