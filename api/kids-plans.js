import { parseBearerAuthorization } from './_utils/memberIdentity.js';
import {
  parseKidsPlansQuery,
  parseVaultKidsPlansResponse,
} from './_utils/kidsPlansSanitize.js';
import { buildVaultKidsPlansUrl, parseVaultApiOrigin } from './_utils/vaultOrigin.js';

const UPSTREAM_TIMEOUT_MS = 15000;

function setPrivateNoStore(res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Pragma', 'no-cache');
}

function json(res, status, body) {
  setPrivateNoStore(res);
  res.status(status).json(body);
}

function mapUpstreamError(res, status) {
  if (status === 401) {
    return json(res, 401, {
      ok: false,
      code: 'unauthorized',
      message: 'Please sign in again to continue.',
    });
  }
  if (status === 403) {
    return json(res, 403, {
      ok: false,
      code: 'forbidden',
      message:
        'Kids Plans are available to kids ministry staff and verified guardians. Contact the church office if you need access.',
    });
  }
  if (status === 429) {
    return json(res, 429, {
      ok: false,
      code: 'rate_limited',
      message: 'Too many requests. Please wait a moment and try again.',
    });
  }
  console.error('[kids-plans] upstream status', status);
  return json(res, 502, {
    ok: false,
    code: 'vault_unavailable',
    message: 'Kids Plans are temporarily unavailable. Please try again.',
  });
}

/**
 * Narrow same-origin bridge (read-only):
 * GET /api/kids-plans → Vault GET /api/vault?resource=kids-plans
 *
 * Fixed upstream. Never logs tokens or plan bodies.
 * Never forwards cookies. Upload/delete stay in Vault only.
 */
export default async function handler(req, res) {
  setPrivateNoStore(res);

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, {
      ok: false,
      code: 'method_not_allowed',
      message: 'This endpoint only supports GET.',
    });
  }

  const auth = parseBearerAuthorization(req.headers?.authorization);
  if (!auth.ok) {
    return json(res, 401, {
      ok: false,
      code: 'unauthorized',
      message: 'Please sign in again to continue.',
    });
  }

  const allowHttpLocal = process.env.NODE_ENV !== 'production';
  const originResult = parseVaultApiOrigin(process.env.VAULT_API_ORIGIN, {
    allowHttpLocal,
  });
  if (!originResult.ok) {
    console.error('[kids-plans] VAULT_API_ORIGIN invalid:', originResult.reason);
    return json(res, 503, {
      ok: false,
      code: 'bridge_unconfigured',
      message: 'Kids Plans are not available right now. Please try again later.',
    });
  }

  const filters = parseKidsPlansQuery(req.query?.year, req.query?.classroom);
  const upstreamUrl = buildVaultKidsPlansUrl(originResult.origin, filters);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${auth.token}`,
      },
      signal: controller.signal,
      redirect: 'error',
    });

    if (!upstream.ok) {
      return mapUpstreamError(res, upstream.status);
    }

    let body;
    try {
      body = await upstream.json();
    } catch {
      console.error('[kids-plans] non-JSON upstream');
      return json(res, 502, {
        ok: false,
        code: 'invalid_upstream',
        message: 'Kids Plans are temporarily unavailable. Please try again.',
      });
    }

    const parsed = parseVaultKidsPlansResponse(body);
    if (!parsed.ok) {
      console.error('[kids-plans] sanitize failed:', parsed.reason);
      return json(res, 502, {
        ok: false,
        code: 'invalid_upstream',
        message: 'Kids Plans are temporarily unavailable. Please try again.',
      });
    }

    return json(res, 200, {
      ok: true,
      plans: parsed.plans,
    });
  } catch (err) {
    const aborted = err && (err.name === 'AbortError' || err.code === 'ABORT_ERR');
    console.error('[kids-plans] upstream error:', aborted ? 'timeout' : 'network');
    return json(res, 502, {
      ok: false,
      code: 'vault_unavailable',
      message: 'Kids Plans are temporarily unavailable. Please try again.',
    });
  } finally {
    clearTimeout(timer);
  }
}
