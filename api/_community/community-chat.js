import { parseMusicCommand, sanitizeMusicAnswer } from '../_utils/musicBridge.js';
import { createHash } from 'node:crypto';
import { parseBearerAuthorization } from '../_utils/memberIdentity.js';
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
  sanitizeDmList,
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
  parseHuddleModerateCommand,
} from '../_utils/communityChatSanitize.js';
import {
  buildVaultCommunityChatChannelsUrl,
  buildVaultCommunityChatDmChannelUrl,
  buildVaultCommunityChatDmListUrl,
  buildVaultCommunityChatHuddleStatusesUrl,
  buildVaultCommunityChatMarkReadUrl,
  buildVaultCommunityChatMentorsUrl,
  buildVaultCommunityChatMessagesUrl,
  buildVaultCommunityChatUnreadUrl,
  buildVaultCommunityChatVoiceEndUrl,
  buildVaultCommunityChatVoiceTokenUrl,
  parseVaultApiOrigin,
  buildVaultHuddleFailsafeUrl,
  buildVaultCommunityChatIssuesUrl,
} from '../_utils/vaultOrigin.js';
import {
  bridgeIssueCode,
  issueAreaForResource,
  issueChannelId,
  sanitizeClientIssue,
  sanitizeIssueRow,
  shouldReportBridgeFailure,
} from '../_utils/issueReport.js';

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
  'dm-list',
  'dm-call',
  'huddle-moderate',
  'huddle-songs',
  'member-conduct',
  'issue-report',
  'issues',
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
  // Remember the failure so the handler wrapper can add it to Issues (Account → Issues).
  if (status >= 400) res.__plccFail = { status, code: body && typeof body === 'object' ? body.code : null };
  setPrivateNoStore(res);
  res.status(status).json(body);
}

/** Vault refused to START a huddle (member may join once a leader/moderator starts it). */
const HUDDLE_NOT_STARTED_MESSAGE =
  "This Ka Link hasn't started yet. A leader or room moderator will start it — you can join as soon as it's live.";

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
      message: 'Live Ka Link is not available right now. Please try again later.',
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
    return json(res, 400, { ok: false, code: 'invalid_body', message: 'That Ka Link request was not valid.' });
  }
  if (!allowHuddleTokenMint(`fallback:${command.fallbackPass}`)) {
    return json(res, 429, { ok: false, code: 'rate_limited', message: 'Too many Ka Link join attempts. Please wait a moment and try again.' });
  }
  const allowHttpLocal = process.env.NODE_ENV !== 'production';
  const originResult = parseVaultApiOrigin(process.env.VAULT_API_ORIGIN, { allowHttpLocal });
  if (!originResult.ok) {
    return json(res, 503, { ok: false, code: 'bridge_unconfigured', message: 'Live Ka Link is not available right now.' });
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
            ? 'Saved Ka Link permission expired. Try again after the church database is back.'
            : 'Could not open the Ka Link while the church database is down.',
      });
    }
    const parsed = parseVaultHuddleTokenResponse(body);
    if (!parsed.ok) {
      return json(res, 502, { ok: false, code: 'invalid_upstream', message: 'Could not open the Ka Link while the church database is down.' });
    }
    return json(res, 200, { ok: true, ...parsed.token, fallback: true });
  } catch (err) {
    const aborted = err && (err.name === 'AbortError' || err.code === 'ABORT_ERR');
    console.error('[community-chat] huddle fallback', aborted ? 'timeout' : 'network');
    return json(res, 502, { ok: false, code: 'vault_unavailable', message: 'Could not open the Ka Link while the church database is down.' });
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  try {
    return await handleBridge(req, res);
  } finally {
    const fail = res.__plccFail;
    const resource = String(req.query?.resource || '');
    if (fail && shouldReportBridgeFailure(resource, fail.status, fail.code)) {
      await reportBridgeIssue(req, resource, fail.status, fail.code);
    }
  }
}

