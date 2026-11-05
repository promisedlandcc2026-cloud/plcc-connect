/**
 * Sanitize Family Huddle Vault payloads for Connect.
 */

export const FAMILY_GUEST_NAME_MAX = 40;
export const MAX_FAMILY_HUDDLE_BODY_BYTES = 4096;
export const FAMILY_HUDDLE_TOKEN_MAX_CHARS = 8192;

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
 * @param {unknown} raw
 */
export function parseGuestRedeemBody(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, reason: 'invalid_body' };
  }
  /** @type {Record<string, unknown>} */
  const body = raw;
  const keys = Object.keys(body);
  const allowed = new Set(['token', 'code', 'displayName']);
  if (keys.some((k) => !allowed.has(k))) return { ok: false, reason: 'unexpected_field' };

  const token =
    asNullableString(body.token) || asNullableString(body.code);
  if (!token || token.length > 200) return { ok: false, reason: 'invalid_token' };

  const displayName = asNullableString(body.displayName);
  if (!displayName || displayName.length > FAMILY_GUEST_NAME_MAX) {
    return { ok: false, reason: 'invalid_name' };
  }
  return { ok: true, token, displayName };
}

/**
 * @param {unknown} body
 */
export function parseFamilyHuddleStatusResponse(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, reason: 'invalid_shape' };
  }
  /** @type {Record<string, unknown>} */
  const b = body;
  if (b.ok === false) return { ok: false, reason: 'not_ok' };
  return {
    ok: true,
    configured: Boolean(b.configured !== false),
    live: Boolean(b.live || b.active),
    participantCount:
      typeof b.participantCount === 'number' && Number.isFinite(b.participantCount)
        ? Math.max(0, Math.floor(b.participantCount))
        : 0,
    householdName: asNullableString(b.householdName),
  };
}

/**
 * @param {unknown} body
 */
export function parseFamilyHuddleTokenResponse(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, reason: 'invalid_shape' };
  }
  /** @type {Record<string, unknown>} */
  const b = body;
  if (b.ok === false) return { ok: false, reason: 'not_ok' };

  const token = asNullableString(b.token);
  if (!token || token.length > FAMILY_HUDDLE_TOKEN_MAX_CHARS) {
    return { ok: false, reason: 'invalid_token' };
  }
  if (/LIVEKIT_API_SECRET|api[_-]?secret/i.test(token)) {
    return { ok: false, reason: 'invalid_token' };
  }
  const url = sanitizeLiveKitUrl(b.url);
  if (!url) return { ok: false, reason: 'invalid_url' };
  const roomName = asNullableString(b.roomName) || asNullableString(b.room_name);
  if (!roomName || roomName.length > 256) return { ok: false, reason: 'invalid_room' };
  // Never echo household UUID to clients.
  if (asNullableString(b.householdId) || asNullableString(b.household_id)) {
    /* strip — ignore */
  }

  return {
    ok: true,
    token: {
      token,
      url,
      roomName,
      expiresIn:
        typeof b.expiresIn === 'number' && Number.isFinite(b.expiresIn)
          ? Math.max(0, Math.floor(b.expiresIn))
          : 0,
      canModerate: Boolean(b.canModerate),
      isGuest: Boolean(b.isGuest),
      displayName: asNullableString(b.displayName) || 'Family',
      householdName: asNullableString(b.householdName),
    },
  };
}

/**
 * @param {unknown} body
 */
export function parseFamilyInviteCreateResponse(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, reason: 'invalid_shape' };
  }
  /** @type {Record<string, unknown>} */
  const b = body;
  if (b.ok === false) return { ok: false, reason: 'not_ok' };
  const code = asNullableString(b.code);
  const path = asNullableString(b.path);
  if (!code || !path) return { ok: false, reason: 'invalid_invite' };
  if (path.includes('://') || !path.startsWith('/family/huddle/join')) {
    return { ok: false, reason: 'invalid_path' };
  }
  return {
    ok: true,
    code,
    path,
    expiresAt: asNullableString(b.expiresAt) || asNullableString(b.expires_at),
    maxUses:
      typeof b.maxUses === 'number' && Number.isFinite(b.maxUses)
        ? Math.floor(b.maxUses)
        : 10,
    householdName: asNullableString(b.householdName),
  };
}

/**
 * @param {unknown} body
 */
export function parseFamilyHuddleEndResponse(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, reason: 'invalid_shape' };
  }
  /** @type {Record<string, unknown>} */
  const b = body;
  if (b.ok === false) return { ok: false, reason: 'not_ok' };
  return { ok: true, ended: Boolean(b.ended) };
}
