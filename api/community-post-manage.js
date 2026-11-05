import { parseBearerAuthorization } from './_utils/memberIdentity.js';
import {
  MAX_POST_MANAGE_BODY_BYTES,
  assertSelfOwnsPost,
  parsePostManageCommand,
  parseVaultDeletePostResponse,
  parseVaultEditPostResponse,
} from './_utils/communityPostManageSanitize.js';
import {
  fetchVaultSanitizedPost,
  fetchVaultSelfUserId,
} from './_utils/vaultCommunityOwnership.js';
import {
  buildVaultCommunityPostsCreateUrl,
  parseVaultApiOrigin,
} from './_utils/vaultOrigin.js';

const UPSTREAM_TIMEOUT_MS = 20000;

function setPrivateNoStore(res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Pragma', 'no-cache');
}

function json(res, status, body) {
  setPrivateNoStore(res);
  res.status(status).json(body);
}

const PRIVACY_MANAGE_MESSAGE =
  'You cannot manage this post, or it may no longer be available.';

function mapCommandReason(reason) {
  switch (reason) {
    case 'empty_content':
      return {
        status: 400,
        code: 'empty_content',
        message: 'Write something before saving.',
      };
    case 'content_too_long':
      return {
        status: 400,
        code: 'content_too_long',
        message: 'That post is too long. Please shorten it and try again.',
      };
    case 'invalid_post_id':
    case 'invalid_action':
    case 'missing_content':
    case 'extra_fields':
    case 'forbidden_field':
    case 'invalid_body':
    default:
      return {
        status: 400,
        code: 'invalid_body',
        message: 'That request was not valid. Please try again.',
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
  if (status === 403 || status === 404) {
    return json(res, status === 404 ? 404 : 403, {
      ok: false,
      code: status === 404 ? 'not_found' : 'forbidden',
      message: PRIVACY_MANAGE_MESSAGE,
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
      message: 'That post is too long. Please shorten it and try again.',
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
      message: 'That request was not valid. Please try again.',
    });
  }
  console.error('[community-post-manage] upstream status', status);
  return json(res, 502, {
    ok: false,
    code: 'vault_unavailable',
    message: 'We couldn’t update that post right now. Please try again.',
  });
}

/**
 * Narrow same-origin bridge for self-owned post edit/delete:
 * POST /api/community-post-manage
 *
 * Always verifies Vault self-user id === post.author.id before mutation.
 * Prevents Vault moderator delete privileges from applying in Connect.
 * Text edit only — image replace/remove not supported by Vault PATCH.
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
      message: 'That request was not valid. Please try again.',
    });
  }

  let rawBody = req.body;
  if (typeof rawBody === 'string') {
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_POST_MANAGE_BODY_BYTES) {
      return json(res, 413, {
        ok: false,
        code: 'body_too_large',
        message: 'That request was not valid. Please try again.',
      });
    }
    try {
      rawBody = JSON.parse(rawBody);
    } catch {
      return json(res, 400, {
        ok: false,
        code: 'invalid_body',
        message: 'That request was not valid. Please try again.',
      });
    }
  } else if (rawBody == null) {
    return json(res, 400, {
      ok: false,
      code: 'invalid_body',
      message: 'That request was not valid. Please try again.',
    });
  } else if (typeof rawBody === 'object') {
    try {
      const encoded = JSON.stringify(rawBody);
      if (Buffer.byteLength(encoded, 'utf8') > MAX_POST_MANAGE_BODY_BYTES) {
        return json(res, 413, {
          ok: false,
          code: 'body_too_large',
          message: 'That request was not valid. Please try again.',
        });
      }
    } catch {
      return json(res, 400, {
        ok: false,
        code: 'invalid_body',
        message: 'That request was not valid. Please try again.',
      });
    }
  }

  const parsed = parsePostManageCommand(rawBody);
  if (!parsed.ok) {
    const mapped = mapCommandReason(parsed.reason);
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
    console.error('[community-post-manage] VAULT_API_ORIGIN invalid:', originResult.reason);
    return json(res, 503, {
      ok: false,
      code: 'bridge_unconfigured',
      message: 'Community is not available right now. Please try again later.',
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    // Ownership verification — every mutation, no cache.
    const selfResult = await fetchVaultSelfUserId(
      originResult.origin,
      auth.token,
      controller.signal
    );
    if (!selfResult.ok) {
      if (selfResult.status === 401) {
        return json(res, 401, {
          ok: false,
          code: 'unauthorized',
          message: 'Please sign in again to continue.',
        });
      }
      if (selfResult.status === 403) {
        return json(res, 403, {
          ok: false,
          code: 'forbidden',
          message: PRIVACY_MANAGE_MESSAGE,
        });
      }
      if (selfResult.status === 504) {
        return json(res, 504, {
          ok: false,
          code: 'timeout',
          message: 'We couldn’t update that post right now. Please try again.',
        });
      }
      return json(res, 502, {
        ok: false,
        code: 'invalid_upstream',
        message: 'We couldn’t update that post right now. Please try again.',
      });
    }

    const postResult = await fetchVaultSanitizedPost(
      originResult.origin,
      auth.token,
      parsed.postId,
      selfResult.id,
      controller.signal
    );
    if (!postResult.ok) {
      if (postResult.status === 401) {
        return json(res, 401, {
          ok: false,
          code: 'unauthorized',
          message: 'Please sign in again to continue.',
        });
      }
      if (postResult.status === 403 || postResult.status === 404) {
        return json(res, postResult.status, {
          ok: false,
          code: postResult.status === 404 ? 'not_found' : 'forbidden',
          message: PRIVACY_MANAGE_MESSAGE,
        });
      }
      if (postResult.status === 504) {
        return json(res, 504, {
          ok: false,
          code: 'timeout',
          message: 'We couldn’t update that post right now. Please try again.',
        });
      }
      return json(res, 502, {
        ok: false,
        code: 'invalid_upstream',
        message: 'We couldn’t update that post right now. Please try again.',
      });
    }

    const ownership = assertSelfOwnsPost(selfResult.id, postResult.post);
    if (!ownership.ok) {
      // Fail closed — including moderator who does not own the post.
      return json(res, 403, {
        ok: false,
        code: 'forbidden',
        message: PRIVACY_MANAGE_MESSAGE,
      });
    }

    const upstreamUrl = buildVaultCommunityPostsCreateUrl(originResult.origin);

    if (parsed.action === 'edit') {
      const upstream = await fetch(upstreamUrl, {
        method: 'PATCH',
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
        console.error('[community-post-manage] malformed edit JSON');
        return json(res, 502, {
          ok: false,
          code: 'invalid_upstream',
          message: 'We couldn’t update that post right now. Please try again.',
        });
      }

      const edited = parseVaultEditPostResponse(upstreamBody, selfResult.id);
      if (!edited.ok) {
        console.error('[community-post-manage] edit sanitize failed');
        return json(res, 502, {
          ok: false,
          code: 'invalid_upstream',
          message: 'We couldn’t update that post right now. Please try again.',
        });
      }

      // Preserve prior reaction/comment counts if Vault edit omits them (often empty).
      const merged = {
        ...edited.post,
        commentCount:
          typeof edited.post.commentCount === 'number' && edited.post.commentCount > 0
            ? edited.post.commentCount
            : postResult.post.commentCount,
        reactions:
          Array.isArray(edited.post.reactions) && edited.post.reactions.length > 0
            ? edited.post.reactions
            : postResult.post.reactions,
        imageUrl: edited.post.imageUrl ?? postResult.post.imageUrl,
        imageAlt: edited.post.imageAlt ?? postResult.post.imageAlt,
        authoredByMe: true,
        canEditOwnPost: true,
        canDeleteOwnPost: true,
      };

      return json(res, 200, { ok: true, action: 'edit', post: merged });
    }

    // delete
    const deleteUrl = `${upstreamUrl}&id=${encodeURIComponent(parsed.postId)}`;
    const upstream = await fetch(deleteUrl, {
      method: 'DELETE',
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
      console.error('[community-post-manage] malformed delete JSON');
      return json(res, 502, {
        ok: false,
        code: 'invalid_upstream',
        message: 'We couldn’t update that post right now. Please try again.',
      });
    }

    const deleted = parseVaultDeletePostResponse(upstreamBody);
    if (!deleted.ok) {
      console.error('[community-post-manage] delete sanitize failed');
      return json(res, 502, {
        ok: false,
        code: 'invalid_upstream',
        message: 'We couldn’t update that post right now. Please try again.',
      });
    }

    return json(res, 200, { ok: true, action: 'delete', postId: parsed.postId });
  } catch (err) {
    if (err?.name === 'AbortError') {
      console.error('[community-post-manage] timeout');
      return json(res, 504, {
        ok: false,
        code: 'timeout',
        message: 'We couldn’t update that post right now. Please try again.',
      });
    }
    console.error('[community-post-manage] fetch failed');
    return json(res, 502, {
      ok: false,
      code: 'vault_unavailable',
      message: 'We couldn’t update that post right now. Please try again.',
    });
  } finally {
    clearTimeout(timer);
  }
}
