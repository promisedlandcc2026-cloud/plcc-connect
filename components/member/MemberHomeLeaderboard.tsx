/**
 * Member Home: this season's check-in leaderboard (first name + last initial only).
 * Mirrors PLCC Vault components/Dashboard/HomeLeaderboard.tsx and uses the
 * current season accent. Compact: top 3 + your spot; My QR lives in the header
 * shortcuts. Renders nothing if points aren't available.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanLine } from 'lucide-react';
import { fetchLeaderboard, SCAN_IN_ROUTE, type Leaderboard } from '../../lib/checkinPointsClient';
import { SectionHeader } from '../ui/SectionHeader';

const MEDALS = ['🥇', '🥈', '🥉'];

export const MemberHomeLeaderboard: React.FC = () => {
  const navigate = useNavigate();
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchLeaderboard()
      .then((b) => {
        if (alive) setBoard(b);
      })
      .catch(() => {
        if (alive) setHidden(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (hidden || !board) return null;

  const shown = board.leaders.slice(0, 3);
  const meOnBoard = shown.some((l) => l.isMe);

  return (
    <section id="leaderboard" className="scroll-mt-24 space-y-2" aria-labelledby="home-leaderboard-title">
      <SectionHeader
        title="Leaderboard"
        id="home-leaderboard-title"
        className=""
        action={
          <span className="text-xs font-semibold text-ink-muted truncate">
            {board.season.emoji} {board.season.label}
          </span>
        }
      />
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {board.leaders.length === 0 ? (
          <p className="px-4 py-5 text-sm text-gray-600">
            Nobody’s on the board yet this season. Check in at the next gathering and claim the top spot.
          </p>
        ) : (
          <ol className="divide-y divide-gray-50">
            {shown.map((l) => (
              <li
                key={`${l.rank}-${l.name}`}
                className="flex items-center gap-3 px-4 py-2.5"
                style={l.isMe ? { background: 'var(--season-accent-soft, #fdf6d8)' } : undefined}
              >
                <span className="w-7 text-center text-base tabular-nums shrink-0" aria-label={`Rank ${l.rank}`}>
                  {l.rank <= 3 ? MEDALS[l.rank - 1] : <span className="text-sm font-black text-gray-500">{l.rank}</span>}
                </span>
                <span className="flex-1 min-w-0 truncate text-sm text-ink font-semibold">
                  {l.name}
                  {l.isMe && <span className="ml-1.5 text-xs font-bold text-ink-muted">(you)</span>}
                </span>
                <span className="text-sm font-bold tabular-nums text-ink">{l.points}</span>
              </li>
            ))}
          </ol>
        )}

        <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-600 min-w-0">
            {board.me && !meOnBoard
              ? board.me.showOnLeaderboard
                ? board.me.rank
                  ? `You’re #${board.me.rank} with ${board.me.points} points.`
                  : 'Check in to start earning.'
                : `You have ${board.me.points} points (hidden).`
              : 'Check in at church to climb.'}
          </p>
          <button
            type="button"
            onClick={() => navigate(SCAN_IN_ROUTE)}
            className="shrink-0 inline-flex items-center gap-1.5 min-h-[44px] text-xs font-bold text-burgundy"
          >
            <ScanLine size={14} aria-hidden /> Scan the room code
          </button>
        </div>
      </div>
    </section>
  );
};
