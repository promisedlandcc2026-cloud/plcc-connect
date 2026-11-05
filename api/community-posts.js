import { parseBearerAuthorization } from './_utils/memberIdentity.js';
import {
  MAX_POST_CREATE_BODY_BYTES,
  parseCreatePostCommand,
  parseVaultCreatePostResponse,
} from './_utils/communityPostCreateSanitize.js';
import {
  buildVaultCommunityPostsCreateUrl,
  parseVaultApiOrigin,
} from './_utils/vaultOrigin.js';

const UPSTREAM_TIMEOUT_MS = 45000;

function setPrivateNoStore(res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Pragma', 'no-cache');
}

function json(res, status, body) {
  setPrivateNoStore(res);
  res.status(status).json(body);
}

function mapCreateReason(reason) {
  switch (reason) {
    case 'empty_content':
      return {
        status: 400,
        code: 'empty_content',
        message: 'Write something or add a photo before posting.',
      };
    case 'content_too_long':
      return {
        status: 400,
        code: 'content_too_long',
        message: 'That post is too long. Please shorten it and try again.',
      };
    case 'unsupported_mime':
    case 'mime_mismatch':
    case 'signature_mismatch':
    case 'invalid_image':
    case 'invalid_image_data':
    case 'missing_image_data':
    case 'extra_image_fields':
      return {
        status: 400,
        code: 'unsupported_image',
        message: 'Please choose a JPG, PNG, or WebP image.',
      };
    case 'image_too_large':
      return {
        status: 413,
        code: 'image_too_large',
        message: 'That photo is too large. Please choose a smaller image.',
      };
    case 'storage_path_rejected':
    case 'forbidden_field':
    case 'extra_fields':
    case 'invalid_body':
    default:
      return {
        status: 400,
        code: 'invalid_body',
        message:
          'We couldn’t publish your post. Your draft is still here so you can try again.',
      };
  }
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
      message: 'Community is not available for this account yet.',
    });
  }
  if (status === 404) {
    return json(res, 404, {
      ok: false,
      code: 'not_found',
      message:
        'We couldn’t publish your post. Your draft is still here so you can try again.',
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
      message: 'That photo is too large. Please choose a smaller image.',
    });
  }
  if (status === 415) {
    return json(res, 415, {
      ok: false,
      code: 'unsupported_media',
      message: 'Please choose a JPG, PNG, or WebP image.',
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
      message:
        'We couldn’t publish your post. Your draft is still here so you can try again.',
    });
  }
  console.error('[community-posts] upstream status', status);
  return json(res, 502, {
    ok: false,
    code: 'vault_unavailable',
    message:
      'We couldn’t publish your post. Your draft is still here so you can try again.',
  });
}

/**
 * Narrow same-origin bridge:
 * POST /api/community-posts → Vault POST …/feed&feedType=posts
 *
 * Body: { content, image?: { mimeType, fileBase64 } }
 * Always creates category=general. Never accepts author/user IDs or storage paths.
 * Never logs tokens, content, or image data. Never forwards cookies.
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
      message:
        'We couldn’t publish your post. Your draft is still here so you can try again.',
    });
  }

  let rawBody = req.body;
  if (rawBody === null) {
    return json(res, 413, {
      ok: false,
      code: 'body_too_large',
      message: 'That photo is too large. Please choose a smaller image.',
    });
  }
  if (typeof rawBody === 'string') {
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_POST_CREATE_BODY_BYTES) {
      return json(res, 413, {
        ok: false,
        code: 'body_too_large',
        message: 'That photo is too large. Please choose a smaller image.',
      });
    }
    try {
      rawBody = JSON.parse(rawBody);
    } catch {
      return json(res, 400, {
        ok: false,
        code: 'invalid_body',
        message:
          'We couldn’t publish your post. Your draft is still here so you can try again.',
      });
    }
  } else if (rawBody == null) {
    return json(res, 400, {
      ok: false,
      code: 'invalid_body',
      message:
        'We couldn’t publish your post. Your draft is still here so you can try again.',
    });
  } else if (typeof rawBody === 'object') {
    try {
      const encoded = JSON.stringify(rawBody);
      if (Buffer.byteLength(encoded, 'utf8') > MAX_POST_CREATE_BODY_BYTES) {
        return json(res, 413, {
          ok: false,
          code: 'body_too_large',
          message: 'That photo is too large. Please choose a smaller image.',
        });
      }
    } catch {
      return json(res, 400, {
        ok: false,
        code: 'invalid_body',
        message:
          'We couldn’t publish your post. Your draft is still here so you can try again.',
      });
    }
  }

  const parsed = parseCreatePostCommand(rawBody);
  if (!parsed.ok) {
    const mapped = mapCreateReason(parsed.reason);
    return json(res, mapped.status, {
      ok: false,
      code: mapped.code,
      message: mapped.message,
    });
  }

  const allowHttpLocal = process.env.NODE_ENV !== 'production';
  const originResult = parseVaultApiOrigin(process.env.VAULT_API_ORIGIN, {
    allowHttpLocal,
  });
  if (!originResult.ok) {
    console.error('[community-posts] VAULT_API_ORIGIN invalid:', originResult.reason);
    return json(res, 503, {
      ok: false,
      code: 'bridge_unconfigured',
      message: 'Community is not available right now. Please try again later.',
    });
  }

  const upstreamUrl = buildVaultCommunityPostsCreateUrl(originResult.origin);
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
      body: JSON.stringify(parsed.vaultBody),
      signal: controller.signal,
      redirect: 'error',
    });

    if (!upstream.ok) {
      return mapUpstreamError(res, upstream.status);
    }

    let upstreamBody;
    try {
      upstreamBody = await upstream.json();
    } catch {
      console.error('[community-posts] malformed upstream JSON');
      return json(res, 502, {
        ok: false,
        code: 'invalid_upstream',
        message:
          'We couldn’t publish your post. Your draft is still here so you can try again.',
      });
    }

    const created = parseVaultCreatePostResponse(upstreamBody);
    if (!created.ok) {
      console.error('[community-posts] sanitize failed:', created.reason);
      return json(res, 502, {
        ok: false,
        code: 'invalid_upstream',
        message:
          'We couldn’t publish your post. Your draft is still here so you can try again.',
      });
    }

    return json(res, 201, {
      ok: true,
      post: {
        ...created.post,
        authoredByMe: true,
        canEditOwnPost: true,
        canDeleteOwnPost: true,
      },
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      console.error('[community-posts] upstream timeout');
      return json(res, 504, {
        ok: false,
        code: 'timeout',
        message:
          'We couldn’t publish your post. Your draft is still here so you can try again.',
      });
    }
    console.error('[community-posts] upstream fetch failed');
    return json(res, 502, {
      ok: false,
      code: 'vault_unavailable',
      message:
        'We couldn’t publish your post. Your draft is still here so you can try again.',
    });
  } finally {
    clearTimeout(timer);
  }
}
