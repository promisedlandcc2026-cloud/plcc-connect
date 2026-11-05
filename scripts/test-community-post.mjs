/**
 * Phase 3.5 Community single-post sanitize / query tests.
 * Run: node --test scripts/test-community-post.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCommunityPostQuery,
  parseVaultSinglePostResponse,
  sanitizeFeedPost,
} from '../api/_utils/communityFeedSanitize.js';
import {
  buildVaultCommunityPostUrl,
  VAULT_COMMUNITY_POST_PATH,
} from '../api/_utils/vaultOrigin.js';

const POST_ID = '22222222-2222-4222-8222-222222222222';
const AUTHOR = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Jane Member',
  avatar_url: 'https://cdn.example.com/a.png',
};

const RAW_POST = {
  id: POST_ID,
  category: 'general',
  categoryLabel: 'General',
  content: 'Hello <b>world</b>',
  contentDisplay: 'Hello <b>world</b>',
  created_at: '2026-09-01T12:00:00.000Z',
  updated_at: '2026-09-01T12:00:00.000Z',
  edited: false,
  pinned: true,
  pinned_by: 'admin-id',
  author: AUTHOR,
  imageUrl: 'https://cdn.example.com/img.jpg',
  imageAlt: 'Photo from Jane Member',
  image_path: 'secret/path.jpg',
  commentCount: 3,
  commentsPreview: [{ id: 'x', content: 'hidden' }],
  reactions: [{ key: 'love', emoji: '❤️', count: 2, reactedByMe: true }],
  canEdit: true,
  canRemove: true,
  canPin: true,
  viewerCanModerate: true,
};

describe('buildVaultCommunityPostUrl', () => {
  it('uses fixed feed path with validated id only', () => {
    const url = buildVaultCommunityPostUrl('https://vault.example.com/', POST_ID);
    assert.ok(url.startsWith('https://vault.example.com'));
    assert.ok(url.includes(VAULT_COMMUNITY_POST_PATH.split('&')[0]));
    assert.ok(url.includes('feedType=posts'));
    assert.ok(url.includes(`id=${POST_ID}`));
    assert.equal(url.includes('cookie'), false);
  });
});

describe('parseCommunityPostQuery', () => {
  it('accepts a single valid UUID id', () => {
    assert.deepEqual(parseCommunityPostQuery({ id: POST_ID }), { ok: true, id: POST_ID });
  });

  it('rejects missing, invalid, duplicate, and unexpected params', () => {
    assert.equal(parseCommunityPostQuery({}).ok, false);
    assert.equal(parseCommunityPostQuery({ id: 'nope' }).ok, false);
    assert.equal(parseCommunityPostQuery({ id: [POST_ID, POST_ID] }).ok, false);
    assert.equal(parseCommunityPostQuery({ id: POST_ID, limit: '1' }).ok, false);
    assert.equal(parseCommunityPostQuery({ postId: POST_ID }).ok, false);
  });
});

describe('parseVaultSinglePostResponse', () => {
  it('returns one sanitized post and strips sensitive fields', () => {
    const parsed = parseVaultSinglePostResponse({
      ok: true,
      posts: [RAW_POST],
      pageSize: 1,
      offset: 0,
      hasMore: false,
      deepLink: true,
      viewerCanModerate: true,
    });
    assert.equal(parsed.ok, true);
    assert.equal(parsed.post.id, POST_ID);
    assert.equal(parsed.post.content, 'Hello <b>world</b>');
    assert.equal('canEdit' in parsed.post, false);
    assert.equal('image_path' in parsed.post, false);
    assert.equal('viewerCanModerate' in parsed.post, false);
  });

  it('rejects empty or malformed post bodies', () => {
    assert.equal(parseVaultSinglePostResponse({ ok: true, posts: [] }).ok, false);
    assert.equal(
      parseVaultSinglePostResponse({ ok: true, posts: [{ id: 'bad' }] }).ok,
      false
    );
    assert.equal(sanitizeFeedPost({ id: POST_ID, author: AUTHOR }), null);
  });
});
