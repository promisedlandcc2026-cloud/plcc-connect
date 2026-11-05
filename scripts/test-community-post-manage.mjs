/**
 * Phase 7 Community post manage / ownership tests.
 * Run: node --test scripts/test-community-post-manage.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertSelfOwnsPost,
  parsePostManageCommand,
  parseVaultDeletePostResponse,
  parseVaultEditPostResponse,
} from '../api/_utils/communityPostManageSanitize.js';
import { sanitizeFeedPost } from '../api/_utils/communityFeedSanitize.js';
import {
  buildVaultCommunityPostsCreateUrl,
  VAULT_COMMUNITY_POSTS_CREATE_PATH,
} from '../api/_utils/vaultOrigin.js';

const SELF = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const POST_ID = '33333333-3333-4333-8333-333333333333';

function vaultPost(authorId, extras = {}) {
  return {
    id: POST_ID,
    category: 'general',
    categoryLabel: 'General',
    content: 'Hello',
    contentDisplay: 'Hello',
    created_at: '2026-09-12T12:00:00.000Z',
    updated_at: null,
    edited: false,
    pinned: false,
    author: { id: authorId, name: 'Pat', avatar_url: null },
    imageUrl: null,
    commentCount: 0,
    reactions: [],
    canEdit: authorId === SELF,
    canRemove: true, // moderator-style — must NOT become canDeleteOwnPost
    ...extras,
  };
}

describe('fixed manage upstream path', () => {
  it('reuses posts feedType path for PATCH/DELETE', () => {
    const url = buildVaultCommunityPostsCreateUrl('https://vault.example.com/');
    assert.equal(url, `https://vault.example.com${VAULT_COMMUNITY_POSTS_CREATE_PATH}`);
    assert.ok(url.includes('feedType=posts'));
  });
});

describe('sanitizeFeedPost ownership flags', () => {
  it('sets self-only flags from viewerId, ignoring upstream canRemove', () => {
    const own = sanitizeFeedPost(vaultPost(SELF), { viewerId: SELF });
    assert.equal(own.authoredByMe, true);
    assert.equal(own.canEditOwnPost, true);
    assert.equal(own.canDeleteOwnPost, true);
    assert.equal(own.canRemove, undefined);

    const other = sanitizeFeedPost(vaultPost(OTHER, { canRemove: true }), {
      viewerId: SELF,
    });
    assert.equal(other.authoredByMe, false);
    assert.equal(other.canEditOwnPost, false);
    assert.equal(other.canDeleteOwnPost, false);
  });
});

describe('assertSelfOwnsPost', () => {
  it('allows matching author and rejects mismatch / malformed', () => {
    const post = sanitizeFeedPost(vaultPost(SELF), { viewerId: SELF });
    assert.equal(assertSelfOwnsPost(SELF, post).ok, true);

    const other = sanitizeFeedPost(vaultPost(OTHER), { viewerId: OTHER });
    assert.equal(assertSelfOwnsPost(SELF, other).ok, false);
    assert.equal(assertSelfOwnsPost(SELF, other).reason, 'not_owner');

    assert.equal(assertSelfOwnsPost(null, post).ok, false);
    assert.equal(assertSelfOwnsPost(SELF, null).ok, false);
    assert.equal(assertSelfOwnsPost(SELF, { id: POST_ID }).ok, false);
  });
});

describe('parsePostManageCommand', () => {
  it('maps edit and delete to Vault shapes', () => {
    const edit = parsePostManageCommand({
      action: 'edit',
      postId: POST_ID,
      content: '  Updated  ',
    });
    assert.equal(edit.ok, true);
    assert.deepEqual(edit.vaultBody, { id: POST_ID, content: 'Updated' });

    const del = parsePostManageCommand({ action: 'delete', postId: POST_ID });
    assert.equal(del.ok, true);
    assert.deepEqual(del.vaultBody, { id: POST_ID });
  });

  it('rejects empty, extras, author ids, canEdit, and image actions', () => {
    assert.equal(
      parsePostManageCommand({ action: 'edit', postId: POST_ID, content: '   ' }).ok,
      false
    );
    assert.equal(
      parsePostManageCommand({
        action: 'edit',
        postId: POST_ID,
        content: 'x'.repeat(3001),
      }).ok,
      false
    );
    assert.equal(
      parsePostManageCommand({
        action: 'edit',
        postId: POST_ID,
        content: 'Hi',
        authorId: SELF,
      }).ok,
      false
    );
    assert.equal(
      parsePostManageCommand({
        action: 'edit',
        postId: POST_ID,
        content: 'Hi',
        canEdit: true,
      }).ok,
      false
    );
    assert.equal(
      parsePostManageCommand({
        action: 'edit',
        postId: POST_ID,
        content: 'Hi',
        imageAction: 'remove',
      }).ok,
      false
    );
    assert.equal(
      parsePostManageCommand({ action: 'pin', postId: POST_ID }).ok,
      false
    );
    assert.equal(parsePostManageCommand({ action: 'delete', postId: 'bad' }).ok, false);
  });
});

describe('parseVaultEditPostResponse / delete', () => {
  it('sanitizes edit response for self viewer', () => {
    const parsed = parseVaultEditPostResponse(
      {
        ok: true,
        post: vaultPost(SELF, {
          content: 'Edited',
          contentDisplay: 'Edited',
          updated_at: '2026-09-12T13:00:00.000Z',
          edited: true,
        }),
      },
      SELF
    );
    assert.equal(parsed.ok, true);
    assert.equal(parsed.post.content, 'Edited');
    assert.equal(parsed.post.authoredByMe, true);
    assert.equal(parsed.post.canDeleteOwnPost, true);
  });

  it('accepts delete ok and strips moderated flag', () => {
    const parsed = parseVaultDeletePostResponse({ ok: true, moderated: true });
    assert.equal(parsed.ok, true);
  });

  it('rejects malformed bodies', () => {
    assert.equal(parseVaultEditPostResponse({ ok: false }).ok, false);
    assert.equal(parseVaultDeletePostResponse({ ok: false }).ok, false);
  });
});
