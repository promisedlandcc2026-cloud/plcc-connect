import { parseBearerAuthorization } from './_utils/memberIdentity.js';
import {
  MAX_COMMENT_BODY_BYTES,
  parseCommentsListQuery,
  parseCreateCommentCommand,
  parseDeleteCommentCommand,
  parseEditCommentCommand,
  parseVaultCommentMutationResponse,
  parseVaultCommentsListResponse,
} from './_utils/communityCommentSanitize.js';
import {
  buildVaultCommunityCommentsUrl,
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
        'We couldn’t complete that. The comment may be unavailable or you may no longer have access.',
    });
  }
  if (status === 404) {
    return json(res, 404, {
      ok: false,
      code: 'not_found',
      message:
        'We couldn’t complete that. The comment may be unavailable or you may no longer have access.',
    });
  }
  if (status === 409) {
    return json(res, 409, {
      ok: false,
      code: 'conflict',
      message: 'Please refresh and try again.',
    });
  }
  if (status === 413) {
    return json(res, 413, {
      ok: false,
      code: 'body_too_large',
      message: 'That comment is too long.',
    });
  }
  if (status === 429) {
    return json(res, 429, {
      ok: false,
      code: 'rate_limited',
      message: 'Too many requests. Please wait a moment and try again.',
    });
  }
  if (status === 400) {
    return json(res, 400, {
      ok: false,
      code: 'invalid_body',
      message: 'Please check your comment and try again.',
    });
  }
  console.error('[community-comments] upstream status', status);
  return json(res, 502, {
    ok: false,
    code: 'vault_unavailable',
    message: 'Comments are temporarily unavailable. Please try again.',
  });
}

function parseJsonBody(req) {
  const contentType = String(req.headers?.['content-type'] || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return { ok: false, status: 415, code: 'invalid_content_type' };
  }
  let rawBody = req.body;
  if (typeof rawBody === 'string') {
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_COMMENT_BODY_BYTES) {
      return { ok: false, status: 413, code: 'body_too_large' };
    }
    try {
      rawBody = JSON.parse(rawBody);
    } catch {
      return { ok: false, status: 400, code: 'invalid_body' };
    }
  } else if (rawBody == null) {
    return { ok: false, status: 400, code: 'invalid_body' };
  } else if (typeof rawBody === 'object') {
    try {
      const encoded = JSON.stringify(rawBody);
      if (Buffer.byteLength(encoded, 'utf8') > MAX_COMMENT_BODY_BYTES) {
        return { ok: false, status: 413, code: 'body_too_large' };
      }
    } catch {
      return { ok: false, status: 400, code: 'invalid_body' };
    }
  } else {
    return { ok: false, status: 400, code: 'invalid_body' };
  }
  return { ok: true, body: rawBody };
}

/**
 * Narrow same-origin bridge for Community comments:
 * GET/POST/PATCH/DELETE /api/community-comments
 * → Vault …/feed&feedType=comments
 *
 * Never logs tokens or comment bodies. Never forwards cookies.
 * Moderator delete is never requested from Connect (self-delete only).
 */
