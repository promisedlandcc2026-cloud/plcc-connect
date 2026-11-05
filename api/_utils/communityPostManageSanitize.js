/**
 * Connect self-only Community post manage commands (edit text / delete).
 * Image replace/remove deferred — Vault PATCH updates content only.
 */

import { sanitizeFeedPost, UUID_RE } from './communityFeedSanitize.js';
import { FEED_POST_MAX_CHARS, validatePostContent } from './communityPostCreateSanitize.js';

export const MAX_POST_MANAGE_BODY_BYTES = 8192;

const FORBIDDEN_KEYS = new Set([
  'userId',
  'user_id',
  'authorId',
  'author_id',
  'author',
  'role',
  'category',
  'canEdit',
  'canDelete',
  'canEditOwnPost',
  'canDeleteOwnPost',
  'authoredByMe',
  'image',
  'imageAction',
  'imagePath',
  'storagePath',
  'imageUrl',
  'mentionedUserIds',
  'mentioned_user_ids',
  'resource',
  'subResource',
  'feedType',
  'reason',
  'moderated',
]);

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
 * @param {unknown} body
 * @returns {{ ok: true, action: 'edit', postId: string, content: string, vaultBody: object } | { ok: true, action: 'delete', postId: string, vaultBody: object } | { ok: false, reason: string }}
 */
export function parsePostManageCommand(body) {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, reason: 'invalid_body' };
  }
  /** @type {Record<string, unknown>} */
  const b = body;

  for (const k of Object.keys(b)) {
    if (FORBIDDEN_KEYS.has(k)) return { ok: false, reason: 'forbidden_field' };
  }

  const action = asNullableString(b.action);
  if (action !== 'edit' && action !== 'delete') {
    return { ok: false, reason: 'invalid_action' };
  }

  const postId = asNullableString(b.postId);
  if (!postId || !UUID_RE.test(postId)) {
    return { ok: false, reason: 'invalid_post_id' };
  }

  if (action === 'delete') {
    const allowed = new Set(['action', 'postId']);
    for (const k of Object.keys(b)) {
      if (!allowed.has(k)) return { ok: false, reason: 'extra_fields' };
    }
    return {
      ok: true,
      action: 'delete',
      postId,
      vaultBody: { id: postId },
    };
  }

  // edit — text only (Vault PATCH does not replace/remove images)
  const allowed = new Set(['action', 'postId', 'content']);
  for (const k of Object.keys(b)) {
    if (!allowed.has(k)) return { ok: false, reason: 'extra_fields' };
  }
  if (!Object.prototype.hasOwnProperty.call(b, 'content')) {
    return { ok: false, reason: 'missing_content' };
  }

  // Empty content rejected at Connect boundary for edit without imageAction.
  // Vault allows empty when image_path exists; Connect defers image ops → require text.
  const contentCheck = validatePostContent(b.content, { allowEmptyWithImage: false });
  if (!contentCheck.ok) {
    return { ok: false, reason: contentCheck.reason };
  }

  return {
    ok: true,
    action: 'edit',
    postId,
    content: contentCheck.content,
    vaultBody: {
      id: postId,
      content: contentCheck.content,
    },
  };
}

/**
 * Compare authoritative Vault self-user id with sanitized post author id.
 * @param {string | null | undefined} selfUserId
 * @param {object | null | undefined} post
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function assertSelfOwnsPost(selfUserId, post) {
  const selfId = asNullableString(selfUserId);
  if (!selfId || !UUID_RE.test(selfId)) {
    return { ok: false, reason: 'malformed_self' };
  }
  if (!post || typeof post !== 'object') {
    return { ok: false, reason: 'malformed_post' };
  }
  const author =
    /** @type {Record<string, unknown>} */ (post).author &&
    typeof /** @type {Record<string, unknown>} */ (post).author === 'object'
      ? /** @type {Record<string, unknown>} */ (
          /** @type {Record<string, unknown>} */ (post).author
        )
      : null;
  const authorId = author ? asNullableString(author.id) : null;
  if (!authorId || !UUID_RE.test(authorId)) {
    return { ok: false, reason: 'malformed_author' };
  }
  if (selfId !== authorId) {
    return { ok: false, reason: 'not_owner' };
  }
  return { ok: true };
}

/**
 * @param {unknown} body
 * @param {string | null | undefined} viewerId
 * @returns {{ ok: true, post: object } | { ok: false, reason: string }}
 */
export function parseVaultEditPostResponse(body, viewerId) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, reason: 'invalid_shape' };
  }
  /** @type {Record<string, unknown>} */
  const b = body;
  if (b.ok !== true) return { ok: false, reason: 'not_ok' };
  const post = sanitizeFeedPost(b.post, { viewerId });
  if (!post) return { ok: false, reason: 'malformed_post' };
  return { ok: true, post };
}

/**
 * @param {unknown} body
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function parseVaultDeletePostResponse(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, reason: 'invalid_shape' };
  }
  /** @type {Record<string, unknown>} */
  const b = body;
  if (b.ok !== true) return { ok: false, reason: 'not_ok' };
  // Never expose moderated:true to Connect clients
  return { ok: true };
}

export { FEED_POST_MAX_CHARS, UUID_RE };
