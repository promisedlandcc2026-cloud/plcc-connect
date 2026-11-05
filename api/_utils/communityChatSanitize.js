/**
 * Sanitize Vault Community chat (channels / messages / unread / huddle / DM directory) for Connect.
 * Text chat, DMs, start/join huddle, moderator end — no attachments, huddle-mod, or AI identity.
 */

import { sanitizeAvatarUrl } from './memberIdentity.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Conservative Connect message length (Vault accepts longer; keep mobile-safe). */
export const CHAT_MESSAGE_MAX_CHARS = 4000;
export const MAX_CHAT_BODY_BYTES = 8192;
/** Cap history returned to Connect even if Vault returns more. */
export const CONNECT_CHAT_MESSAGE_LIMIT = 200;
/** Max channel IDs accepted on huddle-status batch poll. */
export const HUDDLE_STATUS_MAX_CHANNELS = 50;
/** Cap LiveKit JWT length passed to the client. */
export const HUDDLE_TOKEN_MAX_CHARS = 8192;
/** Directory search bounds (require a query — no empty browse). */
export const DIRECTORY_QUERY_MIN_CHARS = 1;
export const DIRECTORY_QUERY_MAX_CHARS = 40;
export const DIRECTORY_RESULT_LIMIT = 25;

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function asNullableString(value) {
  if (value == null) return null;
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length ? t : null;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function asIsoTimestamp(value) {
  const raw = asNullableString(value);
  if (!raw) return null;
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString();
}

/**
 * @param {unknown} content
 * @returns {{ ok: true, content: string } | { ok: false, reason: string }}
 */
export function validateConnectChatContent(content) {
  if (typeof content !== 'string') return { ok: false, reason: 'invalid_content' };
  const trimmed = content.trim();
  if (!trimmed) return { ok: false, reason: 'empty' };
  if (trimmed.length > CHAT_MESSAGE_MAX_CHARS) return { ok: false, reason: 'too_long' };
  return { ok: true, content: trimmed };
}

/**
 * GET query: exactly channelId UUID.
 * @param {Record<string, unknown> | null | undefined} query
 */
export function parseChatMessagesListQuery(query) {
  const q = query && typeof query === 'object' ? query : {};
  const keys = Object.keys(q);
  if (keys.length === 0) return { ok: false, reason: 'missing_channel_id' };
  if (keys.some((k) => k !== 'channelId')) return { ok: false, reason: 'unexpected_param' };
  if (keys.length !== 1) return { ok: false, reason: 'unexpected_param' };
  const raw = q.channelId;
  if (Array.isArray(raw)) return { ok: false, reason: 'duplicate_channel_id' };
  const channelId = asNullableString(raw);
  if (!channelId || !UUID_RE.test(channelId)) return { ok: false, reason: 'invalid_channel_id' };
  return { ok: true, channelId };
}

/**
 * Unread GET: empty query only (no client since — Vault uses server read status).
 * @param {Record<string, unknown> | null | undefined} query
 */
export function parseChatUnreadQuery(query) {
  const q = query && typeof query === 'object' ? query : {};
  if (Object.keys(q).length > 0) return { ok: false, reason: 'unexpected_param' };
  return { ok: true };
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, channelId: string, content: string } | { ok: false, reason: string }}
 */
export function parseSendChatMessageCommand(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, reason: 'invalid_body' };
  }
  /** @type {Record<string, unknown>} */
  const body = raw;
  const keys = Object.keys(body);
  const allowed = new Set(['channelId', 'content']);
  if (keys.some((k) => !allowed.has(k))) return { ok: false, reason: 'unexpected_field' };

  const channelId = asNullableString(body.channelId);
  if (!channelId || !UUID_RE.test(channelId)) return { ok: false, reason: 'invalid_channel_id' };

  const contentResult = validateConnectChatContent(body.content);
  if (!contentResult.ok) return { ok: false, reason: contentResult.reason };

  return { ok: true, channelId, content: contentResult.content };
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, channelId: string } | { ok: false, reason: string }}
 */
