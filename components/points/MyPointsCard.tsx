/**
 * Me tab: this season's points ring, rank, the season podium, recent awards,
 * and the leaderboard opt-out. Data mirrors PLCC Canaan components/points/MyPointsCard.tsx.
 * Renders nothing if points aren't available, so it never breaks the page.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, QrCode } from 'lucide-react';
import {
  fetchLeaderboard,
  fetchMyPoints,
  SCAN_IN_ROUTE,
  setShowOnLeaderboard,
  type Leaderboard,
  type MyPoints,
} from '../../lib/checkinPointsClient';
import { MyPassQrModal } from './MyPassQrModal';
import { SeasonPodium } from '../sanctuary/SeasonPodium';

/** Ring around the season total — how close you are to the top of the board. */
const PointsRing: React.FC<{ points: number; leaderPoints: number }> = ({ points, leaderPoints }) => {
  const size = 86;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const fraction = leaderPoints > 0 ? Math.min(1, points / leaderPoints) : points > 0 ? 1 : 0;
  return (
    <div role="img" aria-label={`${points} points this season`} className="relative shrink-0" style={{ width: size, height: size }}>
      <svg aria-hidden width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F3E8DA" strokeWidth={stroke} />
        <circle
          className="awc-ring__fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--season-accent, #1d372c)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0.03, fraction))}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-2xl font-extrabold tabular-nums text-ink">{points}</span>
        <span className="mt-1 text-xs font-semibold text-ink-soft">points</span>
      </div>
    </div>
  );
};

export const MyPointsCard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<MyPoints | null>(null);
  const [hidden, setHidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [board, setBoard] = useState<Leaderboard | null>(null);

  useEffect(() => {
    let alive = true;
    fetchLeaderboard()
      .then((b) => {
        if (alive) setBoard(b);
      })
      .catch(() => undefined);
    fetchMyPoints()
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {
        if (alive) setHidden(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (hidden) return null;

  if (!data) {
    return (
      <div
        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center justify-center text-gray-500"
        role="status"
        aria-label="Loading your points"
      >
        <Loader2 className="animate-spin" size={18} aria-hidden />
      </div>
    );
  }

  const s = data.summary;

  const toggleShow = async () => {
    if (!s) return;
    setSaving(true);
    setError(null);
    try {
      const { showOnLeaderboard } = await setShowOnLeaderboard(!s.showOnLeaderboard);
      setData({ ...data, summary: { ...s, showOnLeaderboard, rank: showOnLeaderboard ? s.rank : null } });
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const leaderPoints = board?.leaders.find((l) => l.rank === 1)?.points ?? 0;
  const rankLine = s
    ? s.rank
      ? `#${s.rank} on the board`
      : s.showOnLeaderboard
        ? 'Check in to get on the board'
        : 'Hidden from the leaderboard'
    : 'Check in to get on the board';

  return (
    <section
      aria-labelledby="my-points-heading"
      className="rounded-3xl border border-[#EEE5DA] bg-white p-[18px] shadow-[0_8px_24px_rgba(26,26,26,0.05)]"
    >
      <div className="flex items-center gap-4">
        <PointsRing points={s ? s.seasonPoints : 0} leaderPoints={leaderPoints} />
        <div className="min-w-0">
          <p id="my-points-heading" className="text-xs font-extrabold uppercase tracking-[0.1em]" style={{ color: 'var(--season-accent, #1d372c)' }}>
            {data.season.label} season
          </p>
          <p className="mt-1 font-display text-[22px] font-bold leading-tight text-ink">{rankLine}</p>
          {data.linked && s ? (
            <p className="mt-1 text-sm text-ink-soft">
              {s.checkins} check-in{s.checkins === 1 ? '' : 's'} · {s.lifetimePoints} all time
            </p>
          ) : null}
        </div>
      </div>

      {board && board.leaders.length ? <SeasonPodium board={board} /> : null}

      {!data.linked ? (
        <p className="mt-4 text-sm text-ink-muted">
          Points show up once your login is linked to your church record. Ask a leader to link it.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setShowQr(true)}
              className="min-h-[46px] rounded-[15px] bg-burgundy px-2 text-white text-[13px] font-bold whitespace-nowrap inline-flex items-center justify-center gap-1.5"
            >
              <QrCode size={16} aria-hidden /> Show my QR
            </button>
            <button
              type="button"
              onClick={() => navigate(SCAN_IN_ROUTE)}
              className="min-h-[46px] rounded-[15px] border-[1.5px] border-burgundy/25 bg-white px-2 text-burgundy text-[13px] font-bold whitespace-nowrap inline-flex items-center justify-center gap-1.5"
            >
              Scan the room code
            </button>
          </div>

          {data.history.length > 0 && (
            <ul className="space-y-1.5 border-t border-[#F1EAE1] pt-3 text-left">
              {data.history.slice(0, 4).map((h, i) => (
                <li key={`${h.at}-${h.reason}-${i}`} className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate text-ink-muted">
                    <span className="font-bold text-ink">{h.label}</span>
                    {h.sessionTitle && <span> · {h.sessionTitle}</span>}
                  </span>
                  <span
                    className={`font-extrabold tabular-nums shrink-0 ${h.points < 0 ? 'text-red-700' : 'text-burgundy'}`}
                  >
                    {h.points > 0 ? '+' : ''}
                    {h.points}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {s && (
            <label className="flex min-h-[44px] items-center justify-between gap-3 text-left cursor-pointer">
              <span className="text-sm font-semibold text-ink">Show me on the leaderboard</span>
              <input
                type="checkbox"
                className="h-5 w-5 accent-[#1d372c]"
                checked={s.showOnLeaderboard}
                disabled={saving}
                onChange={() => void toggleShow()}
              />
            </label>
          )}
          {error && (
            <p role="alert" className="text-xs font-semibold text-red-700">
              {error}
            </p>
          )}
        </div>
      )}
      <MyPassQrModal open={showQr} onClose={() => setShowQr(false)} />
    </section>
  );
};
