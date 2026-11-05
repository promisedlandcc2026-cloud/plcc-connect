/**
 * Phase 6 Community post-create sanitize / command tests.
 * Run: node --test scripts/test-community-posts.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FEED_POST_MAX_CHARS,
  matchesImageMagic,
  parseCreatePostCommand,
  parsePostImagePayload,
  parseVaultCreatePostResponse,
  validatePostContent,
} from '../api/_utils/communityPostCreateSanitize.js';
import {
  buildVaultCommunityPostsCreateUrl,
  VAULT_COMMUNITY_POSTS_CREATE_PATH,
} from '../api/_utils/vaultOrigin.js';

const AUTHOR_ID = '11111111-1111-4111-8111-111111111111';
const POST_ID = '22222222-2222-4222-8222-222222222222';

/** Minimal valid 1x1 PNG */
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
const PNG_B64 = PNG_BYTES.toString('base64');

/** Minimal JPEG header + padding */
const JPEG_BYTES = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
  Buffer.alloc(32, 0),
]);
const JPEG_B64 = JPEG_BYTES.toString('base64');

describe('buildVaultCommunityPostsCreateUrl', () => {
  it('uses fixed posts path only', () => {
    const url = buildVaultCommunityPostsCreateUrl('https://vault.example.com/');
    assert.equal(url, `https://vault.example.com${VAULT_COMMUNITY_POSTS_CREATE_PATH}`);
    assert.ok(url.includes('feedType=posts'));
    assert.equal(url.includes('userId'), false);
    assert.equal(url.includes('author'), false);
  });
});

describe('validatePostContent', () => {
  it('trims and enforces length', () => {
    assert.equal(validatePostContent('  hello  ').ok, true);
    assert.equal(validatePostContent('').ok, false);
    assert.equal(validatePostContent('   ').ok, false);
    assert.equal(validatePostContent('', { allowEmptyWithImage: true }).ok, true);
    assert.equal(validatePostContent('x'.repeat(FEED_POST_MAX_CHARS)).ok, true);
    assert.equal(validatePostContent('x'.repeat(FEED_POST_MAX_CHARS + 1)).ok, false);
  });
});

describe('matchesImageMagic + parsePostImagePayload', () => {
  it('accepts valid PNG and JPEG signatures', () => {
    assert.equal(matchesImageMagic(PNG_BYTES, 'image/png'), true);
    assert.equal(matchesImageMagic(JPEG_BYTES, 'image/jpeg'), true);
    assert.equal(matchesImageMagic(PNG_BYTES, 'image/jpeg'), false);
  });

  it('rejects GIF, SVG, storage paths, and extra fields', () => {
    assert.equal(
      parsePostImagePayload({ mimeType: 'image/gif', fileBase64: PNG_B64 }).ok,
      false
    );
    assert.equal(
      parsePostImagePayload({ mimeType: 'image/svg+xml', fileBase64: PNG_B64 }).ok,
      false
    );
    assert.equal(
      parsePostImagePayload({
        mimeType: 'image/png',
        fileBase64: PNG_B64,
        imagePath: 'feed/x/y.png',
      }).ok,
      false
    );
    assert.equal(
      parsePostImagePayload({
        mimeType: 'image/png',
        fileBase64: PNG_B64,
        storagePath: 'feed/x/y.png',
      }).ok,
      false
    );
    assert.equal(
      parsePostImagePayload({
        mimeType: 'image/png',
        fileBase64: JPEG_B64,
      }).ok,
      false
    );
  });

  it('accepts a valid PNG payload', () => {
    const parsed = parsePostImagePayload({
      mimeType: 'image/png',
      fileBase64: PNG_B64,
    });
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.mimeType, 'image/png');
      assert.ok(parsed.bytes > 0);
    }
  });
});

describe('parseCreatePostCommand', () => {
  it('maps text-only create to Vault general category', () => {
    const parsed = parseCreatePostCommand({ content: '  Hello church  ' });
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.deepEqual(parsed.vaultBody, {
        category: 'general',
        content: 'Hello church',
      });
      assert.equal(parsed.hasImage, false);
    }
  });

  it('maps text + image and allows image-only', () => {
    const withImage = parseCreatePostCommand({
      content: 'Photo day',
      image: { mimeType: 'image/png', fileBase64: PNG_B64 },
    });
    assert.equal(withImage.ok, true);
    if (withImage.ok) {
      assert.equal(withImage.vaultBody.category, 'general');
      assert.equal(withImage.hasImage, true);
      assert.equal(withImage.vaultBody.image.mimeType, 'image/png');
    }

    const imageOnly = parseCreatePostCommand({
      content: '   ',
      image: { mimeType: 'image/png', fileBase64: PNG_B64 },
    });
    assert.equal(imageOnly.ok, true);
    if (imageOnly.ok) {
      assert.equal(imageOnly.vaultBody.content, '');
      assert.equal(imageOnly.hasImage, true);
    }
  });

  it('rejects empty, extras, user/author ids, and category override', () => {
    assert.equal(parseCreatePostCommand({ content: '' }).ok, false);
    assert.equal(parseCreatePostCommand({ content: 'hi', userId: AUTHOR_ID }).ok, false);
    assert.equal(parseCreatePostCommand({ content: 'hi', authorId: AUTHOR_ID }).ok, false);
    assert.equal(parseCreatePostCommand({ content: 'hi', category: 'prayer' }).ok, false);
    assert.equal(
      parseCreatePostCommand({ content: 'hi', mentionedUserIds: [AUTHOR_ID] }).ok,
      false
    );
    assert.equal(
      parseCreatePostCommand({ content: 'hi', imagePath: 'feed/a/b.png' }).ok,
      false
    );
    assert.equal(
      parseCreatePostCommand({
        content: 'x'.repeat(FEED_POST_MAX_CHARS + 1),
      }).ok,
      false
    );
  });
});

describe('parseVaultCreatePostResponse', () => {
  it('sanitizes created post and strips sensitive fields', () => {
    const parsed = parseVaultCreatePostResponse({
      ok: true,
      post: {
        id: POST_ID,
        category: 'general',
        categoryLabel: 'General',
        content: 'Hello',
        contentDisplay: 'Hello',
        created_at: '2026-09-12T12:00:00.000Z',
        updated_at: null,
        edited: false,
        pinned: false,
        author: {
          id: AUTHOR_ID,
          name: 'Pat',
          avatar_url: 'https://cdn.example.com/a.png',
          email: 'secret@example.com',
          role: 'ADMIN',
        },
        imageUrl: 'https://cdn.example.com/signed.png',
        imageAlt: 'Photo shared by Pat',
        commentCount: 0,
        reactions: [],
        canModerate: true,
        viewerCanModerate: true,
      },
      mentionNotify: { delivered: 1 },
    });
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.post.id, POST_ID);
      assert.equal(parsed.post.content, 'Hello');
      assert.equal(parsed.post.author.name, 'Pat');
      assert.equal(parsed.post.author.email, undefined);
      assert.equal(parsed.post.canModerate, undefined);
      assert.equal(parsed.post.mentionNotify, undefined);
      assert.equal(parsed.post.imageUrl, 'https://cdn.example.com/signed.png');
    }
  });

  it('rejects malformed upstream bodies', () => {
    assert.equal(parseVaultCreatePostResponse(null).ok, false);
    assert.equal(parseVaultCreatePostResponse({ ok: false }).ok, false);
    assert.equal(parseVaultCreatePostResponse({ ok: true, post: {} }).ok, false);
  });
});
