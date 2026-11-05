import { parseBearerAuthorization } from '../_utils/memberIdentity.js';
import {
  parseCommunityPostQuery,
  parseVaultSinglePostResponse,
} from '../_utils/communityFeedSanitize.js';
import { fetchVaultSelfUserId } from '../_utils/vaultCommunityOwnership.js';
import { buildVaultCommunityPostUrl, parseVaultApiOrigin } from '../_utils/vaultOrigin.js';

const UPSTREAM_TIMEOUT_MS = 12000;

function setPrivateNoStore(res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Pragma', 'no-cache');
}

function json(res, status, body) {
  setPrivateNoStore(res);
  res.status(status).json(body);
}

/**
 * Narrow same-origin bridge (read-only):
 * GET /api/community-post?id=<uuid>
 * → Vault GET …/feed&feedType=posts&id=<uuid>
 *
 * Fixed upstream path. Never logs tokens. Never forwards cookies.
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

  const parsedQuery = parseCommunityPostQuery(req.query || {});
  if (!parsedQuery.ok) {
    return json(res, 400, {
      ok: false,
      code: 'invalid_query',
      message: 'That post link is not valid.',
    });
  }

  const allowHttpLocal = process.env.NODE_ENV !== 'production';
  const originResult = parseVaultApiOrigin(process.env.VAULT_API_ORIGIN, {
    allowHttpLocal,
  });
  if (!originResult.ok) {
    console.error('[community-post] VAULT_API_ORIGIN invalid:', originResult.reason);
    return json(res, 503, {
      ok: false,
      code: 'bridge_unconfigured',
      message: 'Community is not available right now. Please try again later.',
    });
  }

  const upstreamUrl = buildVaultCommunityPostUrl(originResult.origin, parsedQuery.id);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const [upstream, selfResult] = await Promise.all([
      fetch(upstreamUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        signal: controller.signal,
        redirect: 'error',
      }),
      fetchVaultSelfUserId(originResult.origin, auth.token, controller.signal),
    ]);

    if (upstream.status === 401 || selfResult.status === 401) {
      return json(res, 401, {
        ok: false,
        code: 'unauthorized',
        message: 'Please sign in again to continue.',
      });
    }
    if (upstream.status === 403) {
      return json(res, 403, {
        ok: false,
        code: 'forbidden',
        message:
          'This post is unavailable or you may not have permission to view it.',
      });
    }
    if (upstream.status === 404) {
      return json(res, 404, {
        ok: false,
        code: 'not_found',
        message: 'This post is no longer available.',
      });
    }
    if (upstream.status === 429) {
      return json(res, 429, {
        ok: false,
        code: 'rate_limited',
        message: 'Too many requests. Please wait a moment and try again.',
      });
    }
    if (upstream.status >= 500 || !upstream.ok) {
      console.error('[community-post] upstream status', upstream.status);
      return json(res, 502, {
        ok: false,
        code: 'vault_unavailable',
        message: 'Community is temporarily unavailable. Please try again.',
      });
    }

    let body;
    try {
      body = await upstream.json();
    } catch {
      console.error('[community-post] non-JSON upstream');
      return json(res, 502, {
        ok: false,
        code: 'invalid_upstream',
        message: 'Community is temporarily unavailable. Please try again.',
      });
    }

    const viewerId = selfResult.ok ? selfResult.id : null;
    const parsed = parseVaultSinglePostResponse(body, { viewerId });
    if (!parsed.ok) {
      console.error('[community-post] sanitize failed:', parsed.reason);
      return json(res, 502, {
        ok: false,
        code: 'invalid_upstream',
        message: 'Community is temporarily unavailable. Please try again.',
      });
    }

    return json(res, 200, {
      ok: true,
      post: parsed.post,
    });
  } catch (err) {
    const aborted = err && (err.name === 'AbortError' || err.code === 'ABORT_ERR');
    console.error('[community-post] upstream error:', aborted ? 'timeout' : 'network');
    return json(res, 502, {
      ok: false,
      code: 'vault_unavailable',
      message: 'Community is temporarily unavailable. Please try again.',
    });
  } finally {
    clearTimeout(timer);
  }
}