export function parseMarkChatReadCommand(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, reason: 'invalid_body' };
  }
  /** @type {Record<string, unknown>} */
  const body = raw;
  const keys = Object.keys(body);
  if (keys.some((k) => k !== 'channelId')) return { ok: false, reason: 'unexpected_field' };
  const channelId = asNullableString(body.channelId);
  if (!channelId || !UUID_RE.test(channelId)) return { ok: false, reason: 'invalid_channel_id' };
  return { ok: true, channelId };
}

/**
 * @param {unknown} channel
 */
export function sanitizeChatChannel(channel) {
  if (!channel || typeof channel !== 'object' || Array.isArray(channel)) return null;
  /** @type {Record<string, unknown>} */
  const c = channel;
  const id = asNullableString(c.id);
  if (!id || !UUID_RE.test(id)) return null;

  const visibilityRaw = asNullableString(c.visibility)?.toLowerCase() || null;
  const type = asNullableString(c.type)?.toLowerCase() || null;
  const rawName = asNullableString(c.name) || 'Channel';
  const isDm =
    visibilityRaw === 'dm' ||
    rawName.startsWith('DM_') ||
    (type === 'private' && rawName.startsWith('DM_'));

  const ministryIdRaw =
    asNullableString(c.ministry_id) || asNullableString(c.ministryId);
  // A direct message never belongs to a ministry, so it can't show up on a
  // Ministry Hub's channel list.
  const ministryId =
    !isDm && ministryIdRaw && UUID_RE.test(ministryIdRaw) ? ministryIdRaw : null;

  return {
    id,
    name: isDm ? 'Direct message' : rawName,
    description: isDm ? null : asNullableString(c.description),
    visibility: isDm ? 'dm' : visibilityRaw || (type === 'public' ? 'open' : type),
    type: type || (isDm ? 'private' : 'public'),
    ministryId,
  };
}

/**
 * @param {unknown} body
 */
export function parseVaultChatChannelsResponse(body) {
  if (!Array.isArray(body)) return { ok: false, reason: 'invalid_shape' };
  const channels = [];
  let skipped = 0;
  for (const row of body) {
    const sanitized = sanitizeChatChannel(row);
    if (sanitized) channels.push(sanitized);
    else skipped += 1;
  }
  return { ok: true, channels, skipped };
}

/**
 * @param {unknown} message
 */
export function sanitizeChatMessage(message) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) return null;
  /** @type {Record<string, unknown>} */
  const m = message;
  const id = asNullableString(m.id);
  if (!id || !UUID_RE.test(id)) return null;

  const channelId =
    asNullableString(m.channel_id) || asNullableString(m.channelId);
  if (!channelId || !UUID_RE.test(channelId)) return null;

  const isDeleted = Boolean(m.is_deleted || m.isDeleted || m.deleted_at);
  const createdAt = asIsoTimestamp(m.created_at) || asIsoTimestamp(m.createdAt);
  if (!createdAt) return null;

  const authorId = asNullableString(m.user_id) || asNullableString(m.userId);
  const authorName =
    asNullableString(m.display_name) ||
    asNullableString(m.displayName) ||
    asNullableString(m.user_name) ||
    asNullableString(m.userName) ||
    (authorId ? 'Member' : 'Vault AI');
  const avatarUrl = sanitizeAvatarUrl(
    asNullableString(m.avatar_url) || asNullableString(m.avatarUrl)
  );

  /** @type {{ id: string, name: string, avatarUrl: string | null } | null} */
  let author = null;
  if (authorId && UUID_RE.test(authorId)) {
    author = { id: authorId, name: authorName || 'Member', avatarUrl };
  } else if (!authorId) {
    // Server rows (no user) — only the Vault server writes these, so the known system names are trusted.
    if (asNullableString(m.user_name) === 'PLCC Prayer Requests') {
      author = { id: 'awc-prayer-requests', name: 'PLCC Prayer Requests', avatarUrl: null };
    } else {
      author = { id: 'vault-ai', name: 'Vault AI', avatarUrl: null };
    }
  } else {
    return null;
  }

  let parent = null;
  if (m.parent && typeof m.parent === 'object' && !Array.isArray(m.parent)) {
    /** @type {Record<string, unknown>} */
    const p = m.parent;
    const parentId = asNullableString(p.id);
    if (parentId && UUID_RE.test(parentId)) {
      parent = {
        id: parentId,
        name: asNullableString(p.user_name) || asNullableString(p.userName) || 'Member',
        content: p.is_deleted || p.isDeleted ? null : asNullableString(p.content),
        isDeleted: Boolean(p.is_deleted || p.isDeleted),
      };
    }
  }

  return {
    id,
    channelId,
    content: isDeleted ? '' : asNullableString(m.content) || '',
    isDeleted,
    createdAt,
    author,
    parent,
  };
}

