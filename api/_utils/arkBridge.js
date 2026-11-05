/**
 * PLCC Ark bridge (same origin for the Ark, which PLCC Connect serves at /ark):
 *   GET  /api/ark?action=me
 *   GET  /api/ark?action=board&game=tetris&period=week|all
 *   POST /api/ark?action=score   { playerId, game, score, durationSec, stats }
 *   POST /api/ark?action=privacy { playerId, hideName }
 * → PLCC Canaan  /api/vault?resource=ark (scores, leaderboards, PLCC Bucks rules).
 * Rides on api/vault-news.js (bridge=ark) for the Hobby function limit.
 * Fixed upstream; forwards only the member's Bearer token; never logs it.
 */
import { parseBearerAuthorization } from './memberIdentity.js';
import { parseVaultApiOrigin } from './vaultOrigin.js';

const TIMEOUT_MS = 15000;
const MAX_BODY_BYTES = 4096;
const UNAVAILABLE = 'The Ark is not available right now. Please try again.';
const GAMES = new Set(['pong', 'breakout', 'invaders', 'tetris', 'dove']);

/** Only the member actions; staff tools live in the Vault itself. */
export function arkUpstreamQuery(method, query) {
  const action = String(query?.action || '').toLowerCase();
  if (method === 'GET' && action === 'me') return { ok: true, qs: 'resource=ark&action=me' };
  if (method === 'GET' && action === 'board') {
    const game = String(query?.game || '').toLowerCase();
    if (!GAMES.has(game)) return { ok: false, status: 400, code: 'invalid_game', message: 'Pick a game.' };
    const period = String(query?.period || '') === 'all' ? 'all' : 'week';
    return { ok: true, qs: `resource=ark&action=board&game=${game}&period=${period}` };
  }
  if (method === 'POST' && action === 'score') return { ok: true, qs: 'resource=ark&action=score' };
  if (method === 'POST' && action === 'privacy') return { ok: true, qs: 'resource=ark&action=privacy' };
  return { ok: false, status: 404, code: 'unknown_action', message: 'Unknown Ark request.' };
}

export async function handleArkBridge(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const send = (status, body) => res.status(status).json(body);
  const method = String(req.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return send(405, { ok: false, code: 'method_not_allowed', error: 'Method not allowed.' });
  }
  const auth = parseBearerAuthorization(req.headers?.authorization);
  if (!auth.ok) return send(401, { ok: false, code: 'unauthorized', error: 'Please sign in again to continue.' });

  const route = arkUpstreamQuery(method, req.query);
  if (!route.ok) return send(route.status, { ok: false, code: route.code, error: route.message });

  const originResult = parseVaultApiOrigin(process.env.VAULT_API_ORIGIN, {
    allowHttpLocal: process.env.NODE_ENV !== 'production',
  });
  if (!originResult.ok) {
    console.error('[ark] VAULT_API_ORIGIN invalid:', originResult.reason);
    return send(503, { ok: false, code: 'bridge_unconfigured', error: UNAVAILABLE });
  }

  let body;
  if (method === 'POST') {
    let raw = req.body;
    if (typeof raw !== 'string') raw = JSON.stringify(raw ?? {});
    if (raw.length > MAX_BODY_BYTES) return send(413, { ok: false, code: 'body_too_large', error: 'That request is too large.' });
    body = raw;
  }

  const url = `${String(originResult.origin).replace(/\/+$/, '')}/api/vault?${route.qs}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const upstream = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${auth.token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body,
      signal: controller.signal,
      redirect: 'error',
    });
    const data = await upstream.json().catch(() => null);
    if (!data || typeof data !== 'object') {
      console.error('[ark] upstream status', upstream.status);
      return send(502, { ok: false, code: 'vault_unavailable', error: UNAVAILABLE });
    }
    // The Vault's Ark API already returns only what members may see.
    return send(upstream.status, data);
  } catch (err) {
    const aborted = err && (err.name === 'AbortError' || err.code === 'ABORT_ERR');
    console.error('[ark] error:', aborted ? 'timeout' : 'network');
    return send(502, { ok: false, code: 'vault_unavailable', error: UNAVAILABLE });
  } finally {
    clearTimeout(timer);
  }
}
