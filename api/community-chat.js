import { createHash } from 'node:crypto';
import { parseBearerAuthorization } from './_utils/memberIdentity.js';
import {
  MAX_CHAT_BODY_BYTES,
  parseChatMessagesListQuery,
  parseChatUnreadQuery,
  parseDirectoryQuery,
  parseHuddleEndCommand,
  parseHuddleStatusQuery,
  parseHuddleTokenCommand,
  parseMarkChatReadCommand,
  parseOpenDmCommand,
  parseSendChatMessageCommand,
  parseVaultChatChannelsResponse,
  parseVaultChatMessageMutationResponse,
  parseVaultChatMessagesResponse,
  parseVaultChatUnreadResponse,
  parseVaultDirectoryResponse,
  parseVaultDmChannelResponse,
  parseVaultHuddleEndResponse,
  parseVaultHuddleStatusesResponse,
  parseVaultHuddleTokenResponse,
  parseHuddleFallbackCommand,
  parseHuddleLineCommand,
  parseVaultDailyTokenResponse,
  parseVaultHuddleLineResponse,
} from './_utils/communityChatSanitize.js';
import {
  buildVaultCommunityChatChannelsUrl,
  buildVaultCommunityChatDmChannelUrl,
  buildVaultCommunityChatHuddleStatusesUrl,
  buildVaultCommunityChatMarkReadUrl,
  buildVaultCommunityChatMentorsUrl,
  buildVaultCommunityChatMessagesUrl,
  buildVaultCommunityChatUnreadUrl,
  buildVaultCommunityChatVoiceEndUrl,
  buildVaultCommunityChatVoiceTokenUrl,
  parseVaultApiOrigin,
  buildVaultHuddleFailsafeUrl,
} from './_utils/vaultOrigin.js';

/**
 * Single serverless function for Connect chat bridges (Hobby function-count limit).
 *
 * GET  /api/community-chat?resource=channels
 * GET  /api/community-chat?resource=messages&channelId=
 * POST /api/community-chat?resource=messages   { channelId, content }
 * GET  /api/community-chat?resource=unread
 * POST /api/community-chat?resource=unread     { channelId }  (mark-read)
 * GET  /api/community-chat?resource=huddle-status&channelIds=
 * POST /api/community-chat?resource=huddle-token  { channelId }
 * POST /api/community-chat?resource=huddle-end    { channelId }
 * GET  /api/community-chat?resource=directory&q=
 * POST /api/community-chat?resource=dm            { partnerId }
 */

const UPSTREAM_TIMEOUT_MS = 15000;
const TOKEN_UPSTREAM_TIMEOUT_MS = 20000;
const ALLOWED_RESOURCES = new Set([
  'channels',
  'messages',
  'unread',
  'huddle-status',
  'huddle-token',
  'huddle-end',
  'huddle-token-fallback',
  'huddle-line',
  'huddle-daily-token',
  'directory',
  'dm',
]);

/** Soft per-identity rate limit for token mints (serverless-local Map). */
const TOKEN_RATE_WINDOW_MS = 60_000;
const TOKEN_RATE_MAX = 8;
/** @type {Map<string, number[]>} */
const tokenRateBuckets = new Map();

function setPrivateNoStore(res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Pragma', 'no-cache');
}

function json(res, status, body) {
  setPrivateNoStore(res);
  res.status(status).json(body);
}

/** Vault refused to START a huddle (member may join once a leader/moderator starts it). */
const HUDDLE_NOT_STARTED_MESSAGE =
  "This huddle hasn't started yet. A leader or room moderator will start it — you can join as soon as it's live.";

function isHuddleStartForbidden(status, body) {
  return status === 403 && body && typeof body === 'object' && body.code === 'huddle_start_forbidden';
}

function huddleNotStarted(res) {
  return json(res, 403, { ok: false, code: 'huddle_not_started', message: HUDDLE_NOT_STARTED_MESSAGE });
}

