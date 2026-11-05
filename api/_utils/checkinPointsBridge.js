import { parseBearerAuthorization } from './memberIdentity.js';
import {
  MAX_POINTS_BODY_BYTES,
  mapPointsUpstreamError,
  parseLeaderboardResponse,
  parseMemberPassResponse,
  parseMyPointsResponse,
  parsePointsPrefsCommand,
  parsePointsResource,
  parseSelfCheckinCommand,
  parseSelfCheckinResponse,
  parseSystemSettingsSeasonal,
  sanitizeSeasonalSettings,
} from './checkinPointsSanitize.js';
import {
  buildVaultMemberPassUrl,
  buildVaultPointsUrl,
  buildVaultSystemSettingsUrl,
  parseVaultApiOrigin,
} from './vaultOrigin.js';

const TIMEOUT_MS = 12000;
const SEASON_TIMEOUT_MS = 6000;

const UNAVAILABLE = 'Check-in points are temporarily unavailable. Please try again.';
const PASS_UNAVAILABLE = 'Could not load your membership pass. Please try again.';
const CHECKIN_FAILED = 'Check-in didn’t go through. Ask a leader to check you in.';

function setNoStore(res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Pragma', 'no-cache');
}

function json(res, status, body) {
  res.status(status).json(body);
}

function fail(res, status, code, message) {
  return json(res, status, { ok: false, code, message });
}

function vaultOrigin() {
  const allowHttpLocal = process.env.NODE_ENV !== 'production';
  const parsed = parseVaultApiOrigin(process.env.VAULT_API_ORIGIN, { allowHttpLocal });
  if (!parsed.ok) {
    console.error('[checkin-points] VAULT_API_ORIGIN invalid:', parsed.reason);
    return null;
  }
  return parsed.origin;
}

function bodyTooLarge(raw) {
  if (raw === null) return true;
  try {
    return Buffer.byteLength(JSON.stringify(raw ?? {}), 'utf8') > MAX_POINTS_BODY_BYTES;
  } catch {
    return true;
  }
}

/**
 * Forward to a fixed Vault URL with the member's own Bearer token.
 * Never forwards cookies; never follows redirects; never logs the token.
 */
async function callVault(url, token, { method = 'GET', body, timeoutMs = TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const upstream = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      redirect: 'error',
    });
    let data = null;
    try {
      data = await upstream.json();
    } catch {
      data = null;
    }
    return { ok: upstream.ok, status: upstream.status, data };
  } finally {
    clearTimeout(timer);
  }
}

async function handleSeason(req, res) {
  // Theme must never break the page: always 200, defaults when unknown.
  const defaults = { ok: true, seasonal: sanitizeSeasonalSettings({}), source: 'default' };
  res.setHeader('Cache-Control', 'private, max-age=300');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return fail(res, 405, 'method_not_allowed', 'This endpoint only supports GET.');
  }
  const auth = parseBearerAuthorization(req.headers?.authorization);
  if (!auth.ok) return json(res, 200, defaults);
  const origin = vaultOrigin();
  if (!origin) return json(res, 200, defaults);
  try {
    const up = await callVault(buildVaultSystemSettingsUrl(origin), auth.token, {
      timeoutMs: SEASON_TIMEOUT_MS,
    });
    if (!up.ok) return json(res, 200, defaults);
    const parsed = parseSystemSettingsSeasonal(up.data);
    if (!parsed.ok) return json(res, 200, defaults);
    return json(res, 200, { ok: true, seasonal: parsed.seasonal, source: 'church' });
  } catch {
    return json(res, 200, defaults);
  }
}

/**
 * GET|PATCH|POST /api/checkin-points?resource=…  (Vercel rewrite → vault-news?bridge=points)
 *
 *   GET   my-points       → Vault attendance/my-points
 *   PATCH my-points       → { showOnLeaderboard }
 *   GET   leaderboard     → Vault attendance/points-leaderboard
 *   POST  self-check-in   → { code } (the leader's rotating room QR)
 *   GET   member-pass     → Vault people/member-pass (caller's own pass only)
 *   GET   season          → church seasonal setting (always 200; defaults for visitors)
 *
 * Leader routes (self-qr, points on/off) are never exposed from Connect.
 */