/**
 * @param {unknown} body
 */
export function parseVaultChatMessagesResponse(body) {
  if (!Array.isArray(body)) return { ok: false, reason: 'invalid_shape' };
  const messages = [];
  let skipped = 0;
  for (const row of body) {
    const sanitized = sanitizeChatMessage(row);
    if (sanitized) messages.push(sanitized);
    else skipped += 1;
  }
  const capped =
    messages.length > CONNECT_CHAT_MESSAGE_LIMIT
      ? messages.slice(messages.length - CONNECT_CHAT_MESSAGE_LIMIT)
      : messages;
  return {
    ok: true,
    messages: capped,
    skipped,
    truncated: messages.length > CONNECT_CHAT_MESSAGE_LIMIT,
  };
}

/**
 * @param {unknown} body
 */
export function parseVaultChatMessageMutationResponse(body) {
  const sanitized = sanitizeChatMessage(body);
  if (!sanitized) return { ok: false, reason: 'malformed_message' };
  return { ok: true, message: sanitized };
}

/**
 * @param {unknown} body
 */
export function parseVaultChatUnreadResponse(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, reason: 'invalid_shape' };
  }
  /** @type {Record<string, unknown>} */
  const b = body;
  const countRaw = b.count;
  const count =
    typeof countRaw === 'number' && Number.isFinite(countRaw)
      ? Math.max(0, Math.floor(countRaw))
      : 0;

  /** @type {Record<string, number>} */
  const byChannel = {};
  if (b.byChannel && typeof b.byChannel === 'object' && !Array.isArray(b.byChannel)) {
    for (const [key, value] of Object.entries(b.byChannel)) {
      if (!UUID_RE.test(key)) continue;
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      byChannel[key] = Math.max(0, Math.floor(value));
    }
  }

  return { ok: true, count, byChannel };
}

/**
 * GET query: channelIds=uuid,uuid,… (1–HUDDLE_STATUS_MAX_CHANNELS).
 * @param {Record<string, unknown> | null | undefined} query
 */
export function parseHuddleStatusQuery(query) {
  const q = query && typeof query === 'object' ? query : {};
  const keys = Object.keys(q);
  if (keys.length === 0) return { ok: false, reason: 'missing_channel_ids' };
  if (keys.some((k) => k !== 'channelIds')) return { ok: false, reason: 'unexpected_param' };
  const raw = q.channelIds;
  if (Array.isArray(raw)) return { ok: false, reason: 'duplicate_channel_ids' };
  const csv = asNullableString(raw);
  if (!csv) return { ok: false, reason: 'missing_channel_ids' };

  const parts = csv.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return { ok: false, reason: 'missing_channel_ids' };
  if (parts.length > HUDDLE_STATUS_MAX_CHANNELS) {
    return { ok: false, reason: 'too_many_channel_ids' };
  }

  /** @type {string[]} */
  const channelIds = [];
  const seen = new Set();
  for (const id of parts) {
    if (!UUID_RE.test(id)) return { ok: false, reason: 'invalid_channel_id' };
    if (seen.has(id)) continue;
    seen.add(id);
    channelIds.push(id);
  }
  if (channelIds.length === 0) return { ok: false, reason: 'missing_channel_ids' };
  return { ok: true, channelIds };
}

/**
 * POST body: { channelId } only — shared by huddle-token and huddle-end.
 * @param {unknown} raw
 */
export function parseHuddleTokenCommand(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, reason: 'invalid_body' };
  }
  /** @type {Record<string, unknown>} */
  const body = raw;
  const keys = Object.keys(body);
  if (keys.some((k) => k !== 'channelId')) return { ok: false, reason: 'unexpected_field' };
  const channelId = asNullableString(body.channelId);
  if (!channelId || !UUID_RE.test(channelId)) return { ok: false, reason: 'invalid_channel_id' };
  return { ok: true, channelId };
}

