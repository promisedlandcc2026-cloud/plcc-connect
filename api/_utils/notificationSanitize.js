/**
 * Sanitize Vault user_notifications responses for Connect (member inbox).
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_PATCH_BODY_BYTES = 4096;

/** Known Vault notification types (unknown types still render safely). */
const TYPE_LABELS = {
  announcement: 'Announcement',
  vault_news: 'Canaan News',
  prayer: 'Prayer',
  assignment: 'Assignment',
  community_mention: 'Community',
  community_reply: 'Community',
  community_dm: 'Message',
  community_huddle_started: 'Huddle',
  community_feed_comment: 'Community',
  community_feed_mention_post: 'Community',
  community_feed_mention_comment: 'Community',
  kids_bucks_award: 'PLCC Bucks',
  celebration: 'Celebration',
};

/** Types that may safely open Connect Community (feed or post). */
const COMMUNITY_DEST_TYPES = new Set([
  'community_feed_comment',
  'community_feed_mention_post',
  'community_feed_mention_comment',
]);

/** Vault admin / chat / huddle paths — never navigable in Connect. */
const REJECTED_LINK_PREFIXES = [
  '/follow-ups',
  '/communication',
  '/admin',
  '/settings',
  '/members',
  '/community/chat',
  '/community/prayer-wall',
  '/community/video',
  '/dashboard',
];

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
 * List endpoint accepts no query parameters (Vault returns a fixed newest-50 page).
 * @param {Record<string, unknown> | null | undefined} query
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function parseNotificationsListQuery(query) {
  const q = query && typeof query === 'object' ? query : {};
  if (Object.keys(q).length > 0) {
    return { ok: false, reason: 'unexpected_param' };
  }
  return { ok: true };
}

/**
 * Extract a post UUID from Vault's relative feed deep-link pattern only.
 * Never treats the link as a navigation target — Connect builds its own path.
 * Pattern: /community/feed?post=<uuid>[&comment=<uuid>]
 * @param {string | null} rawLink
 * @returns {string | null}
 */
export function extractPostIdFromVaultFeedLink(rawLink) {
  const link = asNullableString(rawLink);
  if (!link) return null;
  if (!isSafeIgnoredVaultLink(link)) return null;
  if (isAdministrativeVaultLink(link)) return null;

  const withoutHash = link.split('#')[0];
  try {
    const u = new URL(withoutHash, 'https://awc-connect.invalid');
    if (u.pathname !== '/community/feed') return null;
    for (const key of u.searchParams.keys()) {
      if (key !== 'post' && key !== 'comment') return null;
    }
    const post = u.searchParams.get('post');
    if (post && UUID_RE.test(post)) return post;
  } catch {
    return null;
  }
  return null;
}

/**
 * Extract a chat channel UUID from Vault's huddle deep-link pattern only.
 * Never treats the link as a navigation target — Connect builds its own path.
 * Pattern: /community/chat?channel=<uuid>
 * @param {string | null} rawLink
 * @returns {string | null}
 */
export function extractChannelIdFromHuddleLink(rawLink) {
  const link = asNullableString(rawLink);
  if (!link) return null;
  if (!isSafeIgnoredVaultLink(link)) return null;

  const withoutHash = link.split('#')[0];
  try {
    const u = new URL(withoutHash, 'https://awc-connect.invalid');
    if (u.pathname !== '/community/chat') return null;
    for (const key of u.searchParams.keys()) {
      if (key !== 'channel') return null;
    }
    const channel = u.searchParams.get('channel');
    if (channel && UUID_RE.test(channel)) return channel;
  } catch {
    return null;
  }
  return null;
}

/**
 * Resolve a Community notification to a Connect post ID using verified Vault semantics.
 *
 * | type | source_id meaning | post resolution |
 * | community_feed_mention_post | post id | source_id |
 * | community_feed_comment | comment id | post= from Vault feed link |
 * | community_feed_mention_comment | comment id | post= from Vault feed link |
 *
 * Reaction notifications are not produced by Vault today.
 * Chat / huddle / admin types never resolve to a post.
 *
 * @param {string} type
 * @param {string | null} sourceId
 * @param {string | null} rawLink
 * @returns {string | null}
 */
export function resolveCommunityPostId(type, sourceId, rawLink) {
  const t = String(type || '').trim();

  if (t === 'community_feed_mention_post') {
    return sourceId && UUID_RE.test(sourceId) ? sourceId : null;
  }

  if (t === 'community_feed_comment' || t === 'community_feed_mention_comment') {
    // source_id is the comment id — do not treat it as a post id
    return extractPostIdFromVaultFeedLink(rawLink);
  }

  return null;
}

