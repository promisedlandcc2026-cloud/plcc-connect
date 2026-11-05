/**
 * Sanitize Vault Community feed list responses for Connect (read-only).
 */

import { sanitizeAvatarUrl } from './memberIdentity.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const FEED_CATEGORIES = new Set([
  'general',
  'prayer',
  'praise',
  'ministry_update',
  'event',
  'encouragement',
]);

const FEED_REACTIONS = new Set(['love', 'pray', 'praise', 'like']);

/** Exact Vault emoji map (communityFeed.ts) — used when upstream omits emoji. */
export const FEED_REACTION_EMOJI = {
  love: '❤️',
  pray: '🙏',
  praise: '🙌',
  like: '👍',
};

export const FEED_REACTION_LABELS = {
  love: 'Love',
  pray: 'Pray',
  praise: 'Praise',
  like: 'Like',
};

const MAX_REACTION_BODY_BYTES = 2048;

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;

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
 * Allow only narrowly validated pagination inputs.
 * Rejects unexpected query keys.
 * @param {Record<string, unknown> | null | undefined} query
 * @returns {{ ok: true, limit: number, offset: number } | { ok: false, reason: string }}
 */
export function parseFeedPaginationQuery(query) {
  const q = query && typeof query === 'object' ? query : {};
  const allowed = new Set(['limit', 'offset']);
  for (const key of Object.keys(q)) {
    if (!allowed.has(key)) {
      return { ok: false, reason: 'unexpected_param' };
    }
  }

  let limit = DEFAULT_PAGE_SIZE;
  if (q.limit != null && q.limit !== '') {
    const n = Number(Array.isArray(q.limit) ? q.limit[0] : q.limit);
    if (!Number.isFinite(n) || n < 1 || n > MAX_PAGE_SIZE || Math.floor(n) !== n) {
      return { ok: false, reason: 'invalid_limit' };
    }
    limit = n;
  }

  let offset = 0;
  if (q.offset != null && q.offset !== '') {
    const n = Number(Array.isArray(q.offset) ? q.offset[0] : q.offset);
    if (!Number.isFinite(n) || n < 0 || n > 10_000 || Math.floor(n) !== n) {
      return { ok: false, reason: 'invalid_offset' };
    }
    offset = n;
  }

  return { ok: true, limit, offset };
}

/**
 * @param {unknown} author
 * @returns {{ id: string, name: string, avatarUrl: string | null } | null}
 */
function sanitizeAuthor(author) {
  if (!author || typeof author !== 'object' || Array.isArray(author)) return null;
  /** @type {Record<string, unknown>} */
  const a = author;
  const id = asNullableString(a.id);
  if (!id || !UUID_RE.test(id)) return null;
  const name = asNullableString(a.name) || 'Member';
  // Never use email for display/initials
  return {
    id,
    name,
    avatarUrl: sanitizeAvatarUrl(a.avatar_url ?? a.avatarUrl),
  };
}

/**
 * @param {unknown} reactions
 * @returns {{ key: string, emoji: string, count: number, reactedByMe: boolean }[]}
 */
export function sanitizeReactions(reactions) {
  if (!Array.isArray(reactions)) return [];
  const out = [];
  for (const row of reactions) {
    if (!row || typeof row !== 'object') continue;
    /** @type {Record<string, unknown>} */
    const r = row;
    const key = asNullableString(r.key);
    if (!key || !FEED_REACTIONS.has(key)) continue;
    const emoji =
      asNullableString(r.emoji) || FEED_REACTION_EMOJI[key] || '';
    const count = Number(r.count);
    if (!Number.isFinite(count) || count < 0 || count > 1_000_000) continue;
    out.push({
      key,
      emoji,
      count: Math.floor(count),
      reactedByMe: Boolean(r.reactedByMe),
    });
  }
  return out;
}

/**
 * Validate Connect reaction POST body → fixed Vault reaction payload.
 * Accepts legacy `{ postId, reaction }` or `{ targetType, targetId, reaction }`.
 * @param {unknown} body
 * @returns {{ ok: true, targetType: 'post'|'comment', targetId: string, reaction: string, vaultBody: object } | { ok: false, reason: string }}
 */
