import { parseBearerAuthorization } from './memberIdentity.js';
import { parseVaultApiOrigin } from './vaultOrigin.js';

/** Fixed Vault path — POST only from Connect. */
export const VAULT_REPORT_PATH = '/api/vault?resource=report';

/** Screenshots are compressed in the browser; 3 × ~1 MB base64 plus text stays under Vercel's 4.5 MB body cap. */
export const MAX_REPORT_BODY_BYTES = 4_200_000;

const UPSTREAM_TIMEOUT_MS = 25000;
const ALLOWED_KINDS = new Set(['problem', 'safety', 'content']);

function json(res, status, body) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Pragma', 'no-cache');
  res.status(status).json(body);
}

export function buildVaultReportUrl(origin) {
  return `${String(origin || '').replace(/\/+$/, '')}${VAULT_REPORT_PATH}`;
}

/**
 * POST /api/report → /api/vault-news?bridge=report → Vault POST /api/vault?resource=report
 * Signed-in members only. The Vault validates the report and emails it.
 * Never logs tokens, report text or screenshots.
 */
export async function handleReportBridge(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { ok: false, code: 'method_not_allowed', message: 'This endpoint only supports POST.' });
  }

  const auth = parseBearerAuthorization(req.headers?.authorization);
  if (!auth.ok) {
    return json(res, 401, { ok: false, code: 'unauthorized', message: 'Please sign in to send a report.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    if (body.length > MAX_REPORT_BODY_BYTES) {
      return json(res, 413, { ok: false, code: 'body_too_large', message: 'The screenshots are too large. Please send fewer.' });
    }
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) || !ALLOWED_KINDS.has(body.kind)) {
    return json(res, 400, { ok: false, code: 'invalid_body', message: 'We couldn’t send your report. Please try again.' });
  }

  const payload = { ...body, sourceApp: 'connect' };
  const serialized = JSON.stringify(payload);
  if (serialized.length > MAX_REPORT_BODY_BYTES) {
    return json(res, 413, { ok: false, code: 'body_too_large', message: 'The screenshots are too large. Please send fewer.' });
  }

  const originResult = parseVaultApiOrigin(process.env.VAULT_API_ORIGIN, {
    allowHttpLocal: process.env.NODE_ENV !== 'production',
  });
  if (!originResult.ok) {
    console.error('[report] VAULT_API_ORIGIN invalid:', originResult.reason);
    return json(res, 503, { ok: false, code: 'bridge_unconfigured', message: 'Reports are not available right now. Please try again later.' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetch(buildVaultReportUrl(originResult.origin), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.token}`,
      },
      body: serialized,
      signal: controller.signal,
      redirect: 'error',
    });
    const data = await upstream.json().catch(() => null);
    const upstreamMessage = data && typeof data.error === 'string' ? data.error.slice(0, 200) : '';
    if (upstream.status === 401) {
      return json(res, 401, { ok: false, code: 'unauthorized', message: 'Please sign in again to continue.' });
    }
    if (upstream.status === 400 || upstream.status === 429 || upstream.status === 503) {
      return json(res, upstream.status, {
        ok: false,
        code: upstream.status === 429 ? 'rate_limited' : upstream.status === 503 ? 'unavailable' : 'invalid_body',
        message: upstreamMessage || 'We couldn’t send your report. Please try again.',
      });
    }
    if (!upstream.ok || !data?.ok) {
      console.error('[report] upstream status', upstream.status);
      return json(res, 502, { ok: false, code: 'vault_unavailable', message: 'We couldn’t send your report. Please try again.' });
    }
    return json(res, 200, { ok: true });
  } catch (err) {
    const aborted = err && typeof err === 'object' && err.name === 'AbortError';
    console.error('[report] upstream error', aborted ? 'timeout' : 'network');
    return json(res, 504, { ok: false, code: 'vault_unavailable', message: 'We couldn’t send your report. Please try again.' });
  } finally {
    clearTimeout(timer);
  }
}
