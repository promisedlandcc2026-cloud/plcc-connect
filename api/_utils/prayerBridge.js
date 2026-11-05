import { parseBearerAuthorization } from './memberIdentity.js';
import {
  MAX_PRAYER_BODY_BYTES,
  parsePrayerSubmit,
  parseVaultPrayerResponse,
} from './prayerSubmitSanitize.js';
import { buildVaultPrayerUrl, parseVaultApiOrigin } from './vaultOrigin.js';

const UPSTREAM_TIMEOUT_MS = 20000;

function json(res, status, body) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Pragma', 'no-cache');
  res.status(status).json(body);
}

const REASON_MESSAGES = {
  empty_content: 'Please write your prayer request.',
  content_too_long: 'That request is too long. Please shorten it and try again.',
  missing_name: 'Please add your name.',
  invalid_body: 'We couldn’t send your prayer request. Please try again.',
};

/**
 * Narrow same-origin bridge (served by api/vault-news.js to stay on the Hobby function budget):
 * POST /api/prayer → /api/vault-news?bridge=prayer → Vault POST …/community&subResource=prayer
 * Signed-in members send their Vault sign-in; visitors send none.
 * Fixed upstream path. Never logs tokens or prayer text.
 */
export async function handlePrayerBridge(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { ok: false, code: 'method_not_allowed', message: 'This endpoint only supports POST.' });
  }

  const hasAuthHeader = !!String(req.headers?.authorization || '').trim();
  const auth = hasAuthHeader ? parseBearerAuthorization(req.headers.authorization) : null;
  if (hasAuthHeader && !auth?.ok) {
    return json(res, 401, { ok: false, code: 'unauthorized', message: 'Please sign in again to continue.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    if (body.length > MAX_PRAYER_BODY_BYTES) {
      return json(res, 413, { ok: false, code: 'body_too_large', message: REASON_MESSAGES.content_too_long });
    }
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }

  const parsed = parsePrayerSubmit(body, { signedIn: !!auth?.ok });
  if (!parsed.ok) {
    return json(res, 400, {
      ok: false,
      code: parsed.reason,
      message: REASON_MESSAGES[parsed.reason] || REASON_MESSAGES.invalid_body,
    });
  }

  const originResult = parseVaultApiOrigin(process.env.VAULT_API_ORIGIN, {
    allowHttpLocal: process.env.NODE_ENV !== 'production',
  });
  if (!originResult.ok) {
    console.error('[prayer] VAULT_API_ORIGIN invalid:', originResult.reason);
    return json(res, 503, { ok: false, code: 'bridge_unconfigured', message: 'Prayer requests are not available right now. Please try again later.' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
    if (auth?.ok) headers.Authorization = `Bearer ${auth.token}`;
    const upstream = await fetch(buildVaultPrayerUrl(originResult.origin), {
      method: 'POST',
      headers,
      body: JSON.stringify(parsed.payload),
      signal: controller.signal,
    });
    const data = await upstream.json().catch(() => null);
    if (upstream.status === 401) {
      return json(res, 401, { ok: false, code: 'unauthorized', message: 'Please sign in again to continue.' });
    }
    if (upstream.status === 400) {
      return json(res, 400, { ok: false, code: 'invalid_body', message: (data && typeof data.error === 'string' && data.error.slice(0, 200)) || REASON_MESSAGES.invalid_body });
    }
    if (!upstream.ok) {
      console.error('[prayer] upstream status', upstream.status);
      return json(res, 502, { ok: false, code: 'vault_unavailable', message: 'We couldn’t send your prayer request. Please try again.' });
    }
    const status = parseVaultPrayerResponse(data);
    if (!status) {
      return json(res, 502, { ok: false, code: 'vault_unavailable', message: 'We couldn’t send your prayer request. Please try again.' });
    }
    return json(res, 201, { ok: true, status });
  } catch (err) {
    const aborted = err && typeof err === 'object' && err.name === 'AbortError';
    console.error('[prayer] upstream error', aborted ? 'timeout' : 'network');
    return json(res, 504, { ok: false, code: 'vault_unavailable', message: 'We couldn’t send your prayer request. Please try again.' });
  } finally {
    clearTimeout(timer);
  }
}