export function parseCommunityReactionCommand(body) {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, reason: 'invalid_body' };
  }
  /** @type {Record<string, unknown>} */
  const b = body;
  const keys = Object.keys(b);

  const forbidden = new Set([
    'userId',
    'user_id',
    'authorId',
    'author_id',
    'author',
    'role',
    'resource',
    'subResource',
    'feedType',
    'host',
    'origin',
    'url',
  ]);
  for (const k of keys) {
    if (forbidden.has(k)) return { ok: false, reason: 'extra_fields' };
  }

  const reaction = asNullableString(b.reaction);
  if (!reaction || !FEED_REACTIONS.has(reaction)) {
    return { ok: false, reason: 'invalid_reaction' };
  }

  // Legacy post-only shape
  if (keys.includes('postId') && !keys.includes('targetType') && !keys.includes('targetId')) {
    const allowed = new Set(['postId', 'reaction']);
    for (const k of keys) {
      if (!allowed.has(k)) return { ok: false, reason: 'extra_fields' };
    }
    const postId = asNullableString(b.postId);
    if (!postId || !UUID_RE.test(postId)) {
      return { ok: false, reason: 'invalid_target_id' };
    }
    return {
      ok: true,
      targetType: 'post',
      targetId: postId,
      reaction,
      vaultBody: {
        targetType: 'post',
        targetId: postId,
        reaction,
      },
    };
  }

  // Explicit target shape
  const allowed = new Set(['targetType', 'targetId', 'reaction']);
  for (const k of keys) {
    if (!allowed.has(k)) return { ok: false, reason: 'extra_fields' };
  }
  if (!keys.includes('targetType') || !keys.includes('targetId') || !keys.includes('reaction')) {
    return { ok: false, reason: 'missing_fields' };
  }

  const targetType = asNullableString(b.targetType);
  if (targetType !== 'post' && targetType !== 'comment') {
    return { ok: false, reason: 'invalid_target_type' };
  }
  const targetId = asNullableString(b.targetId);
  if (!targetId || !UUID_RE.test(targetId)) {
    return { ok: false, reason: 'invalid_target_id' };
  }

  return {
    ok: true,
    targetType,
    targetId,
    reaction,
    vaultBody: {
      targetType,
      targetId,
      reaction,
    },
  };
}

/**
 * @param {unknown} body
 * @param {{ targetType: 'post'|'comment', targetId: string }} target
 * @returns {{ ok: true, result: object } | { ok: false, reason: string }}
 */
export function parseVaultReactionResponse(body, target) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, reason: 'invalid_shape' };
  }
  /** @type {Record<string, unknown>} */
  const b = body;
  if (b.ok !== true) return { ok: false, reason: 'not_ok' };
  const action = asNullableString(b.action);
  if (action !== 'insert' && action !== 'delete') {
    return { ok: false, reason: 'invalid_action' };
  }
  const reactions = sanitizeReactions(b.reactions);
  const targetType = target.targetType;
  const targetId = target.targetId;
  /** @type {Record<string, unknown>} */
  const result = {
    targetType,
    targetId,
    action,
    reactions,
  };
  // Backward-compatible alias for post reactions
  if (targetType === 'post') {
    result.postId = targetId;
  }
  return { ok: true, result };
}

/**
 * @param {unknown} post
 * @param {{ viewerId?: string | null }} [opts]
 * @returns {object | null}
 */