/** Tell Canaan's Issues log a member hit a failure here, with the member's own sign-in. */
async function reportBridgeIssue(req, resource, status, code) {
  try {
    const auth = parseBearerAuthorization(req.headers?.authorization);
    if (!auth.ok) return;
    const originResult = parseVaultApiOrigin(process.env.VAULT_API_ORIGIN, {
      allowHttpLocal: process.env.NODE_ENV !== 'production',
    });
    if (!originResult.ok) return;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 4000);
    try {
      await fetch(buildVaultCommunityChatIssuesUrl(originResult.origin, 'issue-report'), {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({
          source: 'tribes-server',
          area: issueAreaForResource(resource),
          code: bridgeIssueCode(resource, status, code),
          status,
          message: `Tribes ${resource} answered ${status}${code ? ` (${code})` : ''}`,
          channelId: issueChannelId(req),
          path: `/api/community-chat?resource=${resource}`,
        }),
        signal: ctl.signal,
        redirect: 'error',
      });
    } finally {
      clearTimeout(t);
    }
  } catch (err) {
    console.error('[community-chat] issue report failed', resource, status, err && err.name);
  }
}

async function handleBridge(req, res) {
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
    if (resource === 'dm-list') {
      if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return json(res, 405, { ok: false, code: 'method_not_allowed', message: 'Only GET is supported.' });
      }
      if (Object.keys(query).some((key) => key !== 'resource')) return json(res, 400, { ok: false, code: 'invalid_query', message: 'That chat request was not valid.' });
      const upstream = await fetch(buildVaultCommunityChatDmListUrl(originResult.origin), {
        method: 'GET', headers: { Accept: 'application/json', Authorization: `Bearer ${auth.token}` },
        signal: controller.signal, redirect: 'error',
      });
      if (!upstream.ok) return mapUpstreamError(res, upstream.status);
      const body = await upstream.json().catch(() => null);
      if (!body || !Array.isArray(body.conversations)) return json(res, 502, { ok: false, code: 'invalid_upstream', message: 'Direct messages are temporarily unavailable.' });
      return json(res, 200, { ok: true, conversations: sanitizeDmList(body) });
    }

    if (resource === 'huddle-songs') {
      // #12 song library: play links for this room's moderators; the music team (Nov 19)
      // and managers also list, upload (bought music only) and delete. Canaan decides who may.
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, { ok: false, code: 'method_not_allowed', message: 'Only POST is supported.' });
      }
      const parsedBody = parseJsonBody(req);
      const command = parseMusicCommand(parsedBody.ok ? parsedBody.body : null);
      if (!command) return json(res, 400, { ok: false, code: 'invalid_body', message: 'That request was not valid.' });
      const upstream = await fetch(buildVaultCommunityChatIssuesUrl(originResult.origin, 'ka-link-songs'), {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify(command),
        signal: controller.signal,
        redirect: 'error',
      });
      const body = await upstream.json().catch(() => null);
      if (!upstream.ok) {
        if ([400, 403, 503].includes(upstream.status) && typeof body?.error === 'string') {
          return json(res, upstream.status, { ok: false, code: upstream.status === 503 ? 'not_set_up' : 'songs_refused', message: body.error.slice(0, 200) });
        }
        return mapUpstreamError(res, upstream.status);
      }
      const answer = sanitizeMusicAnswer(command.action, body);
      if (!answer) return json(res, 502, { ok: false, code: 'invalid_upstream', message: 'Could not start the upload. Please try again.' });
      return json(res, 200, { ok: true, ...answer });
    }

    if (resource === 'huddle-moderate') {
      // Phase 2 moderator tools. Canaan checks the caller really is a Ka Link moderator.
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, { ok: false, code: 'method_not_allowed', message: 'Only POST is supported.' });
      }
      const parsedBody = parseJsonBody(req);
      const command = parseHuddleModerateCommand(parsedBody.ok ? parsedBody.body : null);
      if (!command) {
        return json(res, 400, { ok: false, code: 'invalid_body', message: 'That request was not valid.' });
      }
      const upstream = await fetch(buildVaultCommunityChatIssuesUrl(originResult.origin, command.subResource), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify(command.forward),
        signal: controller.signal,
        redirect: 'error',
      });
      const body = await upstream.json().catch(() => null);
      if (!upstream.ok) {
        // Canaan's moderator errors are written for people ("That person is not in the Ka Link").
        if ([400, 403, 404, 503].includes(upstream.status) && typeof body?.error === 'string') {
          return json(res, upstream.status, {
            ok: false,
            code: upstream.status === 403 ? 'forbidden' : 'moderate_failed',
            message: body.error.replace(/[\u0000-\u001f]/g, ' ').slice(0, 160),
          });
        }
        return mapUpstreamError(res, upstream.status, 'Only Ka Link moderators can do that.');
      }
      return json(res, 200, {
        ok: true,
        action: command.action,
        asked: body?.unmuteRequested === true,
        micLock: body?.micLock === true,
        readerIds: Array.isArray(body?.readerIds)
          ? body.readerIds.filter((id) => typeof id === 'string' && id.length <= 128).slice(0, 12)
          : [],
      });
    }

    if (resource === 'dm-call') {
      // Private audio / video calls in a DM. Canaan checks both people, blocks and paused members.
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, { ok: false, code: 'method_not_allowed', message: 'Only POST is supported.' });
      }
      const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const parsedBody = parseJsonBody(req);
      const b = parsedBody.ok && parsedBody.body && typeof parsedBody.body === 'object' ? parsedBody.body : null;
      const action = String(b?.action || '');
      if (!b || !['inbox', 'pending', 'ring', 'join', 'decline', 'end', 'status'].includes(action) || (action !== 'inbox' && action !== 'pending' && !UUID.test(String(b.channelId || '')))) {
        return json(res, 400, { ok: false, code: 'invalid_body', message: 'That call request was not valid.' });
      }
      const upstream = await fetch(buildVaultCommunityChatIssuesUrl(originResult.origin, 'dm-call'), {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({ action, channelId: action === 'inbox' || action === 'pending' ? null : String(b.channelId), video: b.video === true }),
        signal: controller.signal,
        redirect: 'error',
      });
      const body = await upstream.json().catch(() => null);
      if (!upstream.ok) {
        const status = [400, 403, 409, 410, 503].includes(upstream.status) ? upstream.status : 502;
        return json(res, status, {
          ok: false,
          code: typeof body?.code === 'string' ? body.code.slice(0, 40) : 'call_failed',
          message: String(body?.error || 'The call did not go through. Please try again.').replace(/[\u0000-\u001f]/g, ' ').slice(0, 200),
        });
      }
      const str = (v, max = 4096) => (typeof v === 'string' ? v.slice(0, max) : null);
      return json(res, 200, {
        ok: true,
        topic: str(body?.topic, 80),
        ringSeconds: Number(body?.ringSeconds) || 45,
        token: str(body?.token),
        url: str(body?.url, 300),
        channelId: str(body?.channelId, 64),
        partnerId: str(body?.partnerId, 64),
        callerId: str(body?.callerId, 64),
        callerName: str(body?.callerName, 120),
        video: body?.video === true,
        active: body?.active === true,
        ringing: body?.ringing === true,
        reason: str(body?.reason, 20),
      });
    }
    if (resource === 'member-conduct') {
      // Warn, then block, an unruly member (moderators / leaders). Canaan checks who may.
      const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (req.method === 'GET') {
        const params = new URLSearchParams();
        if (String(query.can || '') === '1') params.set('can', '1');
        const target = String(query.targetUserId || '');
        const cid = String(query.channelId || '');
        if (UUID.test(target)) params.set('targetUserId', target);
        if (UUID.test(cid)) params.set('channelId', cid);
        if (!params.has('can') && !params.has('targetUserId')) {
          return json(res, 400, { ok: false, code: 'invalid_query', message: 'Pick the member first.' });
        }
        const upstream = await fetch(`${buildVaultCommunityChatIssuesUrl(originResult.origin, 'member-conduct')}&${params.toString()}`, {
          method: 'GET',
          headers: { Accept: 'application/json', Authorization: `Bearer ${auth.token}` },
          signal: controller.signal,
          redirect: 'error',
        });
        const body = await upstream.json().catch(() => null);
        if (!upstream.ok) {
          return json(res, upstream.status === 403 ? 403 : 502, { ok: false, code: 'forbidden', message: String(body?.error || 'Not allowed.').slice(0, 200) });
        }
        return json(res, 200, { ok: true, canModerate: body?.canModerate === true, status: body?.status || null });
      }
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'GET, POST');
        return json(res, 405, { ok: false, code: 'method_not_allowed', message: 'Only GET and POST are supported.' });
      }
      const parsedBody = parseJsonBody(req);
      const b = parsedBody.ok && parsedBody.body && typeof parsedBody.body === 'object' ? parsedBody.body : null;
      const action = String(b?.action || '');
      if (!b || !['warn', 'block'].includes(action) || !UUID.test(String(b.targetUserId || ''))) {
        return json(res, 400, { ok: false, code: 'invalid_body', message: 'That request was not valid.' });
      }
      const upstream = await fetch(buildVaultCommunityChatIssuesUrl(originResult.origin, 'member-conduct'), {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({
          action,
          targetUserId: String(b.targetUserId),
          reason: typeof b.reason === 'string' ? b.reason.slice(0, 200) : null,
          place: ['call', 'chat', 'post'].includes(String(b.place)) ? String(b.place) : 'chat',
          channelId: UUID.test(String(b.channelId || '')) ? String(b.channelId) : null,
          postId: typeof b.postId === 'string' ? b.postId.slice(0, 64) : null,
          app: 'tribes',
        }),
        signal: controller.signal,
        redirect: 'error',
      });
      const body = await upstream.json().catch(() => null);
      if (!upstream.ok) {
        return json(res, [400, 403, 409, 503].includes(upstream.status) ? upstream.status : 502, {
          ok: false,
          code: 'conduct_failed',
          message: String(body?.error || 'Could not do that. Please try again.').slice(0, 200),
        });
      }
      return json(res, 200, { ok: true, status: body?.status || null });
    }
    if (resource === 'issue-report') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, { ok: false, code: 'method_not_allowed', message: 'Only POST is supported.' });
      }
      const parsedBody = parseJsonBody(req);
      if (!parsedBody.ok) return json(res, parsedBody.status || 400, { ok: false, code: parsedBody.code || 'invalid_body', message: 'Invalid report.' });
      const report = sanitizeClientIssue(parsedBody.body);
      if (!report) return json(res, 400, { ok: false, code: 'invalid_body', message: 'Invalid report.' });
      const upstream = await fetch(buildVaultCommunityChatIssuesUrl(originResult.origin, 'issue-report'), {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify(report),
        signal: controller.signal,
        redirect: 'error',
      });
      if (!upstream.ok) return mapUpstreamError(res, upstream.status);
      return json(res, 200, { ok: true });
    }
    if (resource === 'issues') {
      if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return json(res, 405, { ok: false, code: 'method_not_allowed', message: 'Only GET is supported.' });
      }
      const check = String(query.check || '') === '1';
      const days = Math.min(Math.max(parseInt(String(query.days || '7'), 10) || 7, 1), 90);
      const url = `${buildVaultCommunityChatIssuesUrl(originResult.origin, 'issues')}&${check ? 'check=1' : `days=${days}`}`;
      const upstream = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: `Bearer ${auth.token}` },
        signal: controller.signal,
        redirect: 'error',
      });
      if (check) {
        // Members just get allowed:false (the menu link stays hidden).
        if (!upstream.ok) return json(res, 200, { ok: true, allowed: false });
        const body = await upstream.json().catch(() => null);
        return json(res, 200, { ok: true, allowed: body?.allowed === true });
      }
      if (!upstream.ok) return mapUpstreamError(res, upstream.status, 'Only church leaders can see Issues.');
      const body = await upstream.json().catch(() => null);
      const issues = Array.isArray(body?.issues) ? body.issues.map(sanitizeIssueRow).filter(Boolean) : [];
      return json(res, 200, { ok: true, issues });
    }

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
      if (upstream.status === 403) {
        // Blocked after a warning: say why.
        const denied = await upstream.json().catch(() => null);
        if (denied?.code === 'member_blocked' && typeof denied?.error === 'string') {
          return json(res, 403, { ok: false, code: 'member_blocked', message: denied.error.slice(0, 200) });
        }
        return mapUpstreamError(res, 403);
      }
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
          message: 'Ka Link status only supports GET.',
        });
      }
      const { resource: _r, ...rest } = query;
      const page = parseHuddleStatusQuery(rest);
      if (!page.ok) {
        return json(res, 400, {
          ok: false,
          code: 'invalid_query',
          message: 'That Ka Link request was not valid. Please try again.',
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
          message: 'Ka Link token only supports POST.',
        });
      }
      if (!allowHuddleTokenMint(auth.token)) {
        return json(res, 429, {
          ok: false,
          code: 'rate_limited',
          message: 'Too many Ka Link join attempts. Please wait a moment and try again.',
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
          message: 'That Ka Link request was not valid. Please try again.',
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
          if (errBody && errBody.code === 'member_blocked') {
            return json(res, 403, { ok: false, code: 'member_blocked', message: String(errBody.error || '').slice(0, 200) });
          }
        }
        if (upstream.status === 409) {
          const errBody = await upstream.json().catch(() => null);
          if (errBody && errBody.code === 'HUDDLE_ROOM_FULL') {
            // All 50 seats taken: the app offers PLCC Sanctum's overflow room.
            return json(res, 409, {
              ok: false,
              code: 'huddle_room_full',
              message: 'This prayer room is full.',
              capacity: typeof errBody.capacity === 'number' ? errBody.capacity : 50,
            });
          }
        }
        return mapUpstreamError(
          res,
          upstream.status,
          'You do not have access to this Live Ka Link.'
        );
      }
      let body;
      try {
        body = await upstream.json();
      } catch {
        return json(res, 502, {
          ok: false,
          code: 'invalid_upstream',
          message: 'Live Ka Link is temporarily unavailable. Please try again.',
        });
      }
      const parsed = parseVaultHuddleTokenResponse(body);
      if (!parsed.ok) {
        return json(res, 502, {
          ok: false,
          code: 'invalid_upstream',
          message: 'Live Ka Link is temporarily unavailable. Please try again.',
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
          return json(res, 400, { ok: false, code: 'invalid_body', message: 'That Ka Link request was not valid.' });
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
          ...(line.ok ? {} : { code: line.occupied ? 'huddle_line_busy' : 'huddle_line_unavailable', message: line.error || 'Could not check the Ka Link line.' }),
        });
      }
      if (!allowHuddleTokenMint(auth.token)) {
        return json(res, 429, { ok: false, code: 'rate_limited', message: 'Too many Ka Link join attempts. Please wait a moment and try again.' });
      }
      const command = parseHuddleTokenCommand(parsedBody.body);
      if (!command.ok) {
        return json(res, 400, { ok: false, code: 'invalid_body', message: 'That Ka Link request was not valid.' });
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
          message: vaultMessage || 'Backup Ka Link audio is unavailable right now.',
        });
      }
      const parsed = parseVaultDailyTokenResponse(body);
      if (!parsed.ok) {
        return json(res, 502, { ok: false, code: 'invalid_upstream', message: 'Backup Ka Link audio is unavailable right now.' });
      }
      return json(res, 200, { ok: true, ...parsed.daily });
    }

    if (resource === 'huddle-end') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, {
          ok: false,
          code: 'method_not_allowed',
          message: 'Ka Link end only supports POST.',
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
          message: 'That Ka Link request was not valid. Please try again.',
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
          'Only moderators can end the Live Ka Link for everyone.'
        );
      }
      let body;
      try {
        body = await upstream.json();
      } catch {
        return json(res, 502, {
          ok: false,
          code: 'invalid_upstream',
          message: 'Live Ka Link is temporarily unavailable. Please try again.',
        });
      }
      const parsed = parseVaultHuddleEndResponse(body);
      if (!parsed.ok) {
        return json(res, 502, {
          ok: false,
          code: 'invalid_upstream',
          message: 'Live Ka Link is temporarily unavailable. Please try again.',
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
