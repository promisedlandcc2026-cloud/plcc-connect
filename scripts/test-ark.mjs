import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { arkUpstreamQuery, handleArkBridge } from '../api/_utils/arkBridge.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('Ark bridge only forwards member actions', () => {
  assert.equal(arkUpstreamQuery('GET', { action: 'me' }).qs, 'resource=ark&action=me');
  assert.equal(arkUpstreamQuery('GET', { action: 'board', game: 'tetris', period: 'all' }).qs, 'resource=ark&action=board&game=tetris&period=all');
  assert.equal(arkUpstreamQuery('GET', { action: 'board', game: 'tetris', period: 'x' }).qs, 'resource=ark&action=board&game=tetris&period=week');
  assert.equal(arkUpstreamQuery('GET', { action: 'board', game: 'dove', period: 'week' }).qs, 'resource=ark&action=board&game=dove&period=week');
  assert.equal(arkUpstreamQuery('POST', { action: 'score' }).qs, 'resource=ark&action=score');
  assert.equal(arkUpstreamQuery('POST', { action: 'privacy' }).qs, 'resource=ark&action=privacy');
  assert.equal(arkUpstreamQuery('GET', { action: 'privacy' }).ok, false);
  assert.equal(arkUpstreamQuery('GET', { action: 'board', game: 'chess' }).ok, false);
  for (const staffOnly of ['admin', 'remove', 'approve', 'settings']) {
    assert.equal(arkUpstreamQuery('POST', { action: staffOnly }).ok, false, staffOnly);
    assert.equal(arkUpstreamQuery('GET', { action: staffOnly }).ok, false, staffOnly);
  }
});

function fakeRes() {
  const out = { status: 0, body: null, headers: {} };
  return { out, setHeader(k, v) { out.headers[k] = v; }, status(s) { out.status = s; return this; }, json(b) { out.body = b; return this; } };
}

test('Ark bridge needs sign-in and caps body size', async () => {
  let r = fakeRes();
  await handleArkBridge({ method: 'GET', query: { action: 'me' }, headers: {} }, r);
  assert.equal(r.out.status, 401);
  r = fakeRes();
  await handleArkBridge({ method: 'POST', query: { action: 'score' }, headers: { authorization: 'Bearer a.b.c' }, body: 'x'.repeat(5000) }, r);
  assert.ok([413, 503].includes(r.out.status));
  r = fakeRes();
  await handleArkBridge({ method: 'DELETE', query: {}, headers: {} }, r);
  assert.equal(r.out.status, 405);
});

test('/ark is served by the Ark site, before the app catch-all; /api/ark rides on vault-news', () => {
  const v = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
  const idx = (s) => v.rewrites.findIndex((r) => r.source === s);
  assert.ok(idx('/ark') >= 0 && idx('/ark/(.*)') >= 0);
  assert.match(v.rewrites[idx('/ark/(.*)')].destination, /^https:\/\/awc-ark\.vercel\.app\/ark\/\$1$/);
  assert.ok(idx('/ark/(.*)') < idx('/(.*)'));
  assert.equal(v.rewrites[idx('/api/ark')].destination, '/api/vault-news?bridge=ark');
  assert.ok(idx('/api/ark') < idx('/api/(.*)'));
  assert.match(readFileSync(join(root, 'api/vault-news.js'), 'utf8'), /handleArkBridge/);
  const app = readFileSync(join(root, 'App.tsx'), 'utf8');
  assert.match(app, /path="\/ark\/\*"/);
});
