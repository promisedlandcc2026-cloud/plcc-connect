import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleSsoBridge } from '../api/_utils/ssoBridge.js';

function mockRes() {
  const r = { statusCode: 0, body: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}
const JWT = 'aaa.bbb.ccc';

test('rejects GET and missing token', async () => {
  let res = mockRes();
  await handleSsoBridge({ method: 'GET', headers: {} }, res);
  assert.equal(res.statusCode, 405);
  res = mockRes();
  await handleSsoBridge({ method: 'POST', headers: {} }, res);
  assert.equal(res.statusCode, 401);
});

test('always asks the Vault for target chat and returns only the token hash', async () => {
  const prevOrigin = process.env.VAULT_API_ORIGIN;
  const prevFetch = globalThis.fetch;
  process.env.VAULT_API_ORIGIN = 'https://vault.example.com';
  let seen;
  globalThis.fetch = async (url, init) => {
    seen = { url, init };
    return { ok: true, status: 200, json: async () => ({ ok: true, tokenHash: 'th123', type: 'magiclink', extra: 'x' }) };
  };
  try {
    const res = mockRes();
    await handleSsoBridge({ method: 'POST', headers: { authorization: `Bearer ${JWT}` }, body: { target: 'connect' } }, res);
    assert.equal(seen.url, 'https://vault.example.com/api/vault?resource=sso');
    assert.equal(JSON.parse(seen.init.body).target, 'chat');
    assert.deepEqual(res.body, { ok: true, tokenHash: 'th123' });
  } finally {
    process.env.VAULT_API_ORIGIN = prevOrigin;
    globalThis.fetch = prevFetch;
  }
});

test('falls back quietly when the Vault has no token', async () => {
  const prevOrigin = process.env.VAULT_API_ORIGIN;
  const prevFetch = globalThis.fetch;
  process.env.VAULT_API_ORIGIN = 'https://vault.example.com';
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ ok: false, code: 'no_email' }) });
  try {
    const res = mockRes();
    await handleSsoBridge({ method: 'POST', headers: { authorization: `Bearer ${JWT}` } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ok: false, code: 'no_email' });
  } finally {
    process.env.VAULT_API_ORIGIN = prevOrigin;
    globalThis.fetch = prevFetch;
  }
});
