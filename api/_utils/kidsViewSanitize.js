/**
 * Kids View (Vault parent dependents) → Connect. Fail-closed whitelist.
 *
 * Connect selects a child by opaque cardRef only. The response never carries
 * members.id, household ids, ledger ids, or any field not listed here.
 * PLCC Bucks is read-only on Connect (leaders award on Vault).
 */

export const KIDS_THEMES = Object.freeze(['soft_garden', 'adventure']);
export const KIDS_CARD_REF_RE = /^AWCD\.[0-9a-f]{64}$/;
export const KIDS_QR_RE = /^AWC1\.[0-9a-f]{64}$/;
export const KIDS_CARD_NUMBER_RE = /^PLCC-[0-9]{4}-[0-9]{5,}$/;
export const MAX_KIDS_THEME_BODY_BYTES = 512;

const BADGE_CATEGORIES = new Set(['checkins', 'streak', 'points', 'midweek']);
const BADGE_TIERS = new Set(['bronze', 'silver', 'gold', 'diamond']);
const UUID_ANYWHERE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const MAX_BADGES = 64;
const MAX_WEEKS = 26;
const MAX_HISTORY = 25;

function isObj(v) {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

/** Short display text; UUID-looking strings are dropped. */
function text(v, max) {
  if (typeof v !== 'string') return null;
  const t = v.trim().slice(0, max);
  if (!t || UUID_ANYWHERE.test(t)) return null;
  return t;
}

function int(v, { min = 0, max = 1e9 } = {}) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function iso(v) {
  if (typeof v !== 'string' || !v.trim()) return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function day(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

/** @param {unknown} v */
export function normalizeKidsTheme(v) {
  const s = String(v ?? '').trim().toLowerCase();
  return KIDS_THEMES.includes(s) ? s : null;
}

/** @param {unknown} v */
export function parseKidsCardRef(v) {
  const s = typeof v === 'string' ? v.trim() : Array.isArray(v) ? String(v[0] ?? '').trim() : '';
  return KIDS_CARD_REF_RE.test(s) ? s : null;
}

function sanitizeLevel(raw) {
  if (!isObj(raw)) return null;
  const level = int(raw.level, { min: 1, max: 999 });
  const title = text(raw.title, 40);
  const points = int(raw.points);
  const levelStart = int(raw.levelStart);
  if (level == null || !title || points == null || levelStart == null) return null;
  const nextLevelAt = raw.nextLevelAt == null ? null : int(raw.nextLevelAt);
  return { level, title, points, levelStart, nextLevelAt };
}

function sanitizeBadge(raw) {
  if (!isObj(raw)) return null;
  const id = typeof raw.id === 'string' && /^[a-z0-9-]{1,40}$/.test(raw.id) ? raw.id : null;
  const name = text(raw.name, 40);
  const description = text(raw.description, 120) || '';
  const category = BADGE_CATEGORIES.has(raw.category) ? raw.category : null;
  const tier = BADGE_TIERS.has(raw.tier) ? raw.tier : null;
  const goal = int(raw.goal, { min: 1 });
  if (!id || !name || !category || !tier || goal == null) return null;
  const progress = Math.min(goal, int(raw.progress) ?? 0);
  const earned = raw.earned === true;
  return { id, name, description, category, tier, goal, progress, earned, earnedAt: earned ? iso(raw.earnedAt) : null };
}

function sanitizeCard(raw) {
  if (!isObj(raw)) return null;
  const qrPayload = typeof raw.qrPayload === 'string' && KIDS_QR_RE.test(raw.qrPayload) ? raw.qrPayload : null;
  if (!qrPayload) return null;
  const cardNumber =
    typeof raw.cardNumber === 'string' && KIDS_CARD_NUMBER_RE.test(raw.cardNumber) ? raw.cardNumber : null;
  return { qrPayload, cardNumber };
}

const BUCKS_KINDS = new Set(['award', 'reversal', 'redemption', 'recovery']);
const REQUEST_STATUS = new Set(['requested', 'approved', 'fulfilled', 'rejected', 'cancelled']);

function sanitizeBucks(raw) {
  if (!isObj(raw)) return null;
  const balance = int(raw.balance, { min: -1e9 });
  const totalEarned = int(raw.totalEarned);
  if (balance == null || totalEarned == null) return null;
  const history = (Array.isArray(raw.history) ? raw.history : [])
    .slice(0, MAX_HISTORY)
    .map((line, i) => {
      if (!isObj(line)) return null;
      const kind = BUCKS_KINDS.has(line.kind) ? line.kind : null;
      const amount = int(line.amount, { min: -1e6, max: 1e6 });
      const createdAt = iso(line.createdAt);
      if (!kind || amount == null || !createdAt) return null;
      return {
        id: `b${i}`,
        kind,
        amount,
        reasonLabel: text(line.reasonLabel, 80) || 'PLCC Bucks',
        awardedBy: text(line.awardedBy, 60) || 'Kids Ministry',
        createdAt,
        reversed: line.reversed === true,
      };
    })
    .filter(Boolean);
  const requests = (Array.isArray(raw.requests) ? raw.requests : [])
    .slice(0, 10)
    .map((row, i) => {
      if (!isObj(row)) return null;
      const prizeName = text(row.prizeName, 80);
      const price = int(row.price, { min: 1, max: 10000 });
      const status = REQUEST_STATUS.has(row.status) ? row.status : null;
      if (!prizeName || price == null || !status) return null;
      return { id: `r${i}`, prizeName, price, status };
    })
    .filter(Boolean);
  return {
    balance,
    totalEarned,
    onHold: int(raw.onHold) ?? 0,
    outstandingCorrection: int(raw.outstandingCorrection) ?? 0,
    history,
    requests,
  };
}

/**
 * @param {unknown} raw Vault kids-view JSON
 * @returns {{ ok: true, view: object } | { ok: false, reason: string }}
 */
export function parseKidsViewResponse(raw) {
  if (!isObj(raw) || raw.ok === false) return { ok: false, reason: 'invalid' };
  const child = raw.child;
  if (!isObj(child)) return { ok: false, reason: 'invalid_child' };
  const firstName = text(child.firstName, 60) || 'Friend';
  const name = text(child.name, 120) || firstName;
  const age = child.age == null ? null : int(child.age, { min: 0, max: 29 });
  const theme = normalizeKidsTheme(child.theme) || 'soft_garden';

  const level = sanitizeLevel(raw.level);
  if (!level) return { ok: false, reason: 'invalid_level' };

  const s = isObj(raw.stats) ? raw.stats : {};
  const stats = {
    weekStreak: int(s.weekStreak) ?? 0,
    totalCheckins: int(s.totalCheckins) ?? 0,
    lastCheckinAt: iso(s.lastCheckinAt),
    lifetimePoints: int(s.lifetimePoints, { min: -1e9 }) ?? 0,
    pointsThisWeek: int(s.pointsThisWeek, { min: -1e9 }) ?? 0,
  };

  const weeklyPoints = (Array.isArray(raw.weeklyPoints) ? raw.weeklyPoints : [])
    .slice(-MAX_WEEKS)
    .map((w) => {
      if (!isObj(w)) return null;
      const weekStart = day(w.weekStart);
      return weekStart ? { weekStart, points: int(w.points, { min: -1e9 }) ?? 0 } : null;
    })
    .filter(Boolean);

  const badges = (Array.isArray(raw.badges) ? raw.badges : [])
    .slice(0, MAX_BADGES)
    .map(sanitizeBadge)
    .filter(Boolean);

  return {
    ok: true,
    view: {
      child: { firstName, name, age, theme },
      stats,
      weeklyPoints,
      card: sanitizeCard(raw.card),
      bucks: sanitizeBucks(raw.bucks),
      badges,
      level,
      themeReady: raw.themeReady === true,
    },
  };
}

/**
 * Theme-only body from the Connect client. Anything else is rejected.
 * @param {unknown} raw
 */
export function parseKidsThemeBody(raw) {
  if (!isObj(raw)) return { ok: false, reason: 'invalid_body' };
  const keys = Object.keys(raw);
  if (keys.some((k) => k !== 'cardRef' && k !== 'kidsTheme')) return { ok: false, reason: 'unexpected_field' };
  const cardRef = parseKidsCardRef(raw.cardRef);
  if (!cardRef) return { ok: false, reason: 'invalid_card_ref' };
  const kidsTheme = normalizeKidsTheme(raw.kidsTheme);
  if (!kidsTheme) return { ok: false, reason: 'invalid_theme' };
  return { ok: true, cardRef, kidsTheme };
}
