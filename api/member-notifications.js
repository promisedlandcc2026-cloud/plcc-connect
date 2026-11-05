import { parseBearerAuthorization } from './_utils/memberIdentity.js';
import {
  MAX_PATCH_BODY_BYTES,
  parseNotificationsListQuery,
  parseNotificationsPatchCommand,
  parseVaultNotificationsResponse,
  sanitizeMarkReadResult,
} from './_utils/notificationSanitize.js';
import { buildVaultNotificationsUrl, parseVaultApiOrigin } from './_utils/vaultOrigin.js';

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
      message: 'Notifications are not available for this account yet.',
    });
  }
  if (status === 404) {
    return json(res, 404, {
      ok: false,
      code: 'not_found',
      message: 'That notification could not be found.',
    });
  }
  if (status === 429) {
    return json(res, 429, {
      ok: false,
      code: 'rate_limited',
      message: 'Too many requests. Please wait a moment and try again.',
    });
  }
  console.error('[member-notifications] upstream status', status);
  return json(res, 502, {
    ok: false,
    code: 'vault_unavailable',
    message: 'Notifications are temporarily unavailable. Please try again.',
  });
}

/**
 * Narrow same-origin bridge:
 * GET  /api/member-notifications  → Vault GET  resource=notifications
 * PATCH /api/member-notifications → Vault PATCH resource=notifications
 *
 * Fixed upstream path. Never logs tokens or notification bodies.
 * Never forwards cookies. Never accepts userId from the browser.
 */
export default async function handler(req, res) {
  setPrivateNoStore(res);

  if (req.method !== 'GET' && req.method !== 'PATCH') {
    res.setHeader('Allow', 'GET, PATCH');
    return json(res, 405, {
      ok: false,
      code: 'method_not_allowed',
      message: 'This endpoint only supports GET and PATCH.',
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
    console.error('[member-notifications] VAULT_API_ORIGIN invalid:', originResult.reason);
    return json(res, 503, {
      ok: false,
      code: 'bridge_unconfigured',
      message: 'Notifications are not available right now. Please try again later.',
    });
  }

  const upstreamUrl = buildVaultNotificationsUrl(originResult.origin);

  if (req.method === 'GET') {
    const page = parseNotificationsListQuery(req.query || {});
    if (!page.ok) {
      return json(res, 400, {
        ok: false,
        code: 'invalid_query',
        message: 'That notifications request was not valid. Please try again.',
      });
    }

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
        console.error('[member-notifications] non-JSON upstream');
        return json(res, 502, {
          ok: false,
          code: 'invalid_upstream',
          message: 'Notifications are temporarily unavailable. Please try again.',
        });
      }

      const parsed = parseVaultNotificationsResponse(body);
      if (!parsed.ok) {
        console.error('[member-notifications] sanitize failed:', parsed.reason);
        return json(res, 502, {
          ok: false,
          code: 'invalid_upstream',
          message: 'Notifications are temporarily unavailable. Please try again.',
        });
      }

      return json(res, 200, {
        ok: true,
        ...parsed.inbox,
        skipped: parsed.skipped,
      });
    } catch (err) {
      const aborted = err && (err.name === 'AbortError' || err.code === 'ABORT_ERR');
      console.error('[member-notifications] upstream error:', aborted ? 'timeout' : 'network');
      return json(res, 502, {
        ok: false,
        code: 'vault_unavailable',
        message: 'Notifications are temporarily unavailable. Please try again.',
      });
    } finally {
      clearTimeout(timer);
    }
  }

  // PATCH
  const contentType = String(req.headers?.['content-type'] || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return json(res, 415, {
      ok: false,
      code: 'invalid_content_type',
      message: 'That notifications request was not valid. Please try again.',
    });
  }

  let rawBody = req.body;
  if (typeof rawBody === 'string') {
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_PATCH_BODY_BYTES) {
      return json(res, 413, {
        ok: false,
        code: 'body_too_large',
        message: 'That notifications request was not valid. Please try again.',
      });
    }
    try {
      rawBody = JSON.parse(rawBody);
    } catch {
      return json(res, 400, {
        ok: false,
        code: 'invalid_body',
        message: 'That notifications request was not valid. Please try again.',
      });
    }
  } else if (rawBody == null) {
    return json(res, 400, {
      ok: false,
      code: 'invalid_body',
      message: 'That notifications request was not valid. Please try again.',
    });
  } else if (typeof rawBody === 'object') {
    try {
      const encoded = JSON.stringify(rawBody);
      if (Buffer.byteLength(encoded, 'utf8') > MAX_PATCH_BODY_BYTES) {
        return json(res, 413, {
          ok: false,
          code: 'body_too_large',
          message: 'That notifications request was not valid. Please try again.',
        });
      }
    } catch {
      return json(res, 400, {
        ok: false,
        code: 'invalid_body',
        message: 'That notifications request was not valid. Please try again.',
      });
    }
  } else {
    return json(res, 400, {
      ok: false,
      code: 'invalid_body',
      message: 'That notifications request was not valid. Please try again.',
    });
  }

  const command = parseNotificationsPatchCommand(rawBody);
  if (!command.ok) {
    const status =
      command.reason === 'invalid_notification_id' || command.reason === 'unknown_action'
        ? 400
        : 400;
    return json(res, status, {
      ok: false,
      code:
        command.reason === 'invalid_notification_id'
          ? 'invalid_notification_id'
          : command.reason === 'unknown_action'
            ? 'unknown_action'
            : command.reason === 'extra_fields'
              ? 'extra_fields'
              : 'invalid_body',
      message: 'That notifications request was not valid. Please try again.',
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify(command.vaultBody),
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
      console.error('[member-notifications] non-JSON patch upstream');
      return json(res, 502, {
        ok: false,
        code: 'invalid_upstream',
        message: 'Notifications are temporarily unavailable. Please try again.',
      });
    }

    if (!body || typeof body !== 'object' || body.ok !== true) {
      return json(res, 502, {
        ok: false,
        code: 'invalid_upstream',
        message: 'Notifications are temporarily unavailable. Please try again.',
      });
    }

    if (command.vaultBody.mark_all_read) {
      return json(res, 200, { ok: true, action: 'mark_all_read' });
    }

    const notification = sanitizeMarkReadResult(body.notification);
    if (!notification) {
      // Vault may return ok without notification shape on edge cases — still success
      return json(res, 200, {
        ok: true,
        action: 'mark_read',
        notification: {
          id: command.vaultBody.id,
          readAt: new Date().toISOString(),
        },
      });
    }

    return json(res, 200, {
      ok: true,
      action: 'mark_read',
      notification,
    });
  } catch (err) {
    const aborted = err && (err.name === 'AbortError' || err.code === 'ABORT_ERR');
    console.error('[member-notifications] patch error:', aborted ? 'timeout' : 'network');
    return json(res, 502, {
      ok: false,
      code: 'vault_unavailable',
      message: 'Notifications are temporarily unavailable. Please try again.',
    });
  } finally {
    clearTimeout(timer);
  }
}
