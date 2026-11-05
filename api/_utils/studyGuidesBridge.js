/**
 * GET /api/study-guides            → Vault rhemanotes library (any signed-in member)
 * GET /api/study-guides?token=<24> → one published guide
 * Rides on api/vault-news.js (bridge=study-guides) for the Hobby function limit.
 * Fixed upstream; forwards only the member's Bearer token; never logs it.
 */
import { parseBearerAuthorization } from './memberIdentity.js';
import { buildVaultStudyGuidesUrl, buildVaultStudyGuideUrl, parseVaultApiOrigin } from './vaultOrigin.js';
import { SHARE_TOKEN_RE, sanitizeGuide, sanitizeGuideCard } from './studyGuidesSanitize.js';

const TIMEOUT_MS = 20000;
const UNAVAILABLE = 'Sermon study guides are temporarily unavailable. Please try again.';

export async function handleStudyGuidesBridge(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const send = (status, body) => res.status(status).json(body);

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return send(405, { ok: false, code: 'method_not_allowed', message: 'This endpoint only supports GET.' });
  }
  const auth = parseBearerAuthorization(req.headers?.authorization);
  if (!auth.ok) return send(401, { ok: false, code: 'unauthorized', message: 'Please sign in again to continue.' });

  const originResult = parseVaultApiOrigin(process.env.VAULT_API_ORIGIN, {
    allowHttpLocal: process.env.NODE_ENV !== 'production',
  });
  if (!originResult.ok) {
    console.error('[study-guides] VAULT_API_ORIGIN invalid:', originResult.reason);
    return send(503, { ok: false, code: 'bridge_unconfigured', message: UNAVAILABLE });
  }

  const tokenRaw = req.query?.token;
  const token = typeof tokenRaw === 'string' ? tokenRaw.trim() : '';
  if (token && !SHARE_TOKEN_RE.test(token)) {
    return send(400, { ok: false, code: 'invalid_token', message: 'That study guide link is not valid.' });
  }
  const url = token ? buildVaultStudyGuideUrl(originResult.origin, token) : buildVaultStudyGuidesUrl(originResult.origin);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const upstream = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${auth.token}` },
      signal: controller.signal,
      redirect: 'error',
    });
    if (upstream.status === 401) return send(401, { ok: false, code: 'unauthorized', message: 'Please sign in again to continue.' });
    if (upstream.status === 404) return send(404, { ok: false, code: 'not_found', message: 'That study guide is not published.' });
    if (!upstream.ok) {
      console.error('[study-guides] upstream status', upstream.status);
      return send(502, { ok: false, code: 'vault_unavailable', message: UNAVAILABLE });
    }
    const body = await upstream.json().catch(() => null);
    if (token) {
      const guide = sanitizeGuide(body?.guide);
      if (!guide) return send(404, { ok: false, code: 'not_found', message: 'That study guide is not published.' });
      return send(200, { ok: true, guide });
    }
    const guides = Array.isArray(body?.guides) ? body.guides.map(sanitizeGuideCard).filter(Boolean).slice(0, 60) : [];
    return send(200, { ok: true, guides });
  } catch (err) {
    const aborted = err && (err.name === 'AbortError' || err.code === 'ABORT_ERR');
    console.error('[study-guides] error:', aborted ? 'timeout' : 'network');
    return send(502, { ok: false, code: 'vault_unavailable', message: UNAVAILABLE });
  } finally {
    clearTimeout(timer);
  }
}
