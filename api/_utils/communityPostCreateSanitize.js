/**
 * Validate Connect post-create bodies and sanitize Vault create responses.
 * Text + optional single image (base64) matching Vault’s verified contract.
 */

import { sanitizeFeedPost, UUID_RE } from './communityFeedSanitize.js';

/** Matches Vault FEED_POST_MAX_CHARS */
export const FEED_POST_MAX_CHARS = 3000;

/** Matches Vault FEED_IMAGE_MAX_BYTES (decoded) */
export const FEED_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/** Matches Vault FEED_IMAGE_MIMES — no GIF/SVG */
export const FEED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Transport cap for Connect→Vault JSON (base64 + fields).
 * Aligned with Vault client prep (~2.5MB binary) and typical serverless body limits.
 */
export const MAX_POST_CREATE_BODY_BYTES = Math.floor(4 * 1024 * 1024);

const FORBIDDEN_KEYS = new Set([
  'userId',
  'user_id',
  'authorId',
  'author_id',
  'author',
  'role',
  'category',
  'mentionedUserIds',
  'mentioned_user_ids',
  'imagePath',
  'storagePath',
  'imageUrl',
  'image_url',
  'resource',
  'subResource',
  'feedType',
  'host',
  'origin',
  'url',
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
 * @param {Buffer} buffer
 * @param {string} mime
 * @returns {boolean}
 */
export function matchesImageMagic(buffer, mime) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;
  if (mime === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mime === 'image/png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }
  if (mime === 'image/webp') {
    return (
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    );
  }
  return false;
}

/**
 * Validate optional image payload. Never accepts storage paths.
 * @param {unknown} image
 * @returns {{ ok: true, mimeType: string, fileBase64: string, bytes: number } | { ok: false, reason: string }}
 */
export function parsePostImagePayload(image) {
  if (image == null) return { ok: false, reason: 'missing_image' };
  if (typeof image !== 'object' || Array.isArray(image)) {
    return { ok: false, reason: 'invalid_image' };
  }
  /** @type {Record<string, unknown>} */
  const img = image;
  const allowed = new Set(['mimeType', 'fileBase64']);
  for (const k of Object.keys(img)) {
    if (!allowed.has(k)) return { ok: false, reason: 'extra_image_fields' };
  }
  if (img.imagePath != null || img.storagePath != null) {
    return { ok: false, reason: 'storage_path_rejected' };
  }

  const mimeType = String(img.mimeType || '')
    .trim()
    .toLowerCase();
  if (mimeType === 'image/svg+xml' || mimeType.includes('svg') || mimeType.includes('gif')) {
    return { ok: false, reason: 'unsupported_mime' };
  }
  if (!FEED_IMAGE_MIMES.has(mimeType)) {
    return { ok: false, reason: 'unsupported_mime' };
  }

  let raw = String(img.fileBase64 || '').trim();
  if (!raw) return { ok: false, reason: 'missing_image_data' };
  const dataUrl = raw.match(/^data:([^;]+);base64,(.+)$/i);
  if (dataUrl) {
    const dataMime = String(dataUrl[1] || '')
      .trim()
      .toLowerCase();
    if (dataMime && dataMime !== mimeType) {
      return { ok: false, reason: 'mime_mismatch' };
    }
    raw = dataUrl[2];
  }
  if (!/^[A-Za-z0-9+/=\s]+$/.test(raw)) {
    return { ok: false, reason: 'invalid_image_data' };
  }

  let buffer;
  try {
    buffer = Buffer.from(raw.replace(/\s+/g, ''), 'base64');
  } catch {
    return { ok: false, reason: 'invalid_image_data' };
  }
  if (!buffer.length) return { ok: false, reason: 'invalid_image_data' };
  if (buffer.length > FEED_IMAGE_MAX_BYTES) {
    return { ok: false, reason: 'image_too_large' };
  }
  if (!matchesImageMagic(buffer, mimeType)) {
    return { ok: false, reason: 'signature_mismatch' };
  }

  return {
    ok: true,
    mimeType,
    fileBase64: raw.replace(/\s+/g, ''),
    bytes: buffer.length,
  };
}

/**
 * Validate post content. Empty allowed only when an image is present (Vault allowEmptyWithImage).
 * @param {unknown} raw
 * @param {{ allowEmptyWithImage?: boolean }} [opts]
 * @returns {{ ok: true, content: string } | { ok: false, reason: string }}
 */
export function validatePostContent(raw, opts = {}) {
  const content = String(raw ?? '').trim();
  if (!content) {
    if (opts.allowEmptyWithImage) return { ok: true, content: '' };
    return { ok: false, reason: 'empty_content' };
  }
  if (content.length > FEED_POST_MAX_CHARS) {
    return { ok: false, reason: 'content_too_long' };
  }
  return { ok: true, content };
}

/**
 * Parse Connect create body → fixed Vault POST body (category forced to general).
 * @param {unknown} body
 * @returns {{ ok: true, vaultBody: object, hasImage: boolean } | { ok: false, reason: string }}
 */
export function parseCreatePostCommand(body) {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, reason: 'invalid_body' };
  }
  /** @type {Record<string, unknown>} */
  const b = body;

  for (const k of Object.keys(b)) {
    if (FORBIDDEN_KEYS.has(k)) return { ok: false, reason: 'forbidden_field' };
    if (k !== 'content' && k !== 'image') return { ok: false, reason: 'extra_fields' };
  }

  const hasImageKey = Object.prototype.hasOwnProperty.call(b, 'image') && b.image != null;
  let imageParsed = null;
  if (hasImageKey) {
    imageParsed = parsePostImagePayload(b.image);
    if (!imageParsed.ok) return { ok: false, reason: imageParsed.reason };
  }

  const contentCheck = validatePostContent(b.content, {
    allowEmptyWithImage: Boolean(imageParsed && imageParsed.ok),
  });
  if (!contentCheck.ok) return { ok: false, reason: contentCheck.reason };

  if (!contentCheck.content && !(imageParsed && imageParsed.ok)) {
    return { ok: false, reason: 'empty_content' };
  }

  /** @type {Record<string, unknown>} */
  const vaultBody = {
    category: 'general',
    content: contentCheck.content,
  };
  if (imageParsed && imageParsed.ok) {
    vaultBody.image = {
      mimeType: imageParsed.mimeType,
      fileBase64: imageParsed.fileBase64,
    };
  }

  return {
    ok: true,
    vaultBody,
    hasImage: Boolean(imageParsed && imageParsed.ok),
  };
}

/**
 * Parse Vault POST create response → sanitized Connect post DTO.
 * @param {unknown} body
 * @returns {{ ok: true, post: object } | { ok: false, reason: string }}
 */
export function parseVaultCreatePostResponse(body, viewerId) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, reason: 'invalid_shape' };
  }
  /** @type {Record<string, unknown>} */
  const b = body;
  if (b.ok !== true) return { ok: false, reason: 'not_ok' };
  const post = sanitizeFeedPost(b.post, { viewerId });
  if (!post) return { ok: false, reason: 'malformed_post' };
  if (!UUID_RE.test(post.id)) return { ok: false, reason: 'malformed_post' };
  return { ok: true, post };
}