/**
 * Canaan News fan-out uses type `announcement` + relative `/dashboard`.
 * Church Communication announcements use `/communication/announcements`.
 * @param {string} type
 * @param {string | null} rawLink
 * @returns {boolean}
 */
export function isVaultNewsNotification(type, rawLink) {
  if (String(type || '').trim() !== 'announcement') return false;
  const link = asNullableString(rawLink);
  if (!link) return false;
  if (!isSafeIgnoredVaultLink(link)) return false;
  const path = link.split('?')[0].split('#')[0];
  return path === '/dashboard';
}

/**
 * Map verified type (and optionally sourceId/link) to a Connect destination.
 * Never navigates using the raw Vault link string.
 * @param {string} type
 * @param {string | null} sourceId
 * @param {string | null} [rawLink]
 * @returns {{ path: string, label: string, kind: string, postId?: string } | null}
 */
export function resolveNotificationDestination(type, sourceId, rawLink) {
  const t = String(type || '').trim();
  if (isVaultNewsNotification(t, rawLink || null)) {
    return {
      path: '/?section=vault-news',
      label: 'View Canaan News',
      kind: 'vault_news',
    };
  }
  const postId = resolveCommunityPostId(t, sourceId, rawLink || null);

  if (postId) {
    let commentId = null;
    if (
      (t === 'community_feed_comment' || t === 'community_feed_mention_comment') &&
      sourceId &&
      UUID_RE.test(sourceId)
    ) {
      commentId = sourceId;
    }
    const path = commentId
      ? `/community/post/${postId}?comment=${encodeURIComponent(commentId)}`
      : `/community/post/${postId}`;
    return {
      path,
      label: 'View post',
      kind: 'community_post',
      postId,
      commentId: commentId || undefined,
    };
  }

  if (COMMUNITY_DEST_TYPES.has(t)) {
    return {
      path: '/community',
      label: 'Open Community',
      kind: 'community',
    };
  }

  // New request for the Intercessors — open their prayer list (only exact link; page checks access).
  const prayerPath = rawLink ? String(rawLink).split('?')[0].split('#')[0] : '';
  if (t === 'prayer' && (prayerPath === '/intercessors' || prayerPath === '/community/prayer-watch')) {
    return { path: '/intercessors', label: 'Open the Prayer Watch', kind: 'intercessors' };
  }

  if (t === 'announcement' || t === 'prayer') {
    return { path: '/', label: 'View on Connect', kind: 'home' };
  }

  // Birthday / anniversary greeting from the Pastor — opens Home.
  if (t === 'celebration') {
    return { path: '/', label: 'Open Connect', kind: 'home' };
  }

  // Live Huddle started — join the channel room on Connect.
  // Vault source_id is a room-session UUID v5, not the channel id; channel comes from link.
  if (t === 'community_huddle_started') {
    const channelId = extractChannelIdFromHuddleLink(rawLink || null);
    if (channelId) {
      return {
        path: `/community/chat/${channelId}`,
        label: 'Join huddle',
        kind: 'huddle',
        channelId,
      };
    }
    return {
      path: '/community/chat',
      label: 'Open Chat',
      kind: 'chat',
    };
  }

  if (t === 'kids_bucks_award') {
    const cardRef = extractKidsCardRef(rawLink || null);
    if (!cardRef) return null;
    return {
      path: `/family/kids/${cardRef}`,
      label: 'Open Kids View',
      kind: 'kids_bucks',
    };
  }

  // assignment, chat DM, unknown — no Connect navigation
  return null;
}

const KIDS_CARD_REF_RE = /^AWCD\.[0-9a-f]{64}$/;

/**
 * Kids View link is only /family/kids/AWCD.<64 hex>. Anything else is dropped.
 * @param {string | null} rawLink
 * @returns {string | null}
 */
export function extractKidsCardRef(rawLink) {
  const link = asNullableString(rawLink);
  if (!link || !isSafeIgnoredVaultLink(link)) return null;
  const path = link.split('?')[0].split('#')[0];
  const match = /^\/family\/kids\/(AWCD\.[0-9a-f]{64})$/.exec(path);
  if (!match || !KIDS_CARD_REF_RE.test(match[1])) return null;
  return match[1];
}

/**
 * Returns true if the link is a relative Vault path we simply ignore (not used for nav).
 * Returns false for javascript:, external, protocol-relative, or malformed values.
 * @param {string} raw
 * @returns {boolean}
 */
export function isSafeIgnoredVaultLink(raw) {
  const link = String(raw || '').trim();
  if (!link) return true;
  const lower = link.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('//') ||
    /^[a-z][a-z0-9+.-]*:/i.test(link)
  ) {
    return false;
  }
  if (!link.startsWith('/')) return false;
  if (link.startsWith('//')) return false;
  return true;
}

/**
 * True when a raw Vault link targets an administrative experience.
 * @param {unknown} raw
 * @returns {boolean}
 */