export default async function handler(req, res) {
  setPrivateNoStore(res);

  const method = req.method || 'GET';
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(method)) {
    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return json(res, 405, {
      ok: false,
      code: 'method_not_allowed',
      message: 'That request method is not supported.',
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
    console.error('[community-comments] VAULT_API_ORIGIN invalid:', originResult.reason);
    return json(res, 503, {
      ok: false,
      code: 'bridge_unconfigured',
      message: 'Comments are not available right now. Please try again later.',
    });
  }

  if (method === 'GET') {
    const parsed = parseCommentsListQuery(req.query || {});
    if (!parsed.ok) {
      return json(res, 400, {
        ok: false,
        code: 'invalid_query',
        message: 'That comments request was not valid.',
      });
    }

    const upstreamUrl = buildVaultCommunityCommentsUrl(originResult.origin, parsed.postId);
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
      if (!upstream.ok) return mapUpstreamError(res, upstream.status);
      let body;
      try {
        body = await upstream.json();
      } catch {
        return json(res, 502, {
          ok: false,
          code: 'invalid_upstream',
          message: 'Comments are temporarily unavailable. Please try again.',
        });
      }
      const list = parseVaultCommentsListResponse(body, parsed.postId);
      if (!list.ok) {
        return json(res, 502, {
          ok: false,
          code: 'invalid_upstream',
          message: 'Comments are temporarily unavailable. Please try again.',
        });
      }
      return json(res, 200, { ok: true, ...list.list, skipped: list.skipped });
    } catch (err) {
      const aborted = err && (err.name === 'AbortError' || err.code === 'ABORT_ERR');
      console.error('[community-comments] list error:', aborted ? 'timeout' : 'network');
      return json(res, 502, {
        ok: false,
        code: 'vault_unavailable',
        message: 'Comments are temporarily unavailable. Please try again.',
      });
    } finally {
      clearTimeout(timer);
    }
  }

  const parsedBody = parseJsonBody(req);
  if (!parsedBody.ok) {
    return json(res, parsedBody.status, {
      ok: false,
      code: parsedBody.code,
      message:
        parsedBody.code === 'body_too_large'
          ? 'That comment is too long.'
          : 'That comment request was not valid. Please try again.',
    });
  }

  let vaultMethod = method;
  let vaultBody = null;
  let postIdHint = null;
  let successStatus = 200;
  let parseMode = 'mutation';

  if (method === 'POST') {
    const cmd = parseCreateCommentCommand(parsedBody.body);
    if (!cmd.ok) {
      const msg =
        cmd.reason === 'empty'
          ? 'Please write a comment before sending.'
          : cmd.reason === 'too_long'
            ? `Comments can be up to ${2000} characters.`
            : 'That comment request was not valid. Please try again.';
      return json(res, 400, { ok: false, code: cmd.reason || 'invalid_body', message: msg });
    }
    vaultBody = cmd.vaultBody;
    postIdHint = cmd.postId;
    successStatus = 201;
  } else if (method === 'PATCH') {
    const cmd = parseEditCommentCommand(parsedBody.body);
    if (!cmd.ok) {
      const msg =
        cmd.reason === 'empty'
          ? 'Please write a comment before saving.'
          : cmd.reason === 'too_long'
            ? `Comments can be up to ${2000} characters.`
            : 'That comment request was not valid. Please try again.';
      return json(res, 400, { ok: false, code: cmd.reason || 'invalid_body', message: msg });
    }
    vaultBody = cmd.vaultBody;
  } else if (method === 'DELETE') {
    const cmd = parseDeleteCommentCommand(parsedBody.body);
    if (!cmd.ok) {
      return json(res, 400, {
        ok: false,
        code: cmd.reason || 'invalid_body',
        message: 'That comment request was not valid. Please try again.',
      });
    }
    vaultBody = cmd.vaultBody;
    parseMode = 'delete';
  }

  const upstreamUrl = buildVaultCommunityCommentsUrl(originResult.origin);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(upstreamUrl, {
      method: vaultMethod,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify(vaultBody),
      signal: controller.signal,
      redirect: 'error',
    });

    if (!upstream.ok) return mapUpstreamError(res, upstream.status);

    let body;
    try {
      body = await upstream.json();
    } catch {
      return json(res, 502, {
        ok: false,
        code: 'invalid_upstream',
        message: 'Comments are temporarily unavailable. Please try again.',
      });
    }

    if (parseMode === 'delete') {
      if (!body || typeof body !== 'object' || body.ok !== true) {
        return json(res, 502, {
          ok: false,
          code: 'invalid_upstream',
          message: 'Comments are temporarily unavailable. Please try again.',
        });
      }
      // Never expose moderated flag
      return json(res, 200, { ok: true, deleted: true });
    }

    const parsed = parseVaultCommentMutationResponse(body, postIdHint);
    if (!parsed.ok) {
      return json(res, 502, {
        ok: false,
        code: 'invalid_upstream',
        message: 'Comments are temporarily unavailable. Please try again.',
      });
    }

    return json(res, successStatus, { ok: true, comment: parsed.comment });
  } catch (err) {
    const aborted = err && (err.name === 'AbortError' || err.code === 'ABORT_ERR');
    console.error('[community-comments] write error:', aborted ? 'timeout' : 'network');
    return json(res, 502, {
      ok: false,
      code: 'vault_unavailable',
      message: 'Comments are temporarily unavailable. Please try again.',
    });
  } finally {
    clearTimeout(timer);
  }
}
