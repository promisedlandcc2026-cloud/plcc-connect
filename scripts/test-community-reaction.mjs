/**
 * Phase 4 + Phase 9 Community reaction sanitize / command / optimistic tests.
 * Run: node --test scripts/test-community-reaction.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  parseCommunityReactionCommand,
  parseVaultReactionResponse,
  sanitizeFeedPost,
  sanitizeReactions,
} from '../api/_utils/communityFeedSanitize.js';
import {
  applyOptimisticReactionToggle,
  reactionStateKey,
} from '../api/_utils/communityReactionOptimistic.js';
import {
  buildVaultCommunityReactionUrl,
  VAULT_COMMUNITY_REACTION_PATH,
} from '../api/_utils/vaultOrigin.js';

const POST_ID = '22222222-2222-4222-8222-222222222222';
const COMMENT_ID = '33333333-3333-4333-8333-333333333333';
const SAME_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const __dirname = dirname(fileURLToPath(import.meta.url));
const handlerSrc = readFileSync(join(__dirname, '../api/community-reaction.js'), 'utf8');

describe('buildVaultCommunityReactionUrl', () => {
  it('uses fixed reactions path only', () => {
    const url = buildVaultCommunityReactionUrl('https://vault.example.com/');
    assert.equal(url, `https://vault.example.com${VAULT_COMMUNITY_REACTION_PATH}`);
    assert.ok(url.includes('feedType=reactions'));
    assert.equal(url.includes('userId'), false);
    assert.equal(url.includes('cookie'), false);
  });
});

describe('parseCommunityReactionCommand', () => {
  it('maps legacy post reaction to Vault targetType=post body', () => {
    const parsed = parseCommunityReactionCommand({
      postId: POST_ID,
      reaction: 'pray',
    });
    assert.equal(parsed.ok, true);
    assert.equal(parsed.targetType, 'post');
    assert.equal(parsed.targetId, POST_ID);
    assert.deepEqual(parsed.vaultBody, {
      targetType: 'post',
      targetId: POST_ID,
      reaction: 'pray',
    });
  });

  it('accepts explicit post and comment targets', () => {
    const post = parseCommunityReactionCommand({
      targetType: 'post',
      targetId: POST_ID,
      reaction: 'love',
    });
    assert.equal(post.ok, true);
    assert.deepEqual(post.vaultBody, {
      targetType: 'post',
      targetId: POST_ID,
      reaction: 'love',
    });

    const comment = parseCommunityReactionCommand({
      targetType: 'comment',
      targetId: COMMENT_ID,
      reaction: 'like',
    });
    assert.equal(comment.ok, true);
    assert.equal(comment.targetType, 'comment');
    assert.deepEqual(comment.vaultBody, {
      targetType: 'comment',
      targetId: COMMENT_ID,
      reaction: 'like',
    });
  });

  it('rejects invalid uuid, unsupported reaction, extras, and missing fields', () => {
    assert.equal(parseCommunityReactionCommand({ postId: 'x', reaction: 'love' }).ok, false);
    assert.equal(
      parseCommunityReactionCommand({ postId: POST_ID, reaction: 'fire' }).ok,
      false
    );
    assert.equal(
      parseCommunityReactionCommand({
        postId: POST_ID,
        reaction: 'love',
        userId: '11111111-1111-4111-8111-111111111111',
      }).ok,
      false
    );
    assert.equal(
      parseCommunityReactionCommand({
        targetType: 'comment',
        targetId: COMMENT_ID,
        reaction: 'love',
        authorId: '11111111-1111-4111-8111-111111111111',
      }).ok,
      false
    );
    assert.equal(parseCommunityReactionCommand({ reaction: 'love' }).ok, false);
    assert.equal(parseCommunityReactionCommand({ postId: POST_ID }).ok, false);
    assert.equal(
      parseCommunityReactionCommand({
        postId: POST_ID,
        reaction: 'love',
        targetType: 'comment',
      }).ok,
      false
    );
    assert.equal(
      parseCommunityReactionCommand({
        targetType: 'thread',
        targetId: COMMENT_ID,
        reaction: 'love',
      }).ok,
      false
    );
    assert.equal(
      parseCommunityReactionCommand({
        targetType: 'comment',
        targetId: 'not-a-uuid',
        reaction: 'love',
      }).ok,
      false
    );
  });
});

describe('sanitizeReactions + parseVaultReactionResponse', () => {
  it('keeps reactedByMe and strips unknown reaction types', () => {
    const reactions = sanitizeReactions([
      { key: 'love', emoji: '❤️', count: 2, reactedByMe: true },
      { key: 'nope', emoji: 'x', count: 9, reactedByMe: true },
      { key: 'pray', count: 1, reactedByMe: false },
      { key: 'like', count: -1, reactedByMe: true },
      { key: 'praise', count: 1.7, reactedByMe: false },
    ]);
    assert.equal(reactions.length, 3);
    assert.equal(reactions[0].reactedByMe, true);
    assert.equal(reactions[1].key, 'pray');
    assert.equal(reactions[1].emoji, '🙏');
    assert.equal(reactions[2].count, 1);
  });

  it('parses insert/delete responses for posts and comments', () => {
    const postParsed = parseVaultReactionResponse(
      {
        ok: true,
        action: 'insert',
        reactions: [{ key: 'like', emoji: '👍', count: 1, reactedByMe: true }],
      },
      { targetType: 'post', targetId: POST_ID }
    );
    assert.equal(postParsed.ok, true);
    assert.equal(postParsed.result.action, 'insert');
    assert.equal(postParsed.result.targetType, 'post');
    assert.equal(postParsed.result.targetId, POST_ID);
    assert.equal(postParsed.result.postId, POST_ID);
    assert.equal(postParsed.result.reactions[0].reactedByMe, true);

    const commentParsed = parseVaultReactionResponse(
      {
        ok: true,
        action: 'delete',
        reactions: [{ key: 'pray', emoji: '🙏', count: 0, reactedByMe: false }],
      },
      { targetType: 'comment', targetId: COMMENT_ID }
    );
    assert.equal(commentParsed.ok, true);
    assert.equal(commentParsed.result.targetType, 'comment');
    assert.equal(commentParsed.result.targetId, COMMENT_ID);
    assert.equal(commentParsed.result.postId, undefined);
    assert.equal(commentParsed.result.action, 'delete');

    assert.equal(
      parseVaultReactionResponse({ ok: true, action: 'noop' }, {
        targetType: 'post',
        targetId: POST_ID,
      }).ok,
      false
    );
  });

  it('does not leak user ids from upstream reaction payload', () => {
    const parsed = parseVaultReactionResponse(
      {
        ok: true,
        action: 'insert',
        reactions: [
          {
            key: 'love',
            emoji: '❤️',
            count: 1,
            reactedByMe: true,
            userIds: ['11111111-1111-4111-8111-111111111111'],
            members: [{ email: 'x@y.z' }],
          },
        ],
        users: [{ id: '11111111-1111-4111-8111-111111111111' }],
      },
      { targetType: 'comment', targetId: COMMENT_ID }
    );
    assert.equal(parsed.ok, true);
    const row = parsed.result.reactions[0];
    assert.deepEqual(Object.keys(row).sort(), ['count', 'emoji', 'key', 'reactedByMe']);
    assert.equal('users' in parsed.result, false);
  });
});

describe('feed post sanitizer retains viewer reaction flag', () => {
  it('includes reactedByMe on cards', () => {
    const card = sanitizeFeedPost({
      id: POST_ID,
      category: 'general',
      categoryLabel: 'General',
      content: 'Hi',
      created_at: '2026-09-01T12:00:00.000Z',
      author: {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Jane',
        avatar_url: null,
      },
      commentCount: 0,
      reactions: [{ key: 'love', emoji: '❤️', count: 1, reactedByMe: true }],
      canEdit: true,
    });
    assert.ok(card);
    assert.equal(card.reactions[0].reactedByMe, true);
    assert.equal('canEdit' in card, false);
  });
});

describe('reactionStateKey + optimistic toggle', () => {
  it('keeps post and comment ids from colliding', () => {
    assert.notEqual(
      reactionStateKey('post', SAME_UUID),
      reactionStateKey('comment', SAME_UUID)
    );
  });

  it('increments and decrements only the toggled reaction without negatives', () => {
    const base = [
      { key: 'love', emoji: '❤️', count: 2, reactedByMe: false },
      { key: 'pray', emoji: '🙏', count: 1, reactedByMe: true },
      { key: 'praise', emoji: '🙌', count: 0, reactedByMe: false },
      { key: 'like', emoji: '👍', count: 3, reactedByMe: false },
    ];
    const afterLove = applyOptimisticReactionToggle(base, 'love');
    assert.equal(afterLove.find((r) => r.key === 'love').count, 3);
    assert.equal(afterLove.find((r) => r.key === 'love').reactedByMe, true);
    assert.equal(afterLove.find((r) => r.key === 'pray').reactedByMe, true);
    assert.equal(afterLove.find((r) => r.key === 'pray').count, 1);

    const afterPrayOff = applyOptimisticReactionToggle(afterLove, 'pray');
    assert.equal(afterPrayOff.find((r) => r.key === 'pray').count, 0);
    assert.equal(afterPrayOff.find((r) => r.key === 'pray').reactedByMe, false);
    assert.equal(afterPrayOff.find((r) => r.key === 'love').reactedByMe, true);

    const zeroBase = [
      { key: 'like', emoji: '👍', count: 0, reactedByMe: true },
    ];
    const afterZero = applyOptimisticReactionToggle(zeroBase, 'like');
    assert.equal(afterZero.find((r) => r.key === 'like').count, 0);
    assert.equal(afterZero.find((r) => r.key === 'like').reactedByMe, false);
  });
});

describe('community-reaction handler source contracts', () => {
  it('forwards only the fixed path, never cookies, and uses private no-store', () => {
    assert.ok(handlerSrc.includes('buildVaultCommunityReactionUrl'));
    assert.ok(handlerSrc.includes("Cache-Control', 'private, no-store'"));
    assert.equal(/Cookie\s*:/i.test(handlerSrc), false);
    assert.equal(handlerSrc.includes('req.headers.cookie'), false);
    assert.equal(handlerSrc.includes("headers?.cookie"), false);
    assert.ok(handlerSrc.includes('UPSTREAM_TIMEOUT_MS'));
    assert.ok(!/console\.(log|info|debug)\([^)]*token/i.test(handlerSrc));
    assert.ok(!/console\.(log|info|debug)\([^)]*body/i.test(handlerSrc));
    assert.ok(handlerSrc.includes("targetType === 'comment'"));
    assert.ok(handlerSrc.includes('privacyMessage'));
  });
});