function mapUpstreamError(res, status, forbiddenMessage) {
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
      message: forbiddenMessage || 'You do not have access to this chat.',
    });
  }
  if (status === 404) {
    return json(res, 404, {
      ok: false,
      code: 'not_found',
      message: 'That channel could not be found.',
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
      message: 'Please check your message and try again.',
    });
  }
  if (status === 503) {
    return json(res, 503, {
      ok: false,
      code: 'huddle_unavailable',
      message: 'Live Huddle is not available right now. Please try again later.',
    });
  }
  console.error('[community-chat] upstream status', status);
  return json(res, 502, {
    ok: false,
    code: 'vault_unavailable',
    message: 'Chat is temporarily unavailable. Please try again.',
  });
}

function parseJsonBody(req) {
  const contentType = String(req.headers?.['content-type'] || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return { ok: false, status: 415, code: 'invalid_content_type' };
  }
  let rawBody = req.body;
  if (typeof rawBody === 'string') {
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_CHAT_BODY_BYTES) {
      return { ok: false, status: 413, code: 'body_too_large' };
    }
    try {
      rawBody = JSON.parse(rawBody);
    } catch {
      return { ok: false, status: 400, code: 'invalid_json' };
    }
  }
  if (rawBody == null) {
    return { ok: false, status: 400, code: 'empty_body' };
  }
  return { ok: true, body: rawBody };
}

/**
 * @param {Record<string, unknown>} query
 */
function parseResource(query) {
  const q = query && typeof query === 'object' ? query : {};
  const raw = q.resource;
  if (Array.isArray(raw)) return { ok: false, reason: 'duplicate_resource' };
  const resource = typeof raw === 'string' ? raw.trim() : '';
  if (!ALLOWED_RESOURCES.has(resource)) return { ok: false, reason: 'invalid_resource' };
  return { ok: true, resource, query: q };
}

/**
 * @param {string} bearerToken
 * @returns {boolean}
 */
function allowHuddleTokenMint(bearerToken) {
  const key = createHash('sha256').update(String(bearerToken || '')).digest('hex').slice(0, 32);
  const now = Date.now();
  let stamps = tokenRateBuckets.get(key) || [];
  stamps = stamps.filter((t) => now - t < TOKEN_RATE_WINDOW_MS);
  if (stamps.length >= TOKEN_RATE_MAX) {
    tokenRateBuckets.set(key, stamps);
    return false;
  }
  stamps.push(now);
  tokenRateBuckets.set(key, stamps);
  return true;
}

/**
 * POST /api/community-chat?resource=huddle-token-fallback { channelId, fallbackPass }
 * → Vault voice-token-fallback (no Supabase on Vault). Bearer optional.
 */
