/**
 * Phase 3 member notifications sanitize / destination / patch tests.
 * Run: node --test scripts/test-member-notifications.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractChannelIdFromHuddleLink,
  isAdministrativeVaultLink,
  isSafeIgnoredVaultLink,
  parseNotificationsListQuery,
  parseNotificationsPatchCommand,
  parseVaultNotificationsResponse,
  isVaultNewsNotification,
  resolveCommunityPostId,
  resolveNotificationDestination,
  sanitizeNotification,
} from '../api/_utils/notificationSanitize.js';
import {
  buildVaultNotificationsUrl,
  VAULT_NOTIFICATIONS_PATH,
} from '../api/_utils/vaultOrigin.js';

function badge(count) {
  if (!Number.isFinite(count) || count <= 0) return null;
  if (count > 99) return '99+';
  return String(Math.floor(count));
}

const POST_ID = '44444444-4444-4444-8444-444444444444';
const COMMENT_ID = '66666666-6666-4666-8666-666666666666';

const RAW = {
  id: '33333333-3333-4333-8333-333333333333',
  type: 'community_feed_mention_post',
  title: 'You were mentioned',
  body: 'Hello <b>friend</b>',
  link: `/community/feed?post=${POST_ID}`,
  source_id: POST_ID,
  read_at: null,
  created_at: '2026-09-01T12:00:00.000Z',
  user_id: 'should-strip',
  email: 'secret@example.com',
};

describe('buildVaultNotificationsUrl', () => {
  it('uses fixed notifications path only', () => {
    const url = buildVaultNotificationsUrl('https://vault.example.com/');
    assert.equal(url, `https://vault.example.com${VAULT_NOTIFICATIONS_PATH}`);
    assert.ok(url.includes('resource=notifications'));
    assert.equal(url.includes('userId'), false);
  });
});

describe('parseNotificationsListQuery', () => {
  it('accepts empty query only', () => {
    assert.deepEqual(parseNotificationsListQuery({}), { ok: true });
  });

  it('rejects unexpected params including pagination', () => {
    assert.equal(parseNotificationsListQuery({ limit: '10' }).ok, false);
    assert.equal(parseNotificationsListQuery({ offset: '0' }).ok, false);
    assert.equal(parseNotificationsListQuery({ userId: 'x' }).ok, false);
  });
});

describe('sanitizeNotification + destinations', () => {
  it('keeps presentation fields and strips sensitive data', () => {
    const n = sanitizeNotification(RAW);
    assert.ok(n);
    assert.equal(n.id, RAW.id);
    assert.equal(n.title, 'You were mentioned');
    assert.equal(n.message, 'Hello <b>friend</b>');
    assert.equal(n.sourceId, RAW.source_id);
    assert.equal(n.destination?.path, `/community/post/${POST_ID}`);
    assert.equal(n.destination?.kind, 'community_post');
    assert.equal('user_id' in n, false);
    assert.equal('email' in n, false);
    assert.equal('link' in n, false);
  });

  it('maps verified Community notification source semantics to posts', () => {
    assert.equal(
      resolveCommunityPostId('community_feed_mention_post', POST_ID, null),
      POST_ID
    );
    assert.equal(
      resolveCommunityPostId(
        'community_feed_comment',
        COMMENT_ID,
        `/community/feed?post=${POST_ID}&comment=${COMMENT_ID}`
      ),
      POST_ID
    );
    assert.equal(
      resolveCommunityPostId(
        'community_feed_mention_comment',
        COMMENT_ID,
        `/community/feed?post=${POST_ID}&comment=${COMMENT_ID}`
      ),
      POST_ID
    );
    // Comment source_id must not be treated as a post id
    assert.equal(
      resolveCommunityPostId('community_feed_comment', COMMENT_ID, null),
      null
    );
    assert.equal(
      resolveNotificationDestination('community_feed_comment', COMMENT_ID, null)?.path,
      '/community'
    );
    // Reaction notifications are not produced; unknown community-ish types fall back
    assert.equal(resolveCommunityPostId('community_feed_reaction', POST_ID, null), null);
    assert.equal(
      resolveNotificationDestination('future_community_type', POST_ID, null),
      null
    );
  });

  it('does not map chat/huddle/admin types to a post', () => {
    assert.equal(
      resolveCommunityPostId('community_huddle_started', POST_ID, `/community/chat?channel=${POST_ID}`),
      null
    );
    assert.equal(resolveCommunityPostId('community_dm', POST_ID, '/community/chat/dm'), null);
    assert.equal(resolveCommunityPostId('assignment', POST_ID, '/follow-ups'), null);
    assert.equal(resolveNotificationDestination('assignment', POST_ID, '/follow-ups'), null);
  });

  it('deep-links huddle_started to Connect chat room (not Vault admin URL)', () => {
    const sessionSourceId = '55555555-5555-4555-8555-555555555555';
    const dest = resolveNotificationDestination(
      'community_huddle_started',
      sessionSourceId,
      `/community/chat?channel=${POST_ID}`
    );
    assert.deepEqual(dest, {
      path: `/community/chat/${POST_ID}`,
      label: 'Join huddle',
      kind: 'huddle',
      channelId: POST_ID,
    });
    // source_id is room session id — must not be used as channel id
    assert.equal(dest.path.includes(sessionSourceId), false);
    assert.equal(
      extractChannelIdFromHuddleLink(`/community/chat?channel=${POST_ID}`),
      POST_ID
    );
    assert.equal(extractChannelIdFromHuddleLink('/community/chat/dm'), null);
    assert.equal(
      resolveNotificationDestination('community_huddle_started', sessionSourceId, null)?.path,
      '/community/chat'
    );
    // Raw Vault chat links remain non-navigable as administrative
    assert.equal(isAdministrativeVaultLink(`/community/chat?channel=${POST_ID}`), true);
  });

  it('rejects malformed source IDs and unsafe raw links', () => {
    assert.equal(resolveCommunityPostId('community_feed_mention_post', 'not-a-uuid', null), null);
    assert.equal(
      resolveCommunityPostId('community_feed_comment', COMMENT_ID, 'javascript:alert(1)'),
      null
    );
    assert.equal(
      resolveCommunityPostId('community_feed_comment', COMMENT_ID, 'https://evil.example/x'),
      null
    );
    assert.equal(
      resolveCommunityPostId('community_feed_comment', COMMENT_ID, '//evil.example'),
      null
    );
    assert.equal(
      resolveCommunityPostId('community_feed_comment', COMMENT_ID, '/community/chat?post=' + POST_ID),
      null
    );
  });

  it('preserves unknown types safely', () => {
    const unknown = sanitizeNotification({
      ...RAW,
      id: '55555555-5555-4555-8555-555555555555',
      type: 'future_type_xyz',
      title: 'Something new',
      link: '/follow-ups',
    });
    assert.ok(unknown);
    assert.equal(unknown.typeLabel, 'Notification');
    assert.equal(unknown.destination, null);
  });

  it('maps Canaan News fan-out (announcement + /dashboard) into the Connect inbox', () => {
    assert.equal(isVaultNewsNotification('announcement', '/dashboard'), true);
    assert.equal(isVaultNewsNotification('announcement', '/communication/announcements'), false);
    assert.equal(isVaultNewsNotification('prayer', '/dashboard'), false);
    const news = sanitizeNotification({
      ...RAW,
      id: '77777777-7777-4777-8777-777777777777',
      type: 'announcement',
      title: 'Spring banquet',
      body: 'Join us',
      link: '/dashboard',
      source_id: '88888888-8888-4888-8888-888888888888',
    });
    assert.ok(news);
    assert.equal(news.type, 'vault_news');
    assert.equal(news.typeLabel, 'Canaan News');
    assert.deepEqual(news.destination, {
      path: '/?section=vault-news',
      label: 'View Canaan News',
      kind: 'vault_news',
    });
    const church = sanitizeNotification({
      ...RAW,
      id: '99999999-9999-4999-8999-999999999999',
      type: 'announcement',
      title: 'Bulletin',
      link: '/communication/announcements',
    });
    assert.ok(church);
    assert.equal(church.type, 'announcement');
    assert.equal(church.destination?.kind, 'home');
  });

  it('rejects administrative and unsafe destinations', () => {
    assert.equal(isAdministrativeVaultLink('/follow-ups'), true);
    assert.equal(isAdministrativeVaultLink('/community/chat?channel=1'), true);
    assert.equal(isAdministrativeVaultLink('/communication/announcements'), true);
    assert.equal(isSafeIgnoredVaultLink('javascript:alert(1)'), false);
    assert.equal(isSafeIgnoredVaultLink('https://evil.example'), false);
    assert.equal(isSafeIgnoredVaultLink('//evil.example'), false);
    assert.equal(isSafeIgnoredVaultLink('/community/feed'), true);
    assert.equal(resolveNotificationDestination('assignment', null, '/follow-ups'), null);
  });

  it('skips malformed records', () => {
    assert.equal(sanitizeNotification({ id: 'bad', title: 'x', created_at: '2026-01-01' }), null);
    assert.equal(sanitizeNotification({ ...RAW, title: '' }), null);
  });
});

describe('parseVaultNotificationsResponse', () => {
  it('maps success, empty inbox, and skips bad rows', () => {
    const empty = parseVaultNotificationsResponse({
      ok: true,
      notifications: [],
      unreadCount: 0,
    });
    assert.equal(empty.ok, true);
    assert.equal(empty.inbox.notifications.length, 0);
    assert.equal(empty.inbox.hasMore, false);

    const mixed = parseVaultNotificationsResponse({
      ok: true,
      notifications: [RAW, { id: 'nope' }],
      unreadCount: 3,
      communityFeedUnreadCount: 2,
      warning: 'ignore',
    });
    assert.equal(mixed.ok, true);
    assert.equal(mixed.inbox.notifications.length, 1);
    assert.equal(mixed.skipped, 1);
    assert.equal(mixed.inbox.unreadCount, 3);
    assert.equal('communityFeedUnreadCount' in mixed.inbox, false);
    assert.equal('warning' in mixed.inbox, false);
  });

  it('rejects invalid bodies', () => {
    assert.equal(parseVaultNotificationsResponse(null).ok, false);
    assert.equal(parseVaultNotificationsResponse({ ok: true }).ok, false);
  });
});

describe('parseNotificationsPatchCommand', () => {
  it('maps mark_read and mark_all_read to Vault shapes', () => {
    const one = parseNotificationsPatchCommand({
      action: 'mark_read',
      notificationId: RAW.id,
    });
    assert.equal(one.ok, true);
    assert.deepEqual(one.vaultBody, { id: RAW.id });

    const all = parseNotificationsPatchCommand({ action: 'mark_all_read' });
    assert.equal(all.ok, true);
    assert.deepEqual(all.vaultBody, { mark_all_read: true });
  });

  it('rejects invalid id, unknown action, extra fields, and userId', () => {
    assert.equal(
      parseNotificationsPatchCommand({ action: 'mark_read', notificationId: 'nope' }).ok,
      false
    );
    assert.equal(parseNotificationsPatchCommand({ action: 'delete' }).ok, false);
    assert.equal(
      parseNotificationsPatchCommand({
        action: 'mark_all_read',
        userId: '11111111-1111-4111-8111-111111111111',
      }).ok,
      false
    );
    assert.equal(
      parseNotificationsPatchCommand({
        action: 'mark_read',
        notificationId: RAW.id,
        extra: true,
      }).ok,
      false
    );
  });
});

describe('unread badge cap', () => {
  it('caps at 99+', () => {
    assert.equal(badge(0), null);
    assert.equal(badge(3), '3');
    assert.equal(badge(99), '99');
    assert.equal(badge(100), '99+');
  });
});

describe('Connect inbox eligibility', () => {
  it('loads the bell for pending and approved signed-in members', () => {
    const types = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'lib/memberNotificationsTypes.ts'),
      'utf8'
    );
    const ctx = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'context/NotificationsContext.tsx'),
      'utf8'
    );
    const app = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'App.tsx'),
      'utf8'
    );
    const hero = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'components/home/HomeHero.tsx'),
      'utf8'
    );
    assert.match(types, /canLoadNotificationInbox/);
    assert.match(types, /pending/);
    assert.match(ctx, /canLoadNotificationInbox/);
    assert.match(ctx, /visibilitychange/);
    assert.match(ctx, /POLL_MS/);
    const start = app.indexOf('path="/notifications"');
    const end = app.indexOf('path="/prayer"', start);
    const notifBlock = app.slice(start, end);
    assert.match(notifBlock, /<MemberGate>/);
    assert.equal(notifBlock.includes('requireAccess="approved_member"'), false);
    assert.match(hero, /canLoadNotificationInbox/);
  });
});

describe('PLCC Bucks earn notice', () => {
  const cardRef = `AWCD.${'ab'.repeat(32)}`;
  const ledgerId = '11111111-2222-4333-8444-555555555555';

  it('opens Kids View only for an AWCD card ref and hides the ledger id', () => {
    const dest = resolveNotificationDestination('kids_bucks_award', ledgerId, `/family/kids/${cardRef}`);
    assert.deepEqual(dest, {
      path: `/family/kids/${cardRef}`,
      label: 'Open Kids View',
      kind: 'kids_bucks',
    });
    assert.equal(resolveNotificationDestination('kids_bucks_award', ledgerId, `/family/kids/${ledgerId}`), null);
    assert.equal(resolveNotificationDestination('kids_bucks_award', ledgerId, 'https://evil.example/family/kids/' + cardRef), null);
    const row = sanitizeNotification({
      id: '33333333-3333-4333-8333-333333333333',
      type: 'kids_bucks_award',
      title: 'Mia earned PLCC Bucks',
      body: 'Mia earned 15 PLCC Bucks for Showed kindness.',
      created_at: '2026-10-17T20:00:00Z',
      source_id: ledgerId,
      link: `/family/kids/${cardRef}`,
    });
    assert.equal(row.typeLabel, 'PLCC Bucks');
    assert.equal(row.sourceId, null);
    assert.equal(JSON.stringify(row).includes(ledgerId), false);
    assert.equal(row.destination.path, `/family/kids/${cardRef}`);
  });
});