/** Alias for huddle-end body (same shape as token). */
export const parseHuddleEndCommand = parseHuddleTokenCommand;

/**
 * Normalize directory search text: trim and strip leading @ (mention habit).
 * @param {string} raw
 * @returns {string}
 */
export function normalizeDirectoryQuery(raw) {
  return String(raw || '')
    .trim()
    .replace(/^@+/, '')
    .trim();
}

/**
 * GET query: resource=directory&q= (bounded; required).
 * @param {Record<string, unknown> | null | undefined} query
 */
export function parseDirectoryQuery(query) {
  const q = query && typeof query === 'object' ? query : {};
  const keys = Object.keys(q);
  if (keys.some((k) => k !== 'q' && k !== 'resource')) {
    return { ok: false, reason: 'unexpected_param' };
  }
  const raw = q.q;
  if (Array.isArray(raw)) return { ok: false, reason: 'duplicate_q' };
  if (raw == null || typeof raw !== 'string') return { ok: false, reason: 'missing_q' };
  const trimmed = normalizeDirectoryQuery(raw);
  if (!trimmed) return { ok: false, reason: 'missing_q' };
  if (trimmed.length < DIRECTORY_QUERY_MIN_CHARS) {
    return { ok: false, reason: 'query_too_short' };
  }
  if (trimmed.length > DIRECTORY_QUERY_MAX_CHARS) {
    return { ok: false, reason: 'query_too_long' };
  }
  return { ok: true, q: trimmed };
}

/**
 * POST body: { partnerId } only.
 * @param {unknown} raw
 */
export function parseOpenDmCommand(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, reason: 'invalid_body' };
  }
  /** @type {Record<string, unknown>} */
  const body = raw;
  const keys = Object.keys(body);
  if (keys.some((k) => k !== 'partnerId')) return { ok: false, reason: 'unexpected_field' };
  const partnerId = asNullableString(body.partnerId);
  if (!partnerId || !UUID_RE.test(partnerId)) return { ok: false, reason: 'invalid_partner_id' };
  return { ok: true, partnerId };
}

/**
 * @param {unknown} row
 * @returns {{ id: string, name: string, avatarUrl: string | null } | null}
 */
export function sanitizeDirectoryMember(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  /** @type {Record<string, unknown>} */
  const u = row;
  const id = asNullableString(u.id);
  if (!id || !UUID_RE.test(id)) return null;
  const name = asNullableString(u.name);
  if (!name) return null;
  return {
    id,
    name,
    avatarUrl: sanitizeAvatarUrl(
      asNullableString(u.avatar_url) || asNullableString(u.avatarUrl)
    ),
  };
}

/**
 * Vault mentors array → filtered, sanitized directory (no email/role).
 * @param {unknown} body
 * @param {string} q
 */
export function parseVaultDirectoryResponse(body, q) {
  if (!Array.isArray(body)) return { ok: false, reason: 'invalid_shape' };
  const needle = normalizeDirectoryQuery(q).toLowerCase();
  if (!needle) return { ok: false, reason: 'missing_q' };

  /** @type {Array<{ id: string, name: string, avatarUrl: string | null }>} */
  const members = [];
  for (const row of body) {
    const sanitized = sanitizeDirectoryMember(row);
    if (!sanitized) continue;
    if (!sanitized.name.toLowerCase().includes(needle)) continue;
    members.push(sanitized);
    if (members.length >= DIRECTORY_RESULT_LIMIT) break;
  }
  return { ok: true, members };
}

/**
 * Vault dm-channel row → Connect channel + partnerId echo.
 * @param {unknown} body
 * @param {string} partnerId
 */
export function parseVaultDmChannelResponse(body, partnerId) {
  const channel = sanitizeChatChannel(body);
  if (!channel) return { ok: false, reason: 'malformed_channel' };
  return {
    ok: true,
    channel: {
      ...channel,
      visibility: 'dm',
      name: channel.visibility === 'dm' ? channel.name : 'Direct message',
    },
    partnerId,
  };
}

