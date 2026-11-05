/**
 * Check-in points + member pass + church season — Connect bridge sanitizers.
 * Pure helpers (no I/O). Vault owns the point rules, the ledger, and QR signing;
 * Connect only validates what it forwards and whitelists what it returns.
 */

const SEASON_KEY_RE = /^\d{4}-(fall|winter|spring|summer)$/;
const MEMBER_PASS_RE = /^AWC1\.[0-9a-f]{64}$/;
const ACCESS_CODE_RE = /^\d{4,8}$/;

export const MAX_SCAN_CODE_LENGTH = 600;
export const MAX_POINTS_BODY_BYTES = 2048;
export const MAX_HISTORY_ROWS = 15;
export const MAX_LEADERS = 10;

/** Member-facing bridge resources. `self-qr` (leader) is intentionally absent. */
export const POINTS_RESOURCES = Object.freeze([
  'my-points',
  'leaderboard',
  'self-check-in',
  'member-pass',
  'season',
]);

export const SEASONAL_MODES = Object.freeze([
  'automatic',
  'off',
  'fall',
  'winter',
  'spring',
  'summer',
  'thanksgiving',
  'christmas',
  'new_year',
  'easter',
  'anniversary',
]);

/** Vault error codes whose friendly `error` text Connect may show as-is. */
export const VAULT_POINTS_CODES = Object.freeze([
  'invalid_code',
  'membership_card',
  'code_expired',
  'session_not_open',
  'session_closed',
  'session_not_found',
  'session_type_not_allowed',
  'member_link_required',
  'member_link_conflict',
  'member_not_found',
  'rate_limited',
  'points_unavailable',
  'forbidden',
]);

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function cleanText(value, max) {
  if (value == null) return null;
  const s = String(value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  if (!s) return null;
  return s.slice(0, max);
}

function int(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function isoOrNull(value) {
  if (typeof value !== 'string') return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function parsePointsResource(raw) {
  const value = String(raw || '').trim().toLowerCase();
  return POINTS_RESOURCES.includes(value) ? value : '';
}

export function sanitizeSeason(raw) {
  const r = asRecord(raw);
  if (!r) return null;
  const key = String(r.key || '');
  if (!SEASON_KEY_RE.test(key)) return null;
  return {
    key,
    label: cleanText(r.label, 40) || 'This season',
    emoji: cleanText(r.emoji, 8) || '⭐',
  };
}

export function sanitizeSummary(raw) {
  const r = asRecord(raw);
  if (!r) return null;
  const rank = r.rank == null ? null : int(r.rank, 0);
  return {
    seasonPoints: int(r.seasonPoints),
    lifetimePoints: int(r.lifetimePoints),
    checkins: Math.max(0, int(r.checkins)),
    showOnLeaderboard: r.showOnLeaderboard !== false,
    rank: rank && rank > 0 ? rank : null,
  };
}

function sanitizeAward(raw) {
  const r = asRecord(raw);
  if (!r) return null;
  const points = int(r.points);
  if (!points) return null;
  return {
    reason: cleanText(r.reason, 32) || 'points',
    label: cleanText(r.label, 60) || 'Points',
    points,
    note: cleanText(r.note, 200),
  };
}

export function parseMyPointsResponse(body) {
  const r = asRecord(body);
  if (!r || r.ok === false) return { ok: false };
  const season = sanitizeSeason(r.season);
  if (!season) return { ok: false };
  const linked = r.linked === true;
  const history = (Array.isArray(r.history) ? r.history : [])
    .slice(0, MAX_HISTORY_ROWS)
    .map((row) => {
      const h = asRecord(row);
      if (!h) return null;
      const at = isoOrNull(h.at);
      if (!at) return null;
      return {
        label: cleanText(h.label, 60) || 'Points',
        reason: cleanText(h.reason, 32) || 'points',
        points: int(h.points),
        note: cleanText(h.note, 200),
        sessionTitle: cleanText(h.sessionTitle, 120),
        at,
      };
    })
    .filter(Boolean);
  return {
    ok: true,
    linked,
    season,
    summary: linked ? sanitizeSummary(r.summary) : null,
    history: linked ? history : [],
  };
}

export function parseLeaderboardResponse(body) {
  const r = asRecord(body);
  if (!r || r.ok === false) return { ok: false };
  const season = sanitizeSeason(r.season);
  if (!season) return { ok: false };
  const leaders = (Array.isArray(r.leaders) ? r.leaders : [])
    .slice(0, MAX_LEADERS)
    .map((row) => {
      const l = asRecord(row);
      if (!l) return null;
      const rank = int(l.rank);
      if (rank < 1) return null;
      return {
        rank,
        // Vault already sends first name + last initial; cap length defensively.
        name: cleanText(l.name, 40) || 'Member',
        points: int(l.points),
        isMe: l.isMe === true,
      };
    })
    .filter(Boolean);
  const me = asRecord(r.me);
  return {
    ok: true,
    season,
    leaders,
    me: me
      ? {
          points: int(me.points),
          rank: me.rank == null || int(me.rank) < 1 ? null : int(me.rank),
          showOnLeaderboard: me.showOnLeaderboard !== false,
        }
      : null,
  };
}

export function parseSelfCheckinResponse(body) {
  const r = asRecord(body);
  if (!r || r.ok !== true) return { ok: false };
  const season = sanitizeSeason(r.season);
  if (!season) return { ok: false };
  const awards = (Array.isArray(r.awards) ? r.awards : []).slice(0, 10).map(sanitizeAward).filter(Boolean);
  return {
    ok: true,
    alreadyCheckedIn: r.alreadyCheckedIn === true,
    sessionTitle: cleanText(r.sessionTitle, 120) || 'Check-in',
    pointsEnabled: r.pointsEnabled === true,
    awards,
    pointsEarned: awards.reduce((sum, a) => sum + a.points, 0),
    season,
    summary: sanitizeSummary(r.summary),
  };
}

/** Keep only the scannable pass + backup code. Never the member id. */
export function parseMemberPassResponse(body) {
  const r = asRecord(body);
  if (!r || r.ok !== true) return { ok: false };
  const qrPayload = String(r.qrPayload || '').trim();
  if (!MEMBER_PASS_RE.test(qrPayload)) return { ok: false };
  const accessCode = String(r.accessCode || '').trim();
  return {
    ok: true,
    qrPayload,
    accessCode: ACCESS_CODE_RE.test(accessCode) ? accessCode : null,
  };
}

/** Same rules as Vault lib/seasons/theme.ts parseSeasonalSettings. */
export function sanitizeSeasonalSettings(raw) {
  const r = asRecord(raw) || {};
  const mode = SEASONAL_MODES.includes(r.mode) ? r.mode : 'automatic';
  const effects = r.effects !== false;
  const month = Number(r.anniversaryMonth);
  const day = Number(r.anniversaryDay);
  const okMonth = Number.isInteger(month) && month >= 1 && month <= 12;
  const okDay = Number.isInteger(day) && day >= 1 && day <= 31;
  return {
    mode,
    effects,
    anniversaryMonth: okMonth && okDay ? month : null,
    anniversaryDay: okMonth && okDay ? day : null,
  };
}

/** From Vault's full system settings, return only the seasonal block. */
export function parseSystemSettingsSeasonal(body) {
  const r = asRecord(body);
  const settings = r && asRecord(r.settings);
  if (!settings) return { ok: false };
  return { ok: true, seasonal: sanitizeSeasonalSettings(settings.seasonal) };
}

export function parseSelfCheckinCommand(body) {
  const r = asRecord(body);
  if (!r) return { ok: false, reason: 'invalid_body' };
  const keys = Object.keys(r);
  if (keys.length !== 1 || keys[0] !== 'code') return { ok: false, reason: 'invalid_body' };
  if (typeof r.code !== 'string') return { ok: false, reason: 'invalid_code' };
  const code = r.code.trim();
  if (!code || code.length > MAX_SCAN_CODE_LENGTH) return { ok: false, reason: 'invalid_code' };
  return { ok: true, code };
}

export function parsePointsPrefsCommand(body) {
  const r = asRecord(body);
  if (!r) return { ok: false };
  const keys = Object.keys(r);
  if (keys.length !== 1 || keys[0] !== 'showOnLeaderboard') return { ok: false };
  if (typeof r.showOnLeaderboard !== 'boolean') return { ok: false };
  return { ok: true, showOnLeaderboard: r.showOnLeaderboard };
}

/**
 * Map a non-2xx Vault reply to a safe Connect reply.
 * @param {number} status
 * @param {unknown} body
 * @param {string} fallbackMessage
 */
export function mapPointsUpstreamError(status, body, fallbackMessage) {
  const r = asRecord(body) || {};
  const code = String(r.code || '');
  if (status === 401) {
    return { status: 401, code: 'unauthorized', message: 'Please sign in again to continue.' };
  }
  if (VAULT_POINTS_CODES.includes(code)) {
    const message = cleanText(r.error, 300) || fallbackMessage;
    const safeStatus = [400, 403, 404, 409, 410, 429, 503].includes(status) ? status : 400;
    return { status: safeStatus, code, message };
  }
  if (status === 403) {
    return { status: 403, code: 'forbidden', message: 'Your account can’t use check-in points yet.' };
  }
  if (status === 404) {
    // e.g. member-pass "No church record is linked to this login."
    return {
      status: 404,
      code: 'not_linked',
      message: cleanText(r.error, 200) || 'Your login isn’t linked to your church record yet.',
    };
  }
  if (status === 429) {
    return { status: 429, code: 'rate_limited', message: 'Too many tries. Wait a moment and try again.' };
  }
  return { status: 502, code: 'vault_unavailable', message: fallbackMessage };
}
