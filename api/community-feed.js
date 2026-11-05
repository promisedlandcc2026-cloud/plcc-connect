import { parseBearerAuthorization } from './_utils/memberIdentity.js';
import {
  parseFeedPaginationQuery,
  parseVaultCommunityFeedResponse,
} from './_utils/communityFeedSanitize.js';
import { fetchVaultSelfUserId } from './_utils/vaultCommunityOwnership.js';
import { buildVaultCommunityFeedUrl, parseVaultApiOrigin } from './_utils/vaultOrigin.js';

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
 * GET /api/community-feed → Vault Community feedType=posts
 *
 * Fixed upstream path. Pagination limited to validated limit/offset.
 * Never logs Authorization tokens. Never forwards cookies.
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

  const page = parseFeedPaginationQuery(req.query || {});
  if (!page.ok) {
    return json(res, 400, {
      ok: false,
      code: 'invalid_query',
      message: 'That feed request was not valid. Please try again.',
    });
  }

  const allowHttpLocal = process.env.NODE_ENV !== 'production';
  const originResult = parseVaultApiOrigin(process.env.VAULT_API_ORIGIN, {
    allowHttpLocal,
  });
  if (!originResult.ok) {
    console.error('[community-feed] VAULT_API_ORIGIN invalid:', originResult.reason);
    return json(res, 503, {
      ok: false,
      code: 'bridge_unconfigured',
      message: 'Community is not available right now. Please try again later.',
    });
  }

  const upstreamUrl = buildVaultCommunityFeedUrl(originResult.origin, page);
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
        message: 'Community is not available for this account yet.',
      });
    }
    if (upstream.status === 429) {
      return json(res, 429, {
        ok: false,
        code: 'rate_limited',
        message: 'Too many requests. Please wait a moment and try again.',
      });
    }
    if (upstream.status >= 500) {
      console.error('[community-feed] upstream status', upstream.status);
      return json(res, 502, {
        ok: false,
        code: 'vault_unavailable',
        message: 'Community is temporarily unavailable. Please try again.',
      });
    }
    if (!upstream.ok) {
      console.error('[community-feed] unexpected status', upstream.status);
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
      console.error('[community-feed] non-JSON upstream');
      return json(res, 502, {
        ok: false,
        code: 'invalid_upstream',
        message: 'Community is temporarily unavailable. Please try again.',
      });
    }

    const viewerId = selfResult.ok ? selfResult.id : null;
    const parsed = parseVaultCommunityFeedResponse(body, { viewerId });
    if (!parsed.ok) {
      console.error('[community-feed] sanitize failed:', parsed.reason);
      return json(res, 502, {
        ok: false,
        code: 'invalid_upstream',
        message: 'Community is temporarily unavailable. Please try again.',
      });
    }

    return json(res, 200, {
      ok: true,
      ...parsed.feed,
      skipped: parsed.skipped,
    });
  } catch (err) {
    const aborted = err && (err.name === 'AbortError' || err.code === 'ABORT_ERR');
    console.error('[community-feed] upstream error:', aborted ? 'timeout' : 'network');
    return json(res, 502, {
      ok: false,
      code: 'vault_unavailable',
      message: 'Community is temporarily unavailable. Please try again.',
    });
  } finally {
    clearTimeout(timer);
  }
}