export function isAdministrativeVaultLink(raw) {
  const link = asNullableString(raw);
  if (!link) return false;
  if (!isSafeIgnoredVaultLink(link)) return true;
  const path = link.split('?')[0].split('#')[0];
  return REJECTED_LINK_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

/**
 * @param {unknown} row
 * @returns {object | null}
 */
export function sanitizeNotification(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  /** @type {Record<string, unknown>} */
  const r = row;

  const id = asNullableString(r.id);
  if (!id || !UUID_RE.test(id)) return null;

  const type = asNullableString(r.type) || 'general';
  const title = asNullableString(r.title);
  if (!title) return null;

  const message = asNullableString(r.body ?? r.message);
  const createdAt = asIsoTimestamp(r.created_at ?? r.createdAt);
  if (!createdAt) return null;

  const readAt = asIsoTimestamp(r.read_at ?? r.readAt);
  const sourceRaw = asNullableString(r.source_id ?? r.sourceId);
  const sourceId =
    type === 'kids_bucks_award' ? null : sourceRaw && UUID_RE.test(sourceRaw) ? sourceRaw : null;
  const rawLink = asNullableString(r.link);

  // Drop raw link from DTO — destination is Connect-owned
  const destination = resolveNotificationDestination(type, sourceId, rawLink);
  const vaultNews = isVaultNewsNotification(type, rawLink);

  return {
    id,
    type: vaultNews ? 'vault_news' : type,
    typeLabel: vaultNews ? 'Canaan News' : TYPE_LABELS[type] || 'Notification',
    title,
    message,
    createdAt,
    readAt,
    sourceId,
    destination,
  };
}

/**
 * @param {unknown} body
 * @returns {{ ok: true, inbox: { notifications: object[], unreadCount: number, hasMore: false }, skipped: number } | { ok: false, reason: string }}
 */
export function parseVaultNotificationsResponse(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, reason: 'invalid_shape' };
  }
  /** @type {Record<string, unknown>} */
  const b = body;
  if (b.ok !== true) return { ok: false, reason: 'not_ok' };
  if (!Array.isArray(b.notifications)) return { ok: false, reason: 'missing_notifications' };

  const notifications = [];
  let skipped = 0;
  for (const row of b.notifications) {
    const item = sanitizeNotification(row);
    if (item) notifications.push(item);
    else skipped += 1;
  }

  let unreadCount = 0;
  if (typeof b.unreadCount === 'number' && Number.isFinite(b.unreadCount) && b.unreadCount >= 0) {
    unreadCount = Math.floor(b.unreadCount);
  } else {
    unreadCount = notifications.filter((n) => !n.readAt).length;
  }

  return {
    ok: true,
    inbox: {
      notifications,
      unreadCount,
      // Vault list is fixed newest-50 with no offset — Connect cannot page further.
      hasMore: false,
    },
    skipped,
  };
}

/**
 * Parse Connect PATCH command → Vault request body.
 * @param {unknown} body
 * @returns {{ ok: true, vaultBody: Record<string, unknown> } | { ok: false, reason: string, status?: number }}
 */
export function parseNotificationsPatchCommand(body) {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, reason: 'invalid_body' };
  }
  /** @type {Record<string, unknown>} */
  const b = body;
  const keys = Object.keys(b);
  const action = asNullableString(b.action);

  if (action === 'mark_all_read') {
    if (keys.length !== 1 || keys[0] !== 'action') {
      return { ok: false, reason: 'extra_fields' };
    }
    return { ok: true, vaultBody: { mark_all_read: true } };
  }

  if (action === 'mark_read') {
    const allowed = new Set(['action', 'notificationId']);
    for (const k of keys) {
      if (!allowed.has(k)) return { ok: false, reason: 'extra_fields' };
    }
    const notificationId = asNullableString(b.notificationId);
    if (!notificationId || !UUID_RE.test(notificationId)) {
      return { ok: false, reason: 'invalid_notification_id' };
    }
    return { ok: true, vaultBody: { id: notificationId } };
  }

  return { ok: false, reason: 'unknown_action' };
}

/**
 * @param {unknown} notification
 * @returns {{ id: string, readAt: string | null } | null}
 */
export function sanitizeMarkReadResult(notification) {
  if (!notification || typeof notification !== 'object' || Array.isArray(notification)) {
    return null;
  }
  /** @type {Record<string, unknown>} */
  const n = notification;
  const id = asNullableString(n.id);
  if (!id || !UUID_RE.test(id)) return null;
  return {
    id,
    readAt: asIsoTimestamp(n.read_at ?? n.readAt),
  };
}

export { MAX_PATCH_BODY_BYTES, UUID_RE, TYPE_LABELS, COMMUNITY_DEST_TYPES };
