/**
 * PLCC ONE one sign-on bridge (Connect → PLCC Chat):
 *   POST /api/sso   (Bearer)  → PLCC Canaan POST /api/vault?resource=sso { target: 'chat' }
 * Returns { ok, tokenHash } — a single-use sign-in token PLCC Chat verifies at /auth/sso.
 * Rides on api/vault-news.js (bridge=sso) for the Hobby function limit.
 * Fixed upstream and target; forwards only the member's Bearer token; never logs it.
 */
import { parseBearerAuthorization } from './memberIdentity.js';
import { parseVaultApiOrigin } from './vaultOrigin.js';

const TIMEOUT_MS = 10000;

export async function handleSsoBridge(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const send = (status, body) => res.status(status).json(body);
  if (String(req.method || '').toUpperCase() !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(405, { ok: false, code: 'method_not_allowed', error: 'Method not allowed.' });
  }
  const auth = parseBearerAuthorization(req.headers?.authorization);
  if (!auth.ok) return send(401, { ok: false, code: 'unauthorized', error: 'Please sign in again to continue.' });

  const originResult = parseVaultApiOrigin(process.env.VAULT_API_ORIGIN, {
    allowHttpLocal: process.env.NODE_ENV !== 'production',
  });
  if (!originResult.ok) {
    console.error('[sso] VAULT_API_ORIGIN invalid:', originResult.reason);
    return send(503, { ok: false, code: 'bridge_unconfigured', error: 'Sign-on is not available.' });
  }

  const url = `${String(originResult.origin).replace(/\/+$/, '')}/api/vault?resource=sso`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({ target: 'chat' }),
      signal: controller.signal,
      redirect: 'error',
    });
    const data = await upstream.json().catch(() => null);
    const tokenHash = data && data.ok ? String(data.tokenHash || '') : '';
    if (!upstream.ok || !tokenHash) {
      return send(200, { ok: false, code: (data && data.code) || 'unavailable' });
    }
    return send(200, { ok: true, tokenHash });
  } catch (err) {
    const aborted = err && (err.name === 'AbortError' || err.code === 'ABORT_ERR');
    console.error('[sso] error:', aborted ? 'timeout' : 'network');
    return send(200, { ok: false, code: 'unavailable' });
  } finally {
    clearTimeout(timer);
  }
}
