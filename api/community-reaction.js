import { parseBearerAuthorization } from './_utils/memberIdentity.js';
import {
  MAX_REACTION_BODY_BYTES,
  parseCommunityReactionCommand,
  parseVaultReactionResponse,
} from './_utils/communityFeedSanitize.js';
import {
  buildVaultCommunityReactionUrl,
  parseVaultApiOrigin,
} from './_utils/vaultOrigin.js';

const UPSTREAM_TIMEOUT_MS = 12000;

function setPrivateNoStore(res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Pragma', 'no-cache');
}

function json(res, status, body) {
  setPrivateNoStore(res);
  res.status(status).json(body);
}

function privacyMessage(targetType) {
  return targetType === 'comment'
    ? 'We couldn’t update that reaction. The comment may no longer be available.'
    : 'We couldn’t update your reaction. The post may be unavailable or you may no longer have access.';
}

/**
 * Narrow same-origin bridge:
 * POST /api/community-reaction
 * → Vault POST …/feed&feedType=reactions
 *
 * Body: { postId, reaction } (legacy posts)
 *    or { targetType: 'post'|'comment', targetId, reaction }
 *
 * Toggle: same reaction removes; different reactions may coexist.
 * Never logs tokens or bodies. Never forwards cookies.
 */
export default async function handler(req, res) {
  setPrivateNoStore(res);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, {
      ok: false,
      code: 'method_not_allowed',
      message: 'This endpoint only supports POST.',
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

  const contentType = String(req.headers?.['content-type'] || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return json(res, 415, {
      ok: false,
      code: 'invalid_content_type',
      message: 'That reaction request was not valid. Please try again.',
    });
  }

  let rawBody = req.body;
  if (typeof rawBody === 'string') {
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_REACTION_BODY_BYTES) {
      return json(res, 413, {
        ok: false,
        code: 'body_too_large',
        message: 'That reaction request was not valid. Please try again.',
      });
    }
    try {
      rawBody = JSON.parse(rawBody);
    } catch {
      return json(res, 400, {
        ok: false,
        code: 'invalid_body',
        message: 'That reaction request was not valid. Please try again.',
      });
    }
  } else if (rawBody == null) {
    return json(res, 400, {
      ok: false,
      code: 'invalid_body',
      message: 'That reaction request was not valid. Please try again.',
    });
  } else if (typeof rawBody === 'object') {
    try {
      const encoded = JSON.stringify(rawBody);
      if (Buffer.byteLength(encoded, 'utf8') > MAX_REACTION_BODY_BYTES) {
        return json(res, 413, {
          ok: false,
          code: 'body_too_large',
          message: 'That reaction request was not valid. Please try again.',
        });
      }
    } catch {
      return json(res, 400, {
        ok: false,
        code: 'invalid_body',
        message: 'That reaction request was not valid. Please try again.',
      });
    }
  } else {
    return json(res, 400, {
      ok: false,
      code: 'invalid_body',
      message: 'That reaction request was not valid. Please try again.',
    });
  }

  const command = parseCommunityReactionCommand(rawBody);
  if (!command.ok) {
    return json(res, 400, {
      ok: false,
      code:
        command.reason === 'invalid_reaction'
          ? 'invalid_reaction'
          : command.reason === 'invalid_target_type'
            ? 'invalid_target_type'
            : command.reason === 'invalid_target_id' || command.reason === 'invalid_post_id'
              ? 'invalid_target_id'
              : command.reason === 'extra_fields'
                ? 'extra_fields'
                : 'invalid_body',
      message: 'That reaction request was not valid. Please try again.',
    });
  }

  const allowHttpLocal = process.env.NODE_ENV !== 'production';
  const originResult = parseVaultApiOrigin(process.env.VAULT_API_ORIGIN, {
    allowHttpLocal,
  });
  if (!originResult.ok) {
    console.error('[community-reaction] VAULT_API_ORIGIN invalid:', originResult.reason);
    return json(res, 503, {
      ok: false,
      code: 'bridge_unconfigured',
      message: 'Community is not available right now. Please try again later.',
    });
  }

  const upstreamUrl = buildVaultCommunityReactionUrl(originResult.origin);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify(command.vaultBody),
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
    if (upstream.status === 403 || upstream.status === 404) {
      return json(res, upstream.status, {
        ok: false,
        code: upstream.status === 404 ? 'not_found' : 'forbidden',
        message: privacyMessage(command.targetType),
      });
    }
    if (upstream.status === 409) {
      return json(res, 409, {
        ok: false,
        code: 'conflict',
        message: 'Your reaction could not be saved. Please refresh and try again.',
      });
    }
    if (upstream.status === 429) {
      return json(res, 429, {
        ok: false,
        code: 'rate_limited',
        message: 'Too many requests. Please wait a moment and try again.',
      });
    }
    if (upstream.status === 400) {
      return json(res, 400, {
        ok: false,
        code: 'invalid_reaction',
        message: 'That reaction is not supported.',
      });
    }
    if (upstream.status >= 500 || !upstream.ok) {
      console.error('[community-reaction] upstream status', upstream.status);
      return json(res, 502, {
        ok: false,
        code: 'vault_unavailable',
        message: 'We couldn’t update your reaction right now. Please try again.',
      });
    }

    let body;
    try {
      body = await upstream.json();
    } catch {
      console.error('[community-reaction] non-JSON upstream');
      return json(res, 502, {
        ok: false,
        code: 'invalid_upstream',
        message: 'We couldn’t update your reaction right now. Please try again.',
      });
    }

    const parsed = parseVaultReactionResponse(body, {
      targetType: command.targetType,
      targetId: command.targetId,
    });
    if (!parsed.ok) {
      console.error('[community-reaction] sanitize failed:', parsed.reason);
      return json(res, 502, {
        ok: false,
        code: 'invalid_upstream',
        message: 'We couldn’t update your reaction right now. Please try again.',
      });
    }

    return json(res, 200, {
      ok: true,
      ...parsed.result,
    });
  } catch (err) {
    const aborted = err && (err.name === 'AbortError' || err.code === 'ABORT_ERR');
    console.error('[community-reaction] upstream error:', aborted ? 'timeout' : 'network');
    return json(res, 502, {
      ok: false,
      code: 'vault_unavailable',
      message: 'We couldn’t update your reaction right now. Please try again.',
    });
  } finally {
    clearTimeout(timer);
  }
}
