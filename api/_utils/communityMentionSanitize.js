/**
 * Sanitize Vault mention-candidates responses for Connect.
 * Strips role, emailHint, and any contact/admin fields.
 */

import { sanitizeAvatarUrl } from './memberIdentity.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Vault feed picker fragment max; Connect rejects longer queries. */
export const MENTION_QUERY_MIN_CHARS = 1;
export const MENTION_QUERY_MAX_CHARS = 40;
/** Matches Vault feed mention-candidates limit. */
export const MENTION_RESULT_LIMIT = 20;

/**
 * Structured Vault mention token.
 * @[Display Name](mention:uuid)
 */
export const FEED_MENTION_TOKEN_RE =
  /@\[([^\]]{1,80})\]\(mention:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi;

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
 * Accept only `q`. Reject empty directory browse and oversized queries.
 * @param {Record<string, unknown> | null | undefined} query
 * @returns {{ ok: true, q: string } | { ok: false, reason: string }}
 */
export function parseMentionsListQuery(query) {
  const q = query && typeof query === 'object' ? query : {};
  const keys = Object.keys(q);
  if (keys.length === 0) return { ok: false, reason: 'missing_q' };
  if (keys.some((k) => k !== 'q')) return { ok: false, reason: 'unexpected_param' };
  if (keys.length !== 1) return { ok: false, reason: 'unexpected_param' };

  const raw = q.q;
  if (Array.isArray(raw)) return { ok: false, reason: 'duplicate_q' };
  if (raw == null) return { ok: false, reason: 'missing_q' };

  const trimmed = String(raw).trim();
  if (!trimmed) return { ok: false, reason: 'query_too_short' };
  if (trimmed.length < MENTION_QUERY_MIN_CHARS) {
    return { ok: false, reason: 'query_too_short' };
  }
  if (trimmed.length > MENTION_QUERY_MAX_CHARS) {
    return { ok: false, reason: 'query_too_long' };
  }
  // Block trivial wildcards / enumeration probes
  if (trimmed === '*' || trimmed === '%' || trimmed === '_') {
    return { ok: false, reason: 'query_too_short' };
  }

  return { ok: true, q: trimmed };
}

/**
 * @param {unknown} row
 * @returns {{ id: string, name: string, avatarUrl: string | null } | null}
 */
export function sanitizeMentionCandidate(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  /** @type {Record<string, unknown>} */
  const r = row;
  const id = asNullableString(r.id);
  if (!id || !UUID_RE.test(id)) return null;
  const nameRaw = asNullableString(r.name) || 'Member';
  const name = nameRaw.replace(/[\[\]]/g, '').slice(0, 80) || 'Member';
  return {
    id,
    name,
    avatarUrl: sanitizeAvatarUrl(r.avatar_url ?? r.avatarUrl),
  };
}

/**
 * @param {unknown} body
 * @returns {{ ok: true, candidates: object[], skipped: number } | { ok: false, reason: string }}
 */
export function parseVaultMentionsResponse(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, reason: 'invalid_shape' };
  }
  /** @type {Record<string, unknown>} */
  const b = body;
  if (b.ok !== true) return { ok: false, reason: 'not_ok' };
  if (!Array.isArray(b.candidates)) return { ok: false, reason: 'missing_candidates' };

  const candidates = [];
  let skipped = 0;
  const seen = new Set();
  for (const row of b.candidates) {
    if (candidates.length >= MENTION_RESULT_LIMIT) break;
    const c = sanitizeMentionCandidate(row);
    if (!c) {
      skipped += 1;
      continue;
    }
    if (seen.has(c.id)) {
      skipped += 1;
      continue;
    }
    seen.add(c.id);
    candidates.push(c);
  }

  return { ok: true, candidates, skipped };
}

/**
 * Build Vault mention token from a sanitized candidate.
 * @param {string} displayName
 * @param {string} userId
 * @returns {string | null}
 */
export function buildFeedMentionToken(displayName, userId) {
  const name =
    String(displayName || 'Member')
      .trim()
      .replace(/[\[\]]/g, '')
      .slice(0, 80) || 'Member';
  const id = String(userId || '').trim();
  if (!UUID_RE.test(id)) return null;
  return `@[${name}](mention:${id})`;
}

/**
 * Friendly display: @[Name](mention:uuid) → @Name. Never HTML.
 * @param {string} content
 * @returns {string}
 */
export function formatFeedContentForDisplay(content) {
  return String(content || '').replace(FEED_MENTION_TOKEN_RE, (_full, name) => {
    const n = String(name || '').trim() || 'Member';
    return `@${n}`;
  });
}

/**
 * Extract mention UUIDs from content (deduped).
 * @param {string} content
 * @returns {string[]}
 */
export function extractFeedMentionIds(content) {
  const ids = [];
  const seen = new Set();
  const re = new RegExp(FEED_MENTION_TOKEN_RE.source, 'gi');
  let m;
  while ((m = re.exec(String(content || ''))) !== null) {
    const id = String(m[2] || '').toLowerCase();
    if (!UUID_RE.test(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export { UUID_RE };
