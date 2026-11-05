/**
 * Sanitize Vault Community comments for Connect.
 */

import { sanitizeAvatarUrl } from './memberIdentity.js';
import { sanitizeReactions } from './communityFeedSanitize.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Verified Vault FEED_COMMENT_MAX_CHARS */
export const FEED_COMMENT_MAX_CHARS = 2000;
export const MAX_COMMENT_BODY_BYTES = 8192;
/** Vault list hard limit */
export const VAULT_COMMENT_LIST_LIMIT = 100;

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
export function validateConnectCommentContent(content) {
  if (typeof content !== 'string') return { ok: false, reason: 'invalid_content' };
  const trimmed = content.trim();
  if (!trimmed) return { ok: false, reason: 'empty' };
  if (trimmed.length > FEED_COMMENT_MAX_CHARS) return { ok: false, reason: 'too_long' };
  return { ok: true, content: trimmed };
}

/**
 * GET query: exactly postId UUID.
 * @param {Record<string, unknown> | null | undefined} query
 */
export function parseCommentsListQuery(query) {
  const q = query && typeof query === 'object' ? query : {};
  const keys = Object.keys(q);
  if (keys.length === 0) return { ok: false, reason: 'missing_post_id' };
  if (keys.some((k) => k !== 'postId')) return { ok: false, reason: 'unexpected_param' };
  if (keys.length !== 1) return { ok: false, reason: 'unexpected_param' };
  const raw = q.postId;
  if (Array.isArray(raw)) return { ok: false, reason: 'duplicate_post_id' };
  const postId = asNullableString(raw);
  if (!postId || !UUID_RE.test(postId)) return { ok: false, reason: 'invalid_post_id' };
  return { ok: true, postId };
}

/**
 * @param {unknown} author
 */
function sanitizeCommentAuthor(author) {
  if (!author || typeof author !== 'object' || Array.isArray(author)) return null;
  /** @type {Record<string, unknown>} */
  const a = author;
  const id = asNullableString(a.id);
  if (!id || !UUID_RE.test(id)) return null;
  return {
    id,
    name: asNullableString(a.name) || 'Member',
    avatarUrl: sanitizeAvatarUrl(a.avatar_url ?? a.avatarUrl),
  };
}

/**
 * Normalize canEdit/canDelete to self-only (strip moderator remove).
 * @param {unknown} row
 * @param {string} [expectedPostId]
 */
export function sanitizeComment(row, expectedPostId) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  /** @type {Record<string, unknown>} */
  const c = row;

  const id = asNullableString(c.id);
  if (!id || !UUID_RE.test(id)) return null;

  const postId =
    asNullableString(c.post_id ?? c.postId) ||
    (expectedPostId && UUID_RE.test(expectedPostId) ? expectedPostId : null);
  if (!postId || !UUID_RE.test(postId)) return null;

  const author = sanitizeCommentAuthor(c.author);
  if (!author) return null;

  // Prefer raw content (mention tokens) for edit fidelity; display formats in UI.
  const content =
    asNullableString(c.content) || asNullableString(c.contentDisplay) || '';
  if (!content) return null;

  const createdAt = asIsoTimestamp(c.created_at ?? c.createdAt);
  if (!createdAt) return null;

  // Vault canEdit = author only. Force canDelete = same (no moderator UI).
  const selfOwned = Boolean(c.canEdit);

  return {
    id,
    postId,
    content,
    createdAt,
    updatedAt: asIsoTimestamp(c.updated_at ?? c.updatedAt),
    edited: Boolean(c.edited),
    author,
    canEdit: selfOwned,
    canDelete: selfOwned,
    // Non-interactive display only
    reactions: sanitizeReactions(c.reactions),
  };
}

/**
 * @param {unknown} body
 * @param {string} postId
 */
export function parseVaultCommentsListResponse(body, postId) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, reason: 'invalid_shape' };
  }
  /** @type {Record<string, unknown>} */
  const b = body;
  if (b.ok !== true) return { ok: false, reason: 'not_ok' };
  if (!Array.isArray(b.comments)) return { ok: false, reason: 'missing_comments' };

  const comments = [];
  let skipped = 0;
  for (const row of b.comments) {
    const item = sanitizeComment(row, postId);
    if (item) comments.push(item);
    else skipped += 1;
  }

  return {
    ok: true,
    list: {
      comments,
      postId,
      // Vault hard-caps at 100 with no offset
      hasMore: false,
      truncated: comments.length + skipped >= VAULT_COMMENT_LIST_LIMIT,
    },
    skipped,
  };
}

/**
 * @param {unknown} body
 * @param {string} [fallbackPostId]
 */
export function parseVaultCommentMutationResponse(body, fallbackPostId) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, reason: 'invalid_shape' };
  }
  /** @type {Record<string, unknown>} */
  const b = body;
  if (b.ok !== true) return { ok: false, reason: 'not_ok' };
  if (!b.comment) return { ok: false, reason: 'missing_comment' };
  const comment = sanitizeComment(b.comment, fallbackPostId);
  if (!comment) return { ok: false, reason: 'malformed_comment' };
  // Ensure self-actions true for freshly created/edited own comment
  return {
    ok: true,
    comment: {
      ...comment,
      canEdit: true,
      canDelete: true,
    },
  };
}

/**
 * Create body: { postId, content } only.
 * @param {unknown} body
 */
export function parseCreateCommentCommand(body) {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, reason: 'invalid_body' };
  }
  /** @type {Record<string, unknown>} */
  const b = body;
  for (const k of Object.keys(b)) {
    if (k !== 'postId' && k !== 'content') return { ok: false, reason: 'extra_fields' };
  }
  const postId = asNullableString(b.postId);
  if (!postId || !UUID_RE.test(postId)) return { ok: false, reason: 'invalid_post_id' };
  const contentCheck = validateConnectCommentContent(b.content);
  if (!contentCheck.ok) return { ok: false, reason: contentCheck.reason };
  return {
    ok: true,
    postId,
    vaultBody: { postId, content: contentCheck.content },
  };
}

/**
 * Edit body: { commentId, content } → Vault { id, content }
 * @param {unknown} body
 */
export function parseEditCommentCommand(body) {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, reason: 'invalid_body' };
  }
  /** @type {Record<string, unknown>} */
  const b = body;
  for (const k of Object.keys(b)) {
    if (k !== 'commentId' && k !== 'content') return { ok: false, reason: 'extra_fields' };
  }
  const commentId = asNullableString(b.commentId);
  if (!commentId || !UUID_RE.test(commentId)) return { ok: false, reason: 'invalid_comment_id' };
  const contentCheck = validateConnectCommentContent(b.content);
  if (!contentCheck.ok) return { ok: false, reason: contentCheck.reason };
  return {
    ok: true,
    commentId,
    vaultBody: { id: commentId, content: contentCheck.content },
  };
}

/**
 * Delete body: { commentId } → Vault { id }
 * @param {unknown} body
 */
export function parseDeleteCommentCommand(body) {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, reason: 'invalid_body' };
  }
  /** @type {Record<string, unknown>} */
  const b = body;
  for (const k of Object.keys(b)) {
    if (k !== 'commentId') return { ok: false, reason: 'extra_fields' };
  }
  const commentId = asNullableString(b.commentId);
  if (!commentId || !UUID_RE.test(commentId)) return { ok: false, reason: 'invalid_comment_id' };
  return {
    ok: true,
    commentId,
    vaultBody: { id: commentId },
  };
}

export { UUID_RE };
