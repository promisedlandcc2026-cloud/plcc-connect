// Phone alerts bridge: only member actions reach the Vault, token forwarded, staff-only fields hidden.
// Run: node --test scripts/test-push-bridge.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { handlePushBridge, pushUpstreamQuery } from '../api/_utils/pushBridge.js';

function fakeRes() {
  const r = { statusCode: 0, body: null, headers: {} };
  r.setHeader = (k, v) => (r.headers[k] = v);
  r.status = (c) => ((r.statusCode = c), r);
  r.json = (b) => ((r.body = b), r);
  return r;
}

test('only member actions are forwarded', () => {
  assert.equal(pushUpstreamQuery('GET', { action: 'status' }).qs, 'resource=push&action=status');
  assert.match(pushUpstreamQuery('GET', { action: 'status', endpoint: 'https://fcm.googleapis.com/x' }).qs, /endpoint=https%3A%2F%2Ffcm/);
  assert.equal(pushUpstreamQuery('GET', { action: 'status', endpoint: 'javascript:x' }).qs, 'resource=push&action=status');
  assert.equal(pushUpstreamQuery('POST', { action: 'subscribe' }).qs, 'resource=push&action=subscribe');
  assert.equal(pushUpstreamQuery('POST', { action: 'test' }).qs, 'resource=push&action=test');
  assert.equal(pushUpstreamQuery('POST', { action: 'broadcast' }).ok, false, 'staff broadcast is Vault-only');
});

test('needs a signed-in member', async () => {
  const res = fakeRes();
  await handlePushBridge({ method: 'GET', headers: {}, query: { action: 'status' } }, res);
  assert.equal(res.statusCode, 401);
});

test('forwards the token to the fixed Vault address and hides staff-only fields', async () => {
  process.env.VAULT_API_ORIGIN = 'https://vault.example.com';
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, auth: init.headers.Authorization });
    return new Response(JSON.stringify({ ok: true, enabled: true, publicKey: 'BPK', subscribed: false, topics: [], canBroadcast: true }), { status: 200 });
  };
  try {
    const res = fakeRes();
    await handlePushBridge({ method: 'GET', headers: { authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig' }, query: { action: 'status' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(calls[0].url, 'https://vault.example.com/api/vault?resource=push&action=status');
    assert.match(calls[0].auth, /^Bearer /);
    assert.equal(res.body.publicKey, 'BPK');
    assert.equal('canBroadcast' in res.body, false);
  } finally {
    globalThis.fetch = realFetch;
  }
});
