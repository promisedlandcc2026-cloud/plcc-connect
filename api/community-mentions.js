import { parseBearerAuthorization } from './_utils/memberIdentity.js';
import {
  parseMentionsListQuery,
  parseVaultMentionsResponse,
} from './_utils/communityMentionSanitize.js';
import {
  buildVaultCommunityMentionsUrl,
  parseVaultApiOrigin,
} from './_utils/vaultOrigin.js';

const UPSTREAM_TIMEOUT_MS = 8000;

function setPrivateNoStore(res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Pragma', 'no-cache');
}

function json(res, status, body) {
  setPrivateNoStore(res);
  res.status(status).json(body);
}

/**
 * Narrow same-origin bridge:
 * GET /api/community-mentions?q=<query>
 * → Vault GET …/feed&feedType=mention-candidates&q=
 *
 * Never logs tokens or search terms. Never forwards cookies.
 * Strips role/emailHint from Vault candidates.
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

  const parsedQuery = parseMentionsListQuery(req.query || {});
  if (!parsedQuery.ok) {
    const message =
      parsedQuery.reason === 'query_too_long'
        ? 'That search is too long. Please try a shorter name.'
        : parsedQuery.reason === 'query_too_short' || parsedQuery.reason === 'missing_q'
          ? 'Type a name to search for someone to mention.'
          : 'That mention search was not valid. Please try again.';
    return json(res, 400, {
      ok: false,
      code: 'invalid_query',
      message,
    });
  }

  const allowHttpLocal = process.env.NODE_ENV !== 'production';
  const originResult = parseVaultApiOrigin(process.env.VAULT_API_ORIGIN, {
    allowHttpLocal,
  });
  if (!originResult.ok) {
    console.error('[community-mentions] VAULT_API_ORIGIN invalid:', originResult.reason);
    return json(res, 503, {
      ok: false,
      code: 'bridge_unconfigured',
      message: 'Community is not available right now. Please try again later.',
    });
  }

  const upstreamUrl = buildVaultCommunityMentionsUrl(
    originResult.origin,
    parsedQuery.q
  );
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

    if (upstream.status === 401) {
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
    if (!upstream.ok) {
      console.error('[community-mentions] upstream status', upstream.status);
      return json(res, 502, {
        ok: false,
        code: 'vault_unavailable',
        message: 'Member search is temporarily unavailable. You can still post without mentions.',
      });
    }

    let body;
    try {
      body = await upstream.json();
    } catch {
      console.error('[community-mentions] non-JSON upstream');
      return json(res, 502, {
        ok: false,
        code: 'invalid_upstream',
        message: 'Member search is temporarily unavailable. You can still post without mentions.',
      });
    }

    const parsed = parseVaultMentionsResponse(body);
    if (!parsed.ok) {
      console.error('[community-mentions] sanitize failed:', parsed.reason);
      return json(res, 502, {
        ok: false,
        code: 'invalid_upstream',
        message: 'Member search is temporarily unavailable. You can still post without mentions.',
      });
    }

    return json(res, 200, {
      ok: true,
      candidates: parsed.candidates,
      skipped: parsed.skipped,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      console.error('[community-mentions] timeout');
      return json(res, 504, {
        ok: false,
        code: 'timeout',
        message: 'Member search is temporarily unavailable. You can still post without mentions.',
      });
    }
    console.error('[community-mentions] fetch failed');
    return json(res, 502, {
      ok: false,
      code: 'vault_unavailable',
      message: 'Member search is temporarily unavailable. You can still post without mentions.',
    });
  } finally {
    clearTimeout(timer);
  }
}