/**
 * Vault voice-huddle-end → { ok, ended }.
 * @param {unknown} body
 */
export function parseVaultHuddleEndResponse(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, reason: 'invalid_shape' };
  }
  /** @type {Record<string, unknown>} */
  const b = body;
  if (b.ok === false) return { ok: false, reason: 'not_ok' };
  return {
    ok: true,
    ended: Boolean(b.ended),
    roomName: asNullableString(b.roomName) || asNullableString(b.room_name),
  };
}

/**
 * @param {unknown} entry
 * @returns {{ active: boolean, participantCount: number } | null}
 */
function sanitizeHuddleStatusEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  /** @type {Record<string, unknown>} */
  const e = entry;
  const active = Boolean(e.active || e.live);
  const countRaw = e.participantCount ?? e.participant_count;
  const participantCount =
    typeof countRaw === 'number' && Number.isFinite(countRaw)
      ? Math.max(0, Math.floor(countRaw))
      : 0;
  return { active, participantCount };
}

/**
 * Vault: { ok, configured?, byChannel: { [uuid]: { active, participantCount } } }
 * Connect: { byChannel: { [uuid]: { live, participantCount } } }
 * @param {unknown} body
 * @param {string[]} [requestedIds]
 */
export function parseVaultHuddleStatusesResponse(body, requestedIds) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, reason: 'invalid_shape' };
  }
  /** @type {Record<string, unknown>} */
  const b = body;
  if (b.ok === false) return { ok: false, reason: 'not_ok' };

  const allow =
    Array.isArray(requestedIds) && requestedIds.length > 0
      ? new Set(requestedIds)
      : null;

  /** @type {Record<string, { live: boolean, participantCount: number }>} */
  const byChannel = {};
  const src =
    b.byChannel && typeof b.byChannel === 'object' && !Array.isArray(b.byChannel)
      ? b.byChannel
      : {};

  for (const [key, value] of Object.entries(src)) {
    if (!UUID_RE.test(key)) continue;
    if (allow && !allow.has(key)) continue;
    const entry = sanitizeHuddleStatusEntry(value);
    if (!entry) continue;
    byChannel[key] = {
      live: entry.active,
      participantCount: entry.participantCount,
    };
  }

  // Ensure requested IDs appear (inactive) so the client can clear LIVE badges.
  if (allow) {
    for (const id of allow) {
      if (!(id in byChannel)) {
        byChannel[id] = { live: false, participantCount: 0 };
      }
    }
  }

  return { ok: true, byChannel };
}

/**
 * LiveKit URL must be https or wss — never leak arbitrary schemes.
 * @param {unknown} value
 * @returns {string | null}
 */
