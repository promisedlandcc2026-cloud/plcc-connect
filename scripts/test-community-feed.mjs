/**
 * Phase 2 Community feed sanitize / pagination tests.
 * Run: node --test scripts/test-community-feed.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFeedPaginationQuery,
  parseVaultCommunityFeedResponse,
  sanitizeFeedPost,
} from '../api/_utils/communityFeedSanitize.js';
import {
  buildVaultCommunityFeedUrl,
  VAULT_COMMUNITY_FEED_PATH,
} from '../api/_utils/vaultOrigin.js';

const AUTHOR = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Jane Member',
  avatar_url: 'https://cdn.example.com/a.png',
};

const RAW_POST = {
  id: '22222222-2222-4222-8222-222222222222',
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
  reactions: [
    { key: 'love', emoji: '❤️', count: 2, reactedByMe: true },
    { key: 'nope', emoji: 'x', count: 9 },
  ],
  canEdit: true,
  canRemove: true,
  canPin: true,
  viewerCanModerate: true,
};

describe('buildVaultCommunityFeedUrl', () => {
  it('uses fixed feed path and validated pagination', () => {
    const url = buildVaultCommunityFeedUrl('https://vault.example.com/', {
      limit: 20,
      offset: 40,
    });
    assert.ok(url.startsWith('https://vault.example.com'));
    assert.ok(url.includes(VAULT_COMMUNITY_FEED_PATH.split('&')[0]));
    assert.ok(url.includes('feedType=posts'));
    assert.ok(url.includes('limit=20'));
    assert.ok(url.includes('offset=40'));
  });
});

describe('parseFeedPaginationQuery', () => {
  it('defaults and accepts valid bounds', () => {
    assert.deepEqual(parseFeedPaginationQuery({}), { ok: true, limit: 20, offset: 0 });
    assert.deepEqual(parseFeedPaginationQuery({ limit: '10', offset: '5' }), {
      ok: true,
      limit: 10,
      offset: 5,
    });
  });

  it('rejects unexpected params and bad bounds', () => {
    assert.equal(parseFeedPaginationQuery({ category: 'prayer' }).ok, false);
    assert.equal(parseFeedPaginationQuery({ limit: '99' }).ok, false);
    assert.equal(parseFeedPaginationQuery({ offset: '-1' }).ok, false);
    assert.equal(parseFeedPaginationQuery({ feedType: 'posts' }).ok, false);
  });
});

describe('sanitizeFeedPost', () => {
  it('keeps presentation fields and strips sensitive/admin fields', () => {
    const card = sanitizeFeedPost(RAW_POST);
    assert.ok(card);
    assert.equal(card.content.includes('<b>'), true); // plain text, not HTML-executed
    assert.equal(card.author.name, 'Jane Member');
    assert.equal(card.author.avatarUrl, 'https://cdn.example.com/a.png');
    assert.equal(card.pinned, true);
    assert.equal(card.commentCount, 3);
    assert.equal(card.reactions.length, 1);
    assert.equal(card.reactions[0].key, 'love');
    assert.equal(card.reactions[0].reactedByMe, true);
    assert.equal('canEdit' in card, false);
    assert.equal('canRemove' in card, false);
    assert.equal('canPin' in card, false);
    assert.equal('pinned_by' in card, false);
    assert.equal('image_path' in card, false);
    assert.equal('commentsPreview' in card, false);
    assert.equal('email' in card.author, false);
  });

  it('skips malformed posts', () => {
    assert.equal(sanitizeFeedPost({ id: 'bad' }), null);
    assert.equal(sanitizeFeedPost(null), null);
  });
});

describe('parseVaultCommunityFeedResponse', () => {
  it('maps success and skips bad rows', () => {
    const parsed = parseVaultCommunityFeedResponse({
      ok: true,
      posts: [RAW_POST, { id: 'nope' }],
      pageSize: 20,
      offset: 0,
      hasMore: true,
      viewerCanModerate: true,
      queryStrategy: 'secret-doc',
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.feed.posts.length, 1);
    assert.equal(parsed.skipped, 1);
    assert.equal(parsed.feed.hasMore, true);
    assert.equal('viewerCanModerate' in parsed.feed, false);
    assert.equal('queryStrategy' in parsed.feed, false);
  });

  it('rejects invalid bodies', () => {
    assert.equal(parseVaultCommunityFeedResponse(null).ok, false);
    assert.equal(parseVaultCommunityFeedResponse({ ok: true }).ok, false);
  });
});