export async function handleCheckinPointsBridge(req, res) {
  setNoStore(res);
  const resource = parsePointsResource(req.query?.resource);
  if (!resource) {
    return fail(res, 404, 'not_found', 'Unknown points request.');
  }
  if (resource === 'season') return handleSeason(req, res);

  const method = String(req.method || 'GET').toUpperCase();
  const allowed =
    resource === 'my-points'
      ? ['GET', 'PATCH']
      : resource === 'self-check-in'
        ? ['POST']
        : ['GET'];
  if (!allowed.includes(method)) {
    res.setHeader('Allow', allowed.join(', '));
    return fail(res, 405, 'method_not_allowed', 'Method not allowed.');
  }

  const auth = parseBearerAuthorization(req.headers?.authorization);
  if (!auth.ok) return fail(res, 401, 'unauthorized', 'Please sign in again to continue.');

  const origin = vaultOrigin();
  if (!origin) {
    return fail(res, 503, 'bridge_unconfigured', 'Check-in points are not available right now.');
  }

  try {
    if (resource === 'member-pass') {
      const up = await callVault(buildVaultMemberPassUrl(origin), auth.token);
      if (!up.ok) {
        const e = mapPointsUpstreamError(up.status, up.data, PASS_UNAVAILABLE);
        return fail(res, e.status, e.code, e.message);
      }
      const pass = parseMemberPassResponse(up.data);
      if (!pass.ok) return fail(res, 502, 'invalid_upstream', PASS_UNAVAILABLE);
      return json(res, 200, { ok: true, qrPayload: pass.qrPayload, accessCode: pass.accessCode });
    }

    if (resource === 'leaderboard') {
      const up = await callVault(buildVaultPointsUrl(origin, 'points-leaderboard'), auth.token);
      if (!up.ok) {
        const e = mapPointsUpstreamError(up.status, up.data, UNAVAILABLE);
        return fail(res, e.status, e.code, e.message);
      }
      const board = parseLeaderboardResponse(up.data);
      if (!board.ok) return fail(res, 502, 'invalid_upstream', UNAVAILABLE);
      const { ok: _ok, ...rest } = board;
      return json(res, 200, { ok: true, ...rest });
    }

    if (resource === 'my-points' && method === 'GET') {
      const up = await callVault(buildVaultPointsUrl(origin, 'my-points'), auth.token);
      if (!up.ok) {
        const e = mapPointsUpstreamError(up.status, up.data, UNAVAILABLE);
        return fail(res, e.status, e.code, e.message);
      }
      const mine = parseMyPointsResponse(up.data);
      if (!mine.ok) return fail(res, 502, 'invalid_upstream', UNAVAILABLE);
      const { ok: _ok, ...rest } = mine;
      return json(res, 200, { ok: true, ...rest });
    }

    if (resource === 'my-points' && method === 'PATCH') {
      if (bodyTooLarge(req.body)) return fail(res, 413, 'payload_too_large', 'Request too large.');
      const cmd = parsePointsPrefsCommand(req.body);
      if (!cmd.ok) return fail(res, 400, 'invalid_body', 'Send showOnLeaderboard as true or false.');
      const up = await callVault(buildVaultPointsUrl(origin, 'my-points'), auth.token, {
        method: 'PATCH',
        body: { showOnLeaderboard: cmd.showOnLeaderboard },
      });
      if (!up.ok) {
        const e = mapPointsUpstreamError(up.status, up.data, 'Could not save. Please try again.');
        return fail(res, e.status, e.code, e.message);
      }
      return json(res, 200, { ok: true, showOnLeaderboard: up.data?.showOnLeaderboard === true });
    }

    // self-check-in
    if (bodyTooLarge(req.body)) return fail(res, 413, 'payload_too_large', 'Request too large.');
    const cmd = parseSelfCheckinCommand(req.body);
    if (!cmd.ok) {
      return fail(
        res,
        400,
        'invalid_code',
        'That code isn’t a check-in code. Scan the code on the check-in screen.'
      );
    }
    const up = await callVault(buildVaultPointsUrl(origin, 'self-check-in'), auth.token, {
      method: 'POST',
      body: { code: cmd.code },
    });
    if (!up.ok) {
      const e = mapPointsUpstreamError(up.status, up.data, CHECKIN_FAILED);
      return fail(res, e.status, e.code, e.message);
    }
    const result = parseSelfCheckinResponse(up.data);
    if (!result.ok) return fail(res, 502, 'invalid_upstream', CHECKIN_FAILED);
    const { ok: _ok, ...rest } = result;
    return json(res, 200, { ok: true, ...rest });
  } catch (err) {
    const aborted = err && (err.name === 'AbortError' || err.code === 'ABORT_ERR');
    console.error('[checkin-points]', resource, aborted ? 'timeout' : 'network');
    return fail(
      res,
      502,
      'vault_unavailable',
      resource === 'member-pass' ? PASS_UNAVAILABLE : UNAVAILABLE
    );
  }
}