export function sanitizeFeedPost(post, opts = {}) {
  if (!post || typeof post !== 'object' || Array.isArray(post)) return null;
  /** @type {Record<string, unknown>} */
  const p = post;
  const id = asNullableString(p.id);
  if (!id || !UUID_RE.test(id)) return null;

  const author = sanitizeAuthor(p.author);
  if (!author) return null;

  const category = asNullableString(p.category) || 'general';
  const categoryLabel =
    asNullableString(p.categoryLabel) ||
    (FEED_CATEGORIES.has(category) ? category : 'General');

  // Prefer raw Vault content (keeps mention tokens for editing). Display via formatFeedContentForDisplay.
  const content =
    asNullableString(p.content) || asNullableString(p.contentDisplay) || '';

  const createdAt = asIsoTimestamp(p.created_at);
  if (!createdAt) return null;

  const commentCount = Number(p.commentCount);
  const safeCommentCount =
    Number.isFinite(commentCount) && commentCount >= 0 ? Math.floor(commentCount) : 0;

  const imageUrl = sanitizeAvatarUrl(p.imageUrl); // same http(s) guard
  const imageAlt = imageUrl ? asNullableString(p.imageAlt) || `Photo from ${author.name}` : null;

  // Self-only capabilities — never forward Vault canRemove (may include moderators).
  const viewerId = asNullableString(opts.viewerId);
  const authoredByMe = Boolean(viewerId && viewerId === author.id);

  return {
    id,
    category: FEED_CATEGORIES.has(category) ? category : 'general',
    categoryLabel,
    content,
    createdAt,
    updatedAt: asIsoTimestamp(p.updated_at),
    edited: Boolean(p.edited),
    pinned: Boolean(p.pinned),
    author,
    imageUrl,
    imageAlt,
    commentCount: safeCommentCount,
    reactions: sanitizeReactions(p.reactions),
    authoredByMe,
    canEditOwnPost: authoredByMe,
    canDeleteOwnPost: authoredByMe,
  };
}

/**
 * @param {unknown} body
 * @param {{ viewerId?: string | null }} [opts]
 * @returns {{ ok: true, feed: object, skipped: number } | { ok: false, reason: string }}
 */
export function parseVaultCommunityFeedResponse(body, opts = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, reason: 'not_object' };
  }
  /** @type {Record<string, unknown>} */
  const b = body;
  if (b.ok !== true) {
    return { ok: false, reason: 'not_ok' };
  }
  if (!Array.isArray(b.posts)) {
    return { ok: false, reason: 'missing_posts' };
  }

  const posts = [];
  let skipped = 0;
  for (const row of b.posts) {
    const card = sanitizeFeedPost(row, opts);
    if (card) posts.push(card);
    else skipped += 1;
  }

  const pageSizeRaw = Number(b.pageSize);
  const offsetRaw = Number(b.offset);
  const pageSize =
    Number.isFinite(pageSizeRaw) && pageSizeRaw >= 1
      ? Math.min(MAX_PAGE_SIZE, Math.floor(pageSizeRaw))
      : DEFAULT_PAGE_SIZE;
  const offset =
    Number.isFinite(offsetRaw) && offsetRaw >= 0 ? Math.floor(offsetRaw) : 0;

  return {
    ok: true,
    skipped,
    feed: {
      posts,
      pageSize,
      offset,
      hasMore: Boolean(b.hasMore),
    },
  };
}

/**
 * Validate single-post query: exactly one `id` UUID. Reject duplicates / extras.
 * @param {Record<string, unknown> | null | undefined} query
 * @returns {{ ok: true, id: string } | { ok: false, reason: string }}
 */
export function parseCommunityPostQuery(query) {
  const q = query && typeof query === 'object' ? query : {};
  const keys = Object.keys(q);
  if (keys.length === 0) return { ok: false, reason: 'missing_id' };
  if (keys.some((k) => k !== 'id')) return { ok: false, reason: 'unexpected_param' };
  if (keys.length !== 1) return { ok: false, reason: 'unexpected_param' };

  const raw = q.id;
  if (Array.isArray(raw)) return { ok: false, reason: 'duplicate_id' };
  if (raw == null || raw === '') return { ok: false, reason: 'missing_id' };
  const id = String(raw).trim();
  if (!UUID_RE.test(id)) return { ok: false, reason: 'invalid_id' };
  return { ok: true, id };
}

/**
 * Parse Vault deep-link single-post response into one sanitized card.
 * @param {unknown} body
 * @param {{ viewerId?: string | null }} [opts]
 * @returns {{ ok: true, post: object, skipped: number } | { ok: false, reason: string }}
 */
export function parseVaultSinglePostResponse(body, opts = {}) {
  const parsed = parseVaultCommunityFeedResponse(body, opts);
  if (!parsed.ok) return parsed;
  if (parsed.feed.posts.length === 0) {
    return { ok: false, reason: 'empty_or_malformed' };
  }
  return {
    ok: true,
    post: parsed.feed.posts[0],
    skipped: parsed.skipped + Math.max(0, parsed.feed.posts.length - 1),
  };
}

export { MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE, UUID_RE, FEED_REACTIONS, MAX_REACTION_BODY_BYTES };