async function handleHuddleTokenFallback(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { ok: false, code: 'method_not_allowed', message: 'Only POST is supported.' });
  }
  const parsedBody = parseJsonBody(req);
  if (!parsedBody.ok) {
    return json(res, parsedBody.status, { ok: false, code: parsedBody.code, message: 'Please try again.' });
  }
  const command = parseHuddleFallbackCommand(parsedBody.body);
  if (!command.ok) {
    return json(res, 400, { ok: false, code: 'invalid_body', message: 'That huddle request was not valid.' });
  }
  if (!allowHuddleTokenMint(`fallback:${command.fallbackPass}`)) {
    return json(res, 429, { ok: false, code: 'rate_limited', message: 'Too many huddle join attempts. Please wait a moment and try again.' });
  }
  const allowHttpLocal = process.env.NODE_ENV !== 'production';
  const originResult = parseVaultApiOrigin(process.env.VAULT_API_ORIGIN, { allowHttpLocal });
  if (!originResult.ok) {
    return json(res, 503, { ok: false, code: 'bridge_unconfigured', message: 'Live Huddle is not available right now.' });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TOKEN_UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetch(buildVaultHuddleFailsafeUrl(originResult.origin, 'fallback'), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId: command.channelId, fallbackPass: command.fallbackPass }),
      signal: controller.signal,
      redirect: 'error',
    });
    let body = null;
    try {
      body = await upstream.json();
    } catch {
      body = null;
    }
    if (isHuddleStartForbidden(upstream.status, body)) return huddleNotStarted(res);
    if (!upstream.ok) {
      return json(res, upstream.status === 401 ? 401 : 502, {
        ok: false,
        code: upstream.status === 401 ? 'fallback_expired' : 'vault_unavailable',
        message:
          upstream.status === 401
            ? 'Saved huddle permission expired. Try again after the church database is back.'
            : 'Could not open the huddle while the church database is down.',
      });
    }
    const parsed = parseVaultHuddleTokenResponse(body);
    if (!parsed.ok) {
      return json(res, 502, { ok: false, code: 'invalid_upstream', message: 'Could not open the huddle while the church database is down.' });
    }
    return json(res, 200, { ok: true, ...parsed.token, fallback: true });
  } catch (err) {
    const aborted = err && (err.name === 'AbortError' || err.code === 'ABORT_ERR');
    console.error('[community-chat] huddle fallback', aborted ? 'timeout' : 'network');
    return json(res, 502, { ok: false, code: 'vault_unavailable', message: 'Could not open the huddle while the church database is down.' });
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  setPrivateNoStore(res);

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, {
      ok: false,
      code: 'method_not_allowed',
      message: 'This endpoint only supports GET and POST.',
    });
  }

  // Database-down fail-safe: the Vault-signed pass is the credential, so this
  // route must work even when the member's session can't be refreshed.
  if (String(req.query?.resource || '') === 'huddle-token-fallback') {
    return handleHuddleTokenFallback(req, res);
  }

  const auth = parseBearerAuthorization(req.headers?.authorization);
  if (!auth.ok) {
    return json(res, 401, {
      ok: false,
      code: 'unauthorized',
      message: 'Please sign in again to continue.',
    });
  }

  const resourceResult = parseResource(req.query || {});
  if (!resourceResult.ok) {
    return json(res, 400, {
      ok: false,
      code: 'invalid_query',
      message: 'That chat request was not valid. Please try again.',
    });
  }

  const allowHttpLocal = process.env.NODE_ENV !== 'production';
  const originResult = parseVaultApiOrigin(process.env.VAULT_API_ORIGIN, {
    allowHttpLocal,
  });
  if (!originResult.ok) {
    console.error('[community-chat] VAULT_API_ORIGIN invalid:', originResult.reason);
    return json(res, 503, {
      ok: false,
      code: 'bridge_unconfigured',
      message: 'Chat is not available right now. Please try again later.',
    });
  }

  const { resource, query } = resourceResult;
  const timeoutMs =
    resource === 'huddle-token' || resource === 'huddle-end' || resource === 'huddle-daily-token'
      ? TOKEN_UPSTREAM_TIMEOUT_MS
      : UPSTREAM_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (resource === 'channels') {
      if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return json(res, 405, {
          ok: false,
          code: 'method_not_allowed',
          message: 'Channels only supports GET.',
        });
      }
      const extras = Object.keys(query).filter((k) => k !== 'resource');
      if (extras.length > 0) {
        return json(res, 400, {
          ok: false,
          code: 'invalid_query',
          message: 'That chat request was not valid. Please try again.',
        });
      }

      const upstream = await fetch(buildVaultCommunityChatChannelsUrl(originResult.origin), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        signal: controller.signal,
        redirect: 'error',
      });
      if (!upstream.ok) {
        return mapUpstreamError(res, upstream.status, 'Chat is not available for this account yet.');
      }
      let body;
      try {
        body = await upstream.json();
      } catch {
        return json(res, 502, {
          ok: false,
          code: 'invalid_upstream',
          message: 'Chat is temporarily unavailable. Please try again.',
        });
      }
      const parsed = parseVaultChatChannelsResponse(body);
      if (!parsed.ok) {
        return json(res, 502, {
          ok: false,
          code: 'invalid_upstream',
          message: 'Chat is temporarily unavailable. Please try again.',
        });
      }
      return json(res, 200, {
        ok: true,
        channels: parsed.channels,
        skipped: parsed.skipped,
      });
    }

    if (resource === 'messages') {
      if (req.method === 'GET') {
        const { resource: _r, ...rest } = query;
        const page = parseChatMessagesListQuery(rest);
        if (!page.ok) {
          return json(res, 400, {
            ok: false,
            code: 'invalid_query',
            message: 'That chat request was not valid. Please try again.',
          });
        }
        const upstream = await fetch(
          buildVaultCommunityChatMessagesUrl(originResult.origin, page.channelId),
          {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${auth.token}`,
            },
            signal: controller.signal,
            redirect: 'error',
          }
        );
        if (!upstream.ok) return mapUpstreamError(res, upstream.status);
        let body;
        try {
          body = await upstream.json();
        } catch {
          return json(res, 502, {
            ok: false,
            code: 'invalid_upstream',
            message: 'Chat is temporarily unavailable. Please try again.',
          });
        }
        const parsed = parseVaultChatMessagesResponse(body);
        if (!parsed.ok) {
          return json(res, 502, {
            ok: false,
            code: 'invalid_upstream',
            message: 'Chat is temporarily unavailable. Please try again.',
          });
        }
        return json(res, 200, {
          ok: true,
          channelId: page.channelId,
          messages: parsed.messages,
          skipped: parsed.skipped,
          truncated: parsed.truncated,
        });
      }

      const parsedBody = parseJsonBody(req);
      if (!parsedBody.ok) {
        return json(res, parsedBody.status, {
          ok: false,
          code: parsedBody.code,
          message:
            parsedBody.code === 'body_too_large'
              ? 'That message is too long.'
              : 'Please check your message and try again.',
        });
      }
      const command = parseSendChatMessageCommand(parsedBody.body);
      if (!command.ok) {
        return json(res, 400, {
          ok: false,
          code: 'invalid_body',
          message:
            command.reason === 'too_long'
              ? 'That message is too long.'
              : 'Please check your message and try again.',
        });
      }
      const upstream = await fetch(buildVaultCommunityChatMessagesUrl(originResult.origin), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({
          channelId: command.channelId,
          content: command.content,
        }),
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
          message: 'Chat is temporarily unavailable. Please try again.',
        });
      }
      const parsed = parseVaultChatMessageMutationResponse(body);
      if (!parsed.ok) {
        return json(res, 502, {
          ok: false,
          code: 'invalid_upstream',
          message: 'Chat is temporarily unavailable. Please try again.',
        });
      }
      return json(res, 200, { ok: true, message: parsed.message });
    }

    if (resource === 'huddle-status') {
      if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return json(res, 405, {
          ok: false,
          code: 'method_not_allowed',
          message: 'Huddle status only supports GET.',
        });
      }
      const { resource: _r, ...rest } = query;
      const page = parseHuddleStatusQuery(rest);
      if (!page.ok) {
        return json(res, 400, {
          ok: false,
          code: 'invalid_query',
          message: 'That huddle request was not valid. Please try again.',
        });
      }
      const upstream = await fetch(
        buildVaultCommunityChatHuddleStatusesUrl(
          originResult.origin,
          page.channelIds.join(',')
        ),
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${auth.token}`,
          },
          signal: controller.signal,
          redirect: 'error',
        }
      );
      if (!upstream.ok) return mapUpstreamError(res, upstream.status);
      let body;
      try {
        body = await upstream.json();
      } catch {
        return json(res, 502, {
          ok: false,
          code: 'invalid_upstream',
          message: 'Chat is temporarily unavailable. Please try again.',
        });
      }
      const parsed = parseVaultHuddleStatusesResponse(body, page.channelIds);
      if (!parsed.ok) {
        return json(res, 502, {
          ok: false,
          code: 'invalid_upstream',
          message: 'Chat is temporarily unavailable. Please try again.',
        });
      }
      return json(res, 200, { ok: true, byChannel: parsed.byChannel });
    }

    if (resource === 'huddle-token') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, {
          ok: false,
          code: 'method_not_allowed',
          message: 'Huddle token only supports POST.',
        });
      }
      if (!allowHuddleTokenMint(auth.token)) {
        return json(res, 429, {
          ok: false,
          code: 'rate_limited',
          message: 'Too many huddle join attempts. Please wait a moment and try again.',
        });
      }
      const parsedBody = parseJsonBody(req);
      if (!parsedBody.ok) {
        return json(res, parsedBody.status, {
          ok: false,
          code: parsedBody.code,
          message: 'Please try again.',
        });
      }
      const command = parseHuddleTokenCommand(parsedBody.body);
      if (!command.ok) {
        return json(res, 400, {
          ok: false,
          code: 'invalid_body',
          message: 'That huddle request was not valid. Please try again.',
        });
      }
      const upstream = await fetch(buildVaultCommunityChatVoiceTokenUrl(originResult.origin), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({ channelId: command.channelId }),
        signal: controller.signal,
        redirect: 'error',
      });
      if (!upstream.ok) {
        if (upstream.status === 403) {
          const errBody = await upstream.json().catch(() => null);
          if (isHuddleStartForbidden(403, errBody)) return huddleNotStarted(res);
        }
        return mapUpstreamError(
          res,
          upstream.status,
          'You do not have access to this Live Huddle.'
        );
      }
      let body;
      try {
        body = await upstream.json();
      } catch {
        return json(res, 502, {
          ok: false,
          code: 'invalid_upstream',
          message: 'Live Huddle is temporarily unavailable. Please try again.',
        });
      }
      const parsed = parseVaultHuddleTokenResponse(body);
      if (!parsed.ok) {
        return json(res, 502, {
          ok: false,
          code: 'invalid_upstream',
          message: 'Live Huddle is temporarily unavailable. Please try again.',
        });
      }
      // Never echo hostId / coHostIds / channelCanModerate / secrets.
      return json(res, 200, { ok: true, ...parsed.token });
    }

    if (resource === 'huddle-line' || resource === 'huddle-daily-token') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, { ok: false, code: 'method_not_allowed', message: 'Only POST is supported.' });
      }
      const parsedBody = parseJsonBody(req);
      if (!parsedBody.ok) {
        return json(res, parsedBody.status, { ok: false, code: parsedBody.code, message: 'Please try again.' });
      }
      if (resource === 'huddle-line') {
        const command = parseHuddleLineCommand(parsedBody.body);
        if (!command.ok) {
          return json(res, 400, { ok: false, code: 'invalid_body', message: 'That huddle request was not valid.' });
        }
        const upstream = await fetch(buildVaultHuddleFailsafeUrl(originResult.origin, 'line'), {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${auth.token}`,
          },
          body: JSON.stringify(
            command.provider ? { channelId: command.channelId, provider: command.provider } : { channelId: command.channelId }
          ),
          signal: controller.signal,
          redirect: 'error',
        });
        let body = null;
        try {
          body = await upstream.json();
        } catch {
          body = null;
        }
        const line = parseVaultHuddleLineResponse(upstream.status, body);
        if (upstream.status === 401) {
          return mapUpstreamError(res, 401);
        }
        if (isHuddleStartForbidden(upstream.status, body)) return huddleNotStarted(res);
        // Reads that fail just mean "unknown line" — the client defaults to LiveKit.
        const status = line.ok ? 200 : upstream.status === 409 ? 409 : upstream.status >= 500 ? 503 : 400;
        return json(res, status, {
          ok: line.ok,
          provider: line.provider,
          occupied: line.occupied,
          ...(line.ok ? {} : { code: line.occupied ? 'huddle_line_busy' : 'huddle_line_unavailable', message: line.error || 'Could not check the huddle line.' }),
        });
      }
      if (!allowHuddleTokenMint(auth.token)) {
        return json(res, 429, { ok: false, code: 'rate_limited', message: 'Too many huddle join attempts. Please wait a moment and try again.' });
      }
      const command = parseHuddleTokenCommand(parsedBody.body);
      if (!command.ok) {
        return json(res, 400, { ok: false, code: 'invalid_body', message: 'That huddle request was not valid.' });
      }
      const upstream = await fetch(buildVaultHuddleFailsafeUrl(originResult.origin, 'daily'), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({ channelId: command.channelId }),
        signal: controller.signal,
        redirect: 'error',
      });
      let body = null;
      try {
        body = await upstream.json();
      } catch {
        body = null;
      }
      if (isHuddleStartForbidden(upstream.status, body)) return huddleNotStarted(res);
      if (!upstream.ok) {
        if (upstream.status === 401) return mapUpstreamError(res, 401);
        const vaultMessage = typeof body?.error === 'string' ? body.error.slice(0, 200) : '';
        return json(res, upstream.status === 409 ? 409 : upstream.status === 503 ? 503 : 502, {
          ok: false,
          code: upstream.status === 503 ? 'backup_line_unconfigured' : 'backup_line_unavailable',
          message: vaultMessage || 'Backup huddle audio is unavailable right now.',
        });
      }
      const parsed = parseVaultDailyTokenResponse(body);
      if (!parsed.ok) {
        return json(res, 502, { ok: false, code: 'invalid_upstream', message: 'Backup huddle audio is unavailable right now.' });
      }
      return json(res, 200, { ok: true, ...parsed.daily });
    }

    if (resource === 'huddle-end') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, {
          ok: false,
          code: 'method_not_allowed',
          message: 'Huddle end only supports POST.',
        });
      }
      const parsedBody = parseJsonBody(req);
      if (!parsedBody.ok) {
        return json(res, parsedBody.status, {
          ok: false,
          code: parsedBody.code,
          message: 'Please try again.',
        });
      }
      const command = parseHuddleEndCommand(parsedBody.body);
      if (!command.ok) {
        return json(res, 400, {
          ok: false,
          code: 'invalid_body',
          message: 'That huddle request was not valid. Please try again.',
        });
      }
      const upstream = await fetch(buildVaultCommunityChatVoiceEndUrl(originResult.origin), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({ channelId: command.channelId }),
        signal: controller.signal,
        redirect: 'error',
      });
      if (!upstream.ok) {
        return mapUpstreamError(
          res,
          upstream.status,
          'Only moderators can end the Live Huddle for everyone.'
        );
      }
      let body;
      try {
        body = await upstream.json();
      } catch {
        return json(res, 502, {
          ok: false,
          code: 'invalid_upstream',
          message: 'Live Huddle is temporarily unavailable. Please try again.',
        });
      }
      const parsed = parseVaultHuddleEndResponse(body);
      if (!parsed.ok) {
        return json(res, 502, {
          ok: false,
          code: 'invalid_upstream',
          message: 'Live Huddle is temporarily unavailable. Please try again.',
        });
      }
      return json(res, 200, {
        ok: true,
        ended: parsed.ended,
        channelId: command.channelId,
      });
    }

    if (resource === 'directory') {
      if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return json(res, 405, {
          ok: false,
          code: 'method_not_allowed',
          message: 'Directory only supports GET.',
        });
      }
      const page = parseDirectoryQuery(query);
      if (!page.ok) {
        const message =
          page.reason === 'query_too_long'
            ? 'That search is too long. Please try a shorter name.'
            : page.reason === 'query_too_short' || page.reason === 'missing_q'
              ? 'Type a name to find someone to message.'
              : 'That search was not valid. Please try again.';
        return json(res, 400, {
          ok: false,
          code: 'invalid_query',
          message,
        });
      }
      const upstream = await fetch(buildVaultCommunityChatMentorsUrl(originResult.origin), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        signal: controller.signal,
        redirect: 'error',
      });
      if (!upstream.ok) {
        return mapUpstreamError(
          res,
          upstream.status,
          'Member search is not available for this account yet.'
        );
      }
      let body;
      try {
        body = await upstream.json();
      } catch {
        return json(res, 502, {
          ok: false,
          code: 'invalid_upstream',
          message: 'Chat is temporarily unavailable. Please try again.',
        });
      }
      const parsed = parseVaultDirectoryResponse(body, page.q);
      if (!parsed.ok) {
        return json(res, 502, {
          ok: false,
          code: 'invalid_upstream',
          message: 'Chat is temporarily unavailable. Please try again.',
        });
      }
      return json(res, 200, { ok: true, members: parsed.members });
    }

    if (resource === 'dm') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, {
          ok: false,
          code: 'method_not_allowed',
          message: 'Direct messages only supports POST.',
        });
      }
      const parsedBody = parseJsonBody(req);
      if (!parsedBody.ok) {
        return json(res, parsedBody.status, {
          ok: false,
          code: parsedBody.code,
          message: 'Please try again.',
        });
      }
      const command = parseOpenDmCommand(parsedBody.body);
      if (!command.ok) {
        return json(res, 400, {
          ok: false,
          code: 'invalid_body',
          message: 'That member could not be messaged. Please try again.',
        });
      }
      const upstream = await fetch(
        buildVaultCommunityChatDmChannelUrl(originResult.origin, command.partnerId),
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${auth.token}`,
          },
          signal: controller.signal,
          redirect: 'error',
        }
      );
      if (!upstream.ok) {
        return mapUpstreamError(
          res,
          upstream.status,
          'You cannot start a direct message with that member.'
        );
      }
      let body;
      try {
        body = await upstream.json();
      } catch {
        return json(res, 502, {
          ok: false,
          code: 'invalid_upstream',
          message: 'Chat is temporarily unavailable. Please try again.',
        });
      }
      const parsed = parseVaultDmChannelResponse(body, command.partnerId);
      if (!parsed.ok) {
        return json(res, 502, {
          ok: false,
          code: 'invalid_upstream',
          message: 'Chat is temporarily unavailable. Please try again.',
        });
      }
      return json(res, 200, {
        ok: true,
        channel: parsed.channel,
        partnerId: parsed.partnerId,
      });
    }

    // resource === 'unread'
    if (req.method === 'GET') {
      const { resource: _r, ...rest } = query;
      const q = parseChatUnreadQuery(rest);
      if (!q.ok) {
        return json(res, 400, {
          ok: false,
          code: 'invalid_query',
          message: 'That chat request was not valid. Please try again.',
        });
      }
      const upstream = await fetch(buildVaultCommunityChatUnreadUrl(originResult.origin), {
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
        return json(res, 502, {
          ok: false,
          code: 'invalid_upstream',
          message: 'Chat is temporarily unavailable. Please try again.',
        });
      }
      const parsed = parseVaultChatUnreadResponse(body);
      if (!parsed.ok) {
        return json(res, 502, {
          ok: false,
          code: 'invalid_upstream',
          message: 'Chat is temporarily unavailable. Please try again.',
        });
      }
      return json(res, 200, {
        ok: true,
        count: parsed.count,
        byChannel: parsed.byChannel,
      });
    }

    const parsedBody = parseJsonBody(req);
    if (!parsedBody.ok) {
      return json(res, parsedBody.status, {
        ok: false,
        code: parsedBody.code,
        message: 'Please try again.',
      });
    }
    const command = parseMarkChatReadCommand(parsedBody.body);
    if (!command.ok) {
      return json(res, 400, {
        ok: false,
        code: 'invalid_body',
        message: 'That chat request was not valid. Please try again.',
      });
    }
    const upstream = await fetch(buildVaultCommunityChatMarkReadUrl(originResult.origin), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify({ channelId: command.channelId }),
      signal: controller.signal,
      redirect: 'error',
    });
    if (!upstream.ok) {
      return mapUpstreamError(res, upstream.status);
    }
    return json(res, 200, { ok: true, channelId: command.channelId });
  } catch (err) {
    const aborted = err && typeof err === 'object' && err.name === 'AbortError';
    console.error('[community-chat]', aborted ? 'timeout' : 'fetch_failed');
    return json(res, 502, {
      ok: false,
      code: 'vault_unavailable',
      message: 'Chat is temporarily unavailable. Please try again.',
    });
  } finally {
    clearTimeout(timer);
  }
}
