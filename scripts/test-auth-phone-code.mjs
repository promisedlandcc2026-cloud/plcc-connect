/**
 * /api/auth-phone bridge: text-code actions go to the Vault's fixed
 * resource=auth-phone-code path with only the expected fields.
 * Run: node --test scripts/test-auth-phone-code.mjs
 */
import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';

process.env.VAULT_API_ORIGIN = 'https://plcc-opal.vercel.app';
const { default: handler } = await import('../api/auth-phone.js');

function mockRes() {
  const out = { statusCode: 200, body: null, headers: {} };
  out.setHeader = (k, v) => { out.headers[k] = v; };
  out.status = (c) => { out.statusCode = c; return out; };
  out.json = (b) => { out.body = b; return out; };
  return out;
}

describe('auth-phone bridge — text codes', () => {
  let calls;
  let reply;
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    calls = [];
    reply = { status: 200, body: { ok: true, message: 'If an account uses this number, a 6-digit code is on its way by text.' } };
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(init.body), headers: init.headers || {} });
      return new Response(JSON.stringify(reply.body), { status: reply.status });
    };
  });
  afterEach(() => { globalThis.fetch = realFetch; });

  const post = async (body) => {
    const res = mockRes();
    await handler({ method: 'POST', headers: { 'content-type': 'application/json' }, body }, res);
    return res;
  };

  it('code-request → Vault auth-phone-code request, returns the message only', async () => {
    const res = await post({ action: 'code-request', purpose: 'signin', phone: '+15085551234', password: 'ignored', host: 'evil.example' });
    assert.equal(res.statusCode, 200);
    assert.equal(calls[0].url, 'https://plcc-opal.vercel.app/api/vault?resource=auth-phone-code');
    assert.deepEqual(calls[0].body, { action: 'request', purpose: 'signin', phone: '+15085551234' });
    assert.equal(res.body.ok, true);
    assert.match(res.body.message, /code/);
    assert.equal(res.body.access_token, undefined);
  });

  it('code-verify (signup) passes names and returns the session', async () => {
    reply = { status: 200, body: { ok: true, access_token: 'at', refresh_token: 'rt', expires_in: 3600 } };
    const res = await post({
      action: 'code-verify', purpose: 'signup', phone: '+16175550199', code: '123456',
      first_name: 'Ruth', last_name: 'Ama', email: '',
    });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(calls[0].body, {
      action: 'verify', purpose: 'signup', phone: '+16175550199', code: '123456',
      first_name: 'Ruth', last_name: 'Ama', email: '',
    });
    assert.equal(res.body.access_token, 'at');
  });

  it('code-verify (signin) sends no name fields', async () => {
    reply = { status: 200, body: { ok: true, access_token: 'at', refresh_token: 'rt' } };
    await post({ action: 'code-verify', phone: '+15085551234', code: '123456', first_name: 'X' });
    assert.deepEqual(calls[0].body, { action: 'verify', purpose: 'signin', phone: '+15085551234', code: '123456' });
  });

  it('passes Vault errors through (wrong code)', async () => {
    reply = { status: 401, body: { error: 'That code did not work. Check it, or request a new code.' } };
    const res = await post({ action: 'code-verify', phone: '+15085551234', code: '000000' });
    assert.equal(res.statusCode, 401);
    assert.match(res.body.message, /code did not work/);
  });

  it('password actions still use the original path', async () => {
    reply = { status: 200, body: { ok: true, access_token: 'at', refresh_token: 'rt' } };
    await post({ action: 'signin', phone: '+15085551234', password: 'secret1' });
    assert.equal(calls[0].url, 'https://plcc-opal.vercel.app/api/vault?resource=auth-phone');
  });

  it('rejects unknown actions without calling the Vault', async () => {
    const res = await post({ action: 'code-anything', phone: '+15085551234' });
    assert.equal(res.statusCode, 400);
    assert.equal(calls.length, 0);
  });
});

describe('auth-phone bridge — turning text sign-in on (signed in)', () => {
  let calls;
  const realFetch = globalThis.fetch;
  beforeEach(() => {
    calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(init.body), headers: init.headers || {} });
      return new Response(JSON.stringify({ ok: true, enabled: true, phone: '(•••) •••-1234', message: 'Text sign-in is on.', access_token: 'never-passed' }), { status: 200 });
    };
  });
  afterEach(() => { globalThis.fetch = realFetch; });
  const TOKEN = 'Bearer eyJhbGciOiJIUzI1NiJ9.member.token-abcdef';
  const post = async (body, auth) => {
    const res = mockRes();
    const headers = { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) };
    await handler({ method: 'POST', headers, body }, res);
    return res;
  };

  it('needs the member to be signed in', async () => {
    const r = await post({ action: 'link-request', phone: '5085551234' });
    assert.equal(r.statusCode, 401);
    assert.equal(calls.length, 0);
  });

  it('passes the member token and only phone/code to the Vault', async () => {
    const r = await post({ action: 'link-verify', phone: '5085551234', code: '123456', purpose: 'x', password: 'nope' }, TOKEN);
    assert.equal(r.statusCode, 200);
    assert.match(calls[0].url, /resource=auth-phone-code/);
    assert.equal(calls[0].headers.Authorization, TOKEN);
    assert.deepEqual(calls[0].body, { action: 'link-verify', phone: '5085551234', code: '123456' });
    assert.equal(r.body.enabled, true);
    assert.equal(r.body.phone, '(•••) •••-1234');
    assert.equal(r.body.access_token, undefined, 'never hands out a session');
  });

  it('status sends no phone', async () => {
    await post({ action: 'link-status', phone: '5085551234' }, TOKEN);
    assert.deepEqual(calls[0].body, { action: 'link-status' });
  });
});
