import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleReportBridge, buildVaultReportUrl } from '../api/_utils/reportBridge.js';

const JWT = 'aaa.bbb.ccc';
const realFetch = globalThis.fetch;
function mkRes() {
  const r = { headers: {} };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}

describe('report bridge', () => {
  afterEach(() => { globalThis.fetch = realFetch; delete process.env.VAULT_API_ORIGIN; });

  it('POST only, signed-in only, known kinds only', async () => {
    let r = mkRes(); await handleReportBridge({ method: 'GET', headers: {} }, r); assert.equal(r.code, 405);
    r = mkRes(); await handleReportBridge({ method: 'POST', headers: {}, body: { kind: 'problem' } }, r); assert.equal(r.code, 401);
    r = mkRes(); await handleReportBridge({ method: 'POST', headers: { authorization: `Bearer ${JWT}` }, body: { kind: 'nope' } }, r); assert.equal(r.code, 400);
  });

  it('forwards to the fixed Vault path with sourceApp forced to connect', async () => {
    process.env.VAULT_API_ORIGIN = 'https://plcc-opal.vercel.app';
    let seen;
    globalThis.fetch = async (url, init) => { seen = { url, init }; return new Response(JSON.stringify({ ok: true }), { status: 200 }); };
    const r = mkRes();
    await handleReportBridge({ method: 'POST', headers: { authorization: `Bearer ${JWT}` }, body: { kind: 'safety', sourceApp: 'canaan', details: 'x' } }, r);
    assert.equal(r.code, 200);
    assert.equal(seen.url, 'https://plcc-opal.vercel.app/api/vault?resource=report');
    assert.equal(seen.init.headers.Authorization, `Bearer ${JWT}`);
    assert.equal(JSON.parse(seen.init.body).sourceApp, 'connect');
  });

  it('passes Vault validation messages through', async () => {
    process.env.VAULT_API_ORIGIN = 'https://plcc-opal.vercel.app';
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, error: 'Please describe the problem' }), { status: 400 });
    const r = mkRes();
    await handleReportBridge({ method: 'POST', headers: { authorization: `Bearer ${JWT}` }, body: { kind: 'problem' } }, r);
    assert.equal(r.code, 400);
    assert.equal(r.body.message, 'Please describe the problem');
  });

  it('is routed through vault-news (no new API function) and rewritten from /api/report', () => {
    assert.equal(buildVaultReportUrl('https://x.test/'), 'https://x.test/api/vault?resource=report');
    assert.match(readFileSync('api/vault-news.js', 'utf8'), /handleReportBridge/);
    const v = JSON.parse(readFileSync('vercel.json', 'utf8'));
    assert.ok(v.rewrites.some((rw) => rw.source === '/api/report' && rw.destination === '/api/vault-news?bridge=report'));
  });
});
