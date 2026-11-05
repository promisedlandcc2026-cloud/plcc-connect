/**
 * Check-in points client — profile points, Home leaderboard, room-code check-in,
 * and the member's own membership QR. Everything goes through the same-origin
 * bridge /api/checkin-points → PLCC Canaan (point rules + QR signing stay there).
 * Types match PLCC Canaan lib/checkinPointsClient.ts.
 */
import { getValidAccessToken, refreshAccessToken } from './authAccessToken';

export type PointsSeason = { key: string; label: string; emoji: string };

export type PointsSummary = {
  seasonPoints: number;
  lifetimePoints: number;
  checkins: number;
  showOnLeaderboard: boolean;
  rank: number | null;
};

export type AwardLine = { reason: string; label: string; points: number; note: string | null };

export type SelfCheckinResult = {
  alreadyCheckedIn: boolean;
  sessionTitle: string;
  pointsEnabled: boolean;
  awards: AwardLine[];
  pointsEarned: number;
  season: PointsSeason;
  summary: PointsSummary | null;
};

export type PointsHistoryRow = {
  label: string;
  reason: string;
  points: number;
  note: string | null;
  sessionTitle: string | null;
  at: string;
};

export type MyPoints = {
  linked: boolean;
  season: PointsSeason;
  summary: PointsSummary | null;
  history: PointsHistoryRow[];
};

export type LeaderRow = { rank: number; name: string; points: number; isMe: boolean };

export type Leaderboard = {
  season: PointsSeason;
  leaders: LeaderRow[];
  me: { points: number; rank: number | null; showOnLeaderboard: boolean } | null;
};

export type MemberPass = { qrPayload: string; accessCode: string | null };

export class PointsApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'PointsApiError';
    this.code = code;
    this.status = status;
  }
}

export const POINTS_BRIDGE = '/api/checkin-points';
export const SCAN_IN_ROUTE = '/scan-in';

async function call<T>(resource: string, init: RequestInit = {}): Promise<T> {
  const token = await getValidAccessToken();
  if (!token) throw new PointsApiError('Please sign in again to continue.', 'unauthorized', 401);
  const url = `${POINTS_BRIDGE}?resource=${encodeURIComponent(resource)}`;
  const headers = new Headers(init.headers || {});
  headers.set('Accept', 'application/json');
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');

  let res = await fetch(url, { ...init, headers });
  if (res.status === 401 && (await refreshAccessToken())) {
    const next = await getValidAccessToken();
    if (next) {
      headers.set('Authorization', `Bearer ${next}`);
      res = await fetch(url, { ...init, headers });
    }
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || data?.ok === false) {
    throw new PointsApiError(
      String(data?.message || 'Something went wrong. Try again.'),
      String(data?.code || 'error'),
      res.status
    );
  }
  return data as T;
}

export function fetchMyPoints() {
  return call<MyPoints>('my-points');
}

export function setShowOnLeaderboard(showOnLeaderboard: boolean) {
  return call<{ showOnLeaderboard: boolean }>('my-points', {
    method: 'PATCH',
    body: JSON.stringify({ showOnLeaderboard }),
  });
}

export function fetchLeaderboard() {
  return call<Leaderboard>('leaderboard');
}

export function selfCheckIn(code: string) {
  return call<SelfCheckinResult>('self-check-in', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export function fetchMemberPass() {
  return call<MemberPass>('member-pass');
}