function sanitizeLiveKitUrl(value) {
  const raw = asNullableString(value);
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'wss:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Vault voice-token → Connect join payload. Drops host/coHost/channelCanModerate/etc.
 * @param {unknown} body
 */
export function parseVaultHuddleTokenResponse(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, reason: 'invalid_shape' };
  }
  /** @type {Record<string, unknown>} */
  const b = body;
  if (b.ok === false) return { ok: false, reason: 'not_ok' };

  const token = asNullableString(b.token);
  if (!token || token.length > HUDDLE_TOKEN_MAX_CHARS) {
    return { ok: false, reason: 'invalid_token' };
  }
  // Reject obvious secret leakage in the JWT payload field names we never expect.
  if (/LIVEKIT_API_SECRET|api[_-]?secret/i.test(token)) {
    return { ok: false, reason: 'invalid_token' };
  }

  const url = sanitizeLiveKitUrl(b.url);
  if (!url) return { ok: false, reason: 'invalid_url' };

  const roomName = asNullableString(b.roomName) || asNullableString(b.room_name);
  if (!roomName || roomName.length > 256) return { ok: false, reason: 'invalid_room' };

  const channelId =
    asNullableString(b.channelId) || asNullableString(b.channel_id);
  if (!channelId || !UUID_RE.test(channelId)) {
    return { ok: false, reason: 'invalid_channel_id' };
  }

  const channelName =
    asNullableString(b.channelName) ||
    asNullableString(b.channel_name) ||
    'Channel';

  const expiresRaw = b.expiresIn ?? b.expires_in;
  const expiresIn =
    typeof expiresRaw === 'number' && Number.isFinite(expiresRaw)
      ? Math.max(0, Math.floor(expiresRaw))
      : 0;

  return {
    ok: true,
    token: {
      token,
      url,
      roomName,
      expiresIn,
      canModerate: Boolean(b.canModerate),
      channelId,
      channelName,
      // Vault-signed 12h permission to reopen this huddle while Supabase is down.
      // Opaque to Connect: stored on the member's phone, sent back only to Vault.
      ...(sanitizeHuddleFallbackPass(b.fallbackPass) ? { fallbackPass: sanitizeHuddleFallbackPass(b.fallbackPass) } : {}),
      ...(b.fallback === true ? { fallback: true } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Huddle fail-safes (mirrors PLCC Canaan huddleFallbackPass.ts + huddleProvider.ts)
// ---------------------------------------------------------------------------

export const HUDDLE_FALLBACK_PASS_MAX_CHARS = 2048;
const FALLBACK_PASS_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/** @param {unknown} value */
export function sanitizeHuddleFallbackPass(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw || raw.length > HUDDLE_FALLBACK_PASS_MAX_CHARS) return null;
  return FALLBACK_PASS_RE.test(raw) ? raw : null;
}

/** POST body for huddle-token-fallback: { channelId, fallbackPass } only. */
export function parseHuddleFallbackCommand(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false };
  const keys = Object.keys(body).sort();
  if (keys.join(',') !== 'channelId,fallbackPass') return { ok: false };
  const channelId = typeof body.channelId === 'string' ? body.channelId.trim() : '';
  if (!UUID_RE.test(channelId)) return { ok: false };
  const fallbackPass = sanitizeHuddleFallbackPass(body.fallbackPass);
  if (!fallbackPass) return { ok: false };
  return { ok: true, channelId, fallbackPass };
}

/** POST body for huddle-line: { channelId, provider? } where provider is livekit|daily. */
export function parseHuddleLineCommand(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false };
  for (const k of Object.keys(body)) if (k !== 'channelId' && k !== 'provider') return { ok: false };
  const channelId = typeof body.channelId === 'string' ? body.channelId.trim() : '';
  if (!UUID_RE.test(channelId)) return { ok: false };
  if (body.provider === undefined) return { ok: true, channelId, provider: null };
  if (body.provider !== 'livekit' && body.provider !== 'daily') return { ok: false };
  return { ok: true, channelId, provider: body.provider };
}

/** @param {unknown} value */
function lineName(value) {
  return value === 'daily' || value === 'livekit' ? value : null;
}

/** Vault voice-huddle-provider → { provider, occupied, error } (no other fields). */
export function parseVaultHuddleLineResponse(status, body) {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const error = typeof b.error === 'string' ? b.error.slice(0, 200) : null;
  return {
    ok: status >= 200 && status < 300 && b.ok !== false,
    provider: lineName(b.provider),
    occupied: b.occupied === true,
    ...(error ? { error } : {}),
  };
}

/** Daily room URLs only (https://<team>.daily.co/<room>). */
export function sanitizeDailyUrl(value) {
  const raw = asNullableString(value);
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return null;
    if (!/(^|\.)daily\.co$/i.test(u.hostname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Vault voice-daily-token → backup-line join payload. */
export function parseVaultDailyTokenResponse(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false };
  if (body.ok === false) return { ok: false };
  const token = asNullableString(body.token);
  if (!token || token.length > HUDDLE_TOKEN_MAX_CHARS) return { ok: false };
  const url = sanitizeDailyUrl(body.url);
  if (!url) return { ok: false };
  const channelId = asNullableString(body.channelId);
  if (!channelId || !UUID_RE.test(channelId)) return { ok: false };
  const expiresRaw = body.expiresIn;
  return {
    ok: true,
    daily: {
      provider: 'daily',
      token,
      url,
      roomName: (asNullableString(body.roomName) || '').slice(0, 256),
      expiresIn: typeof expiresRaw === 'number' && Number.isFinite(expiresRaw) ? Math.max(0, Math.floor(expiresRaw)) : 0,
      channelId,
    },
  };
}

export { UUID_RE };
