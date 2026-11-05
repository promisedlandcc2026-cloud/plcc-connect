/**
 * Phase 5 Community comments sanitize / command tests.
 * Run: node --test scripts/test-community-comments.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FEED_COMMENT_MAX_CHARS,
  parseCommentsListQuery,
  parseCreateCommentCommand,
  parseDeleteCommentCommand,
  parseEditCommentCommand,
  parseVaultCommentMutationResponse,
  parseVaultCommentsListResponse,
  sanitizeComment,
  validateConnectCommentContent,
} from '../api/_utils/communityCommentSanitize.js';
import {
  buildVaultCommunityCommentsUrl,
  VAULT_COMMUNITY_COMMENTS_PATH,
} from '../api/_utils/vaultOrigin.js';
import { resolveNotificationDestination } from '../api/_utils/notificationSanitize.js';

const POST_ID = '22222222-2222-4222-8222-222222222222';
const COMMENT_ID = '33333333-3333-4333-8333-333333333333';
const AUTHOR = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Jane Member',
  avatar_url: 'https://cdn.example.com/a.png',
};

const RAW = {
  id: COMMENT_ID,
  post_id: POST_ID,
  content: 'Hello <b>world</b>',
  contentDisplay: 'Hello <b>world</b>',
  created_at: '2026-09-01T12:00:00.000Z',
  updated_at: '2026-09-01T12:05:00.000Z',
  edited: true,
  author: AUTHOR,
  reactions: [{ key: 'love', emoji: '❤️', count: 1, reactedByMe: false }],
  canEdit: true,
  canRemove: true,
  email: 'secret@example.com',
};

describe('buildVaultCommunityCommentsUrl', () => {
  it('uses fixed comments path', () => {
    const list = buildVaultCommunityCommentsUrl('https://vault.example.com/', POST_ID);
    assert.ok(list.includes(VAULT_COMMUNITY_COMMENTS_PATH));
    assert.ok(list.includes(`postId=${POST_ID}`));
    const write = buildVaultCommunityCommentsUrl('https://vault.example.com/');
    assert.equal(write, `https://vault.example.com${VAULT_COMMUNITY_COMMENTS_PATH}`);
  });
});

describe('parseCommentsListQuery', () => {
  it('accepts only postId', () => {
    assert.deepEqual(parseCommentsListQuery({ postId: POST_ID }), {
      ok: true,
      postId: POST_ID,
    });
  });
  it('rejects extras and bad ids', () => {
    assert.equal(parseCommentsListQuery({}).ok, false);
    assert.equal(parseCommentsListQuery({ postId: 'x' }).ok, false);
    assert.equal(parseCommentsListQuery({ postId: POST_ID, limit: '1' }).ok, false);
  });
});

describe('comment content validation', () => {
  it('trims and enforces length', () => {
    assert.equal(validateConnectCommentContent('  hi  ').ok, true);
    assert.equal(validateConnectCommentContent('   ').ok, false);
    assert.equal(validateConnectCommentContent('x'.repeat(FEED_COMMENT_MAX_CHARS + 1)).ok, false);
  });
});

describe('sanitizeComment', () => {
  it('keeps presentation fields and forces self-only delete', () => {
    const c = sanitizeComment(RAW);
    assert.ok(c);
    assert.equal(c.content.includes('<b>'), true);
    assert.equal(c.canEdit, true);
    assert.equal(c.canDelete, true);
    assert.equal('canRemove' in c, false);
    assert.equal('email' in c.author, false);
    assert.equal(c.reactions[0].key, 'love');
    assert.equal(c.reactions[0].reactedByMe, false);
  });

  it('strips moderator-only remove when canEdit is false', () => {
    const c = sanitizeComment({ ...RAW, canEdit: false, canRemove: true });
    assert.ok(c);
    assert.equal(c.canEdit, false);
    assert.equal(c.canDelete, false);
  });

  it('skips malformed', () => {
    assert.equal(sanitizeComment({ id: 'bad' }), null);
  });
});

describe('parse commands', () => {
  it('maps create/edit/delete to Vault shapes', () => {
    const create = parseCreateCommentCommand({ postId: POST_ID, content: 'Hi' });
    assert.equal(create.ok, true);
    assert.deepEqual(create.vaultBody, { postId: POST_ID, content: 'Hi' });

    const edit = parseEditCommentCommand({ commentId: COMMENT_ID, content: 'Updated' });
    assert.equal(edit.ok, true);
    assert.deepEqual(edit.vaultBody, { id: COMMENT_ID, content: 'Updated' });

    const del = parseDeleteCommentCommand({ commentId: COMMENT_ID });
    assert.equal(del.ok, true);
    assert.deepEqual(del.vaultBody, { id: COMMENT_ID });
  });

  it('rejects extras and user ids', () => {
    assert.equal(
      parseCreateCommentCommand({
        postId: POST_ID,
        content: 'Hi',
        userId: AUTHOR.id,
      }).ok,
      false
    );
    assert.equal(
      parseEditCommentCommand({
        commentId: COMMENT_ID,
        content: 'Hi',
        authorId: AUTHOR.id,
      }).ok,
      false
    );
  });
});

describe('parseVaultCommentsListResponse', () => {
  it('maps list and skips bad rows', () => {
    const parsed = parseVaultCommentsListResponse(
      { ok: true, comments: [RAW, { id: 'nope' }] },
      POST_ID
    );
    assert.equal(parsed.ok, true);
    assert.equal(parsed.list.comments.length, 1);
    assert.equal(parsed.skipped, 1);
    assert.equal(parsed.list.hasMore, false);
  });
});

describe('parseVaultCommentMutationResponse', () => {
  it('maps created comment', () => {
    const parsed = parseVaultCommentMutationResponse({ ok: true, comment: RAW }, POST_ID);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.comment.id, COMMENT_ID);
  });
});

describe('notification comment deep link', () => {
  it('appends comment query for comment notifications', () => {
    const dest = resolveNotificationDestination(
      'community_feed_comment',
      COMMENT_ID,
      `/community/feed?post=${POST_ID}&comment=${COMMENT_ID}`
    );
    assert.equal(dest?.path, `/community/post/${POST_ID}?comment=${COMMENT_ID}`);
    assert.equal(dest?.commentId, COMMENT_ID);
  });
});
