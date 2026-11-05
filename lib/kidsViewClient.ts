/**
 * Kids View + PLCC Bucks wallet (read-only) via the family-huddle bridge.
 * Children are selected by opaque cardRef only; Connect never sends a child id.
 */
import { getValidAccessToken, refreshAccessToken } from './authAccessToken';
import { isDependentCardRef } from './dependentCardRef';

export type KidsTheme = 'soft_garden' | 'adventure';

export const KIDS_THEME_OPTIONS: Array<{ value: KidsTheme; label: string }> = [
  { value: 'soft_garden', label: 'Soft Garden' },
  { value: 'adventure', label: 'Adventure' },
];

export type KidsBadgeCategory = 'checkins' | 'streak' | 'points' | 'midweek';
export type KidsBadgeTier = 'bronze' | 'silver' | 'gold' | 'diamond';

export type KidsBadge = {
  id: string;
  name: string;
  description: string;
  category: KidsBadgeCategory;
  tier: KidsBadgeTier;
  goal: number;
  progress: number;
  earned: boolean;
  earnedAt: string | null;
};

export type KidsLevel = {
  level: number;
  title: string;
  points: number;
  levelStart: number;
  nextLevelAt: number | null;
};

export type BucksHistoryLine = {
  id: string;
  kind: 'award' | 'reversal' | 'redemption' | 'recovery';
  amount: number;
  reasonLabel: string;
  awardedBy: string;
  createdAt: string;
  reversed: boolean;
};

export type BucksRequestStatus = 'requested' | 'approved' | 'fulfilled' | 'rejected' | 'cancelled';

export type BucksRequestLine = {
  id: string;
  prizeName: string;
  price: number;
  status: BucksRequestStatus;
};

export type BucksWallet = {
  balance: number;
  totalEarned: number;
  onHold: number;
  outstandingCorrection: number;
  history: BucksHistoryLine[];
  requests: BucksRequestLine[];
};

export const BUCKS_COIN = {
  sm: '/images/awc-bucks/coin-64.png',
  md: '/images/awc-bucks/coin-128.png',
  lg: '/images/awc-bucks/coin-256.png',
};

export type KidsViewData = {
  child: { firstName: string; name: string; age: number | null; theme: KidsTheme };
  stats: {
    weekStreak: number;
    totalCheckins: number;
    lastCheckinAt: string | null;
    lifetimePoints: number;
    pointsThisWeek: number;
  };
  weeklyPoints: Array<{ weekStart: string; points: number }>;
  card: { qrPayload: string; cardNumber: string | null } | null;
  /** Null until Vault has run the PLCC Bucks migration. */
  bucks: BucksWallet | null;
  badges: KidsBadge[];
  level: KidsLevel;
  themeReady: boolean;
};

export class KidsViewError extends Error {
  status: number;
  code: string;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'KidsViewError';
    this.code = code;
    this.status = status;
  }
}

const BRIDGE = '/api/family-huddle';

async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getValidAccessToken();
  if (!token) throw new KidsViewError('session_missing', 'Please sign in again to continue.', 401);
  const doFetch = (bearer: string) =>
    fetch(path, {
      ...init,
      headers: { Accept: 'application/json', ...(init?.headers || {}), Authorization: `Bearer ${bearer}` },
    });
  try {
    let res = await doFetch(token);
    if (res.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) res = await doFetch(refreshed);
    }
    return res;
  } catch {
    throw new KidsViewError('network', 'Kids View is temporarily unavailable. Please try again.', 0);
  }
}

async function errorFrom(res: Response): Promise<KidsViewError> {
  let code = '';
  let message = '';
  try {
    const body = (await res.json()) as { code?: unknown; message?: unknown };
    if (typeof body.code === 'string') code = body.code;
    if (typeof body.message === 'string') message = body.message;
  } catch {
    /* non-JSON */
  }
  if (res.status === 401) return new KidsViewError('unauthorized', 'Please sign in again to continue.', 401);
  if (res.status === 403) {
    return new KidsViewError(code || 'forbidden', message || 'Kids View is only for this child’s household.', 403);
  }
  if (res.status === 404) return new KidsViewError('not_found', 'We could not find that child’s card.', 404);
  if (res.status === 400) {
    return new KidsViewError(code || 'invalid', message || 'Kids View is not available for this child yet.', 400);
  }
  return new KidsViewError(
    code || 'vault_unavailable',
    message && res.status === 503 ? message : 'Kids View is temporarily unavailable. Please try again.',
    res.status
  );
}

export async function fetchKidsView(cardRef: string): Promise<KidsViewData> {
  if (!isDependentCardRef(cardRef)) {
    throw new KidsViewError('invalid_card_ref', 'That child card link is not valid.', 400);
  }
  const res = await authedFetch(`${BRIDGE}?resource=kids-view&cardRef=${encodeURIComponent(cardRef)}`);
  if (!res.ok) throw await errorFrom(res);
  const body = (await res.json()) as KidsViewData & { ok?: boolean };
  if (!body || body.ok === false || !body.child || !body.level) {
    throw new KidsViewError('invalid_upstream', 'Kids View was unexpected. Please try again.', 502);
  }
  return body;
}

export async function saveKidsTheme(cardRef: string, kidsTheme: KidsTheme): Promise<KidsTheme> {
  if (!isDependentCardRef(cardRef)) {
    throw new KidsViewError('invalid_card_ref', 'That child card link is not valid.', 400);
  }
  const res = await authedFetch(`${BRIDGE}?resource=kids-theme`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardRef, kidsTheme }),
  });
  if (!res.ok) throw await errorFrom(res);
  return kidsTheme;
}
