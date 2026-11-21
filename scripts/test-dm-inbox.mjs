import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/_community/community-chat.js';
import { sanitizeDmList } from '../api/_utils/communityChatSanitize.js';

const channelId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const partnerId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const row = { channelId, partnerId, partnerName: 'Grace', lastMessageAt: '2026-11-21T00:00:00Z', lastMessage: 'private text', email: 'secret@example.com' };
const response = () => ({ headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('DM list only returns bounded, valid metadata and drops private fields', () => {
  assert.deepEqual(sanitizeDmList({ conversations: [row, { ...row, channelId: 'bad' }] }), [{ channelId, partnerId, partnerName: 'Grace', lastMessageAt: '2026-11-21T00:00:00.000Z', blocked: false }]);
  assert.deepEqual(sanitizeDmList(null), []);
});

test('DM inbox requires auth and forwards only the member token to the fixed Vault endpoint', async () => {
  const oldFetch = globalThis.fetch;
  const oldOrigin = process.env.VAULT_API_ORIGIN;
  process.env.VAULT_API_ORIGIN = 'https://vault.example.com';
  let calls = [];
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return new Response(JSON.stringify({ conversations: [row] }), { status: 200 }); };
  try {
    let res = response();
    await handler({ method: 'GET', query: { resource: 'dm-list' }, headers: {} }, res);
    assert.equal(res.statusCode, 401);
    assert.equal(calls.length, 0);
    res = response();
    await handler({ method: 'GET', query: { resource: 'dm-list' }, headers: { authorization: 'Bearer aaa.bbb.ccc' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['Cache-Control'], 'private, no-store');
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /subResource=dm-list$/);
    assert.equal(calls[0].options.headers.Authorization, 'Bearer aaa.bbb.ccc');
    assert.deepEqual(res.body.conversations, sanitizeDmList({ conversations: [row] }));
    res = response();
    await handler({ method: 'GET', query: { resource: 'dm-list', member: partnerId }, headers: { authorization: 'Bearer aaa.bbb.ccc' } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(calls.length, 1);
  } finally { globalThis.fetch = oldFetch; if (oldOrigin === undefined) delete process.env.VAULT_API_ORIGIN; else process.env.VAULT_API_ORIGIN = oldOrigin; }
});

test('recent conversation fallback is isolated by account and leaves the legacy list untouched', async () => {
  const { readFile } = await import('node:fs/promises');
  const { transform } = await import('esbuild');
  const source = await readFile(new URL('../lib/dmRecents.ts', import.meta.url), 'utf8');
  const compiled = await transform(source, { loader: 'ts', format: 'esm' });
  const store = new Map([['awc.chat.dmRecents.v1', 'legacy-data']]);
  const previous = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  try {
    const m = await import(`data:text/javascript;base64,${Buffer.from(compiled.code).toString('base64')}`);
    m.rememberDmRecent({ ownerId: 'alice', channelId, partner: { id: partnerId, name: 'Grace', avatarUrl: null } });
    assert.equal(m.listDmRecents('alice')[0].partnerName, 'Grace');
    assert.deepEqual(m.listDmRecents('bob'), []);
    assert.deepEqual(m.listDmRecents(''), []);
    assert.equal(m.dmDisplayName(channelId, '', 'bob'), '');
    assert.equal(store.get('awc.chat.dmRecents.v1'), 'legacy-data');
  } finally { if (previous === undefined) delete globalThis.localStorage; else globalThis.localStorage = previous; }
});

test('smoke: open a private conversation and start a voice or video call', async () => {
  const oldFetch = globalThis.fetch;
  const oldOrigin = process.env.VAULT_API_ORIGIN;
  process.env.VAULT_API_ORIGIN = 'https://vault.example.com';
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('subResource=dm-channel')) return new Response(JSON.stringify({ id: channelId, name: 'DM_hidden', visibility: 'dm', type: 'private' }), { status: 200 });
    if (String(url).includes('subResource=dm-call')) return new Response(JSON.stringify({ channelId, partnerId, token: 'test-call-token', url: 'wss://calls.example.com', video: JSON.parse(options.body).video }), { status: 200 });
    throw new Error('unexpected upstream route');
  };
  const headers = { authorization: 'Bearer aaa.bbb.ccc', 'content-type': 'application/json' };
  try {
    let res = response();
    await handler({ method: 'POST', query: { resource: 'dm' }, headers, body: { partnerId } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.channel.id, channelId);
    assert.equal(res.body.channel.visibility, 'dm');
    assert.match(calls[0].url, /subResource=dm-channel/);
    assert.match(calls[0].url, new RegExp(`partnerId=${partnerId}`));
    for (const video of [false, true]) {
      res = response();
      await handler({ method: 'POST', query: { resource: 'dm-call' }, headers, body: { action: 'ring', channelId, video } }, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.channelId, channelId);
      assert.equal(res.body.video, video);
      assert.equal(res.body.token, 'test-call-token');
      const last = calls.at(-1);
      assert.equal(last.options.headers.Authorization, headers.authorization);
      assert.deepEqual(JSON.parse(last.options.body), { action: 'ring', channelId, video });
    }
    res = response();
    await handler({ method: 'POST', query: { resource: 'dm-call' }, headers, body: { action: 'ring', channelId: 'not-a-uuid' } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(calls.length, 3);
  } finally { globalThis.fetch = oldFetch; if (oldOrigin === undefined) delete process.env.VAULT_API_ORIGIN; else process.env.VAULT_API_ORIGIN = oldOrigin; }
});

test('smoke: inbox errors are not mistaken for an empty inbox', async () => {
  const oldFetch = globalThis.fetch;
  const oldOrigin = process.env.VAULT_API_ORIGIN;
  process.env.VAULT_API_ORIGIN = 'https://vault.example.com';
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: false }), { status: 200 });
    const res = response();
    await handler({ method: 'GET', query: { resource: 'dm-list' }, headers: { authorization: 'Bearer aaa.bbb.ccc' } }, res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.ok, false);
    assert.equal(res.body.conversations, undefined);
  } finally { globalThis.fetch = oldFetch; if (oldOrigin === undefined) delete process.env.VAULT_API_ORIGIN; else process.env.VAULT_API_ORIGIN = oldOrigin; }
});
