import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGalleryFeed, sanitizeGalleryItem } from '../api/_utils/galleryBridge.js';

const ORIGIN = 'https://sanctum-live-nine.vercel.app';

function mockFetch(routes) {
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const path = String(url).replace(ORIGIN, '');
    if (!(path in routes)) throw new Error(`unexpected fetch ${url}`);
    const r = routes[path];
    if (r instanceof Error) throw r;
    return new Response(JSON.stringify(r), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  return () => {
    globalThis.fetch = real;
  };
}

test('sanitize keeps only https or site-relative URLs and known fields', () => {
  assert.equal(sanitizeGalleryItem({ url: 'javascript:alert(1)' }, ORIGIN), null);
  assert.equal(sanitizeGalleryItem({ url: '//evil.example/x.jpg' }, ORIGIN), null);
  const item = sanitizeGalleryItem(
    { id: 'a', type: 'image', url: '/images/a.jpg', title: 'A', width: '1800', height: 1200, extra: 'drop me' },
    ORIGIN
  );
  assert.equal(item.url, `${ORIGIN}/images/a.jpg`);
  assert.equal(item.thumbnail, `${ORIGIN}/images/a.jpg`);
  assert.equal(item.width, 1800);
  assert.equal('extra' in item, false);
});

test('feed merges Leah, church photos, videos and admin uploads', async () => {
  const restore = mockFetch({
    '/api/gallery/pixieset': {
      items: [{ id: 'pixieset-1', type: 'image', url: 'https://images.pixieset.com/1/abc-xlarge.jpg', thumbnail: 'https://images.pixieset.com/1/abc-medium.jpg', width: 4024, height: 6048 }],
    },
    '/gallery-feed.json': {
      photos: [{ id: 'c1', type: 'image', url: `${ORIGIN}/images/gallery/church/img-1.jpg`, title: 'Worship', category: 'Worship' }],
      videos: [{ id: 'v1', type: 'video', url: `${ORIGIN}/video/v1.mp4`, thumbnail: `${ORIGIN}/images/v1.jpg`, title: 'Clip' }],
    },
    '/api/gallery': [
      { id: 'u1', type: 'image', url: '/uploads/new.jpg', title: 'Upload' },
      { id: 'u2', type: 'image', url: '/images/home-hero.jpg', title: 'Old promo' },
      { id: 'dup', type: 'image', url: `${ORIGIN}/images/gallery/church/img-1.jpg` },
    ],
  });
  try {
    const feed = await buildGalleryFeed(ORIGIN);
    assert.equal(feed.leah.length, 1);
    assert.equal(feed.leah[0].credit.name, 'Leah');
    assert.deepEqual(feed.church.map((i) => i.id), ['c1', 'u1']);
    assert.equal(feed.videos.length, 1);
    assert.equal(feed.partial, false);
  } finally {
    restore();
  }
});

test('feed still returns what it can when a source is down', async () => {
  const restore = mockFetch({
    '/api/gallery/pixieset': new Error('down'),
    '/gallery-feed.json': { photos: [{ id: 'c1', type: 'image', url: `${ORIGIN}/a.jpg` }], videos: [] },
    '/api/gallery': new Error('down'),
  });
  try {
    const feed = await buildGalleryFeed(ORIGIN);
    assert.equal(feed.leah.length, 0);
    assert.equal(feed.church.length, 1);
    assert.equal(feed.partial, true);
  } finally {
    restore();
  }
});
