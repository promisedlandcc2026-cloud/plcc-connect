// Pastor's Office: members give a phone/email the office can use.
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import handler from '../api/pastoral-requests.js';
const priorFetch = globalThis.fetch; const priorOrigin = process.env.VAULT_API_ORIGIN; process.env.VAULT_API_ORIGIN = 'https://vault.example';
after(() => { globalThis.fetch = priorFetch; if (priorOrigin === undefined) delete process.env.VAULT_API_ORIGIN; else process.env.VAULT_API_ORIGIN = priorOrigin; });
function res() { return { statusCode: 0, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(v) { this.body = v; return this; } }; }

describe('pastoral request contact details', () => {
  it('the bridge forwards the phone and email to Canaan', async () => {
    let sent;
    globalThis.fetch = async (_url, init) => { sent = JSON.parse(init.body); return { ok: true, status: 200, json: async () => ({ ok: true, requestId: 'id' }) }; };
    const r = res();
    await handler({ method: 'POST', headers: { authorization: 'Bearer a.b.c' }, body: { action: 'submit', officeId: 'o', category: 'appointment', preferredStart: '2027-01-01T07:00Z', timeZone: 'Africa/Kampala', contactPreference: 'phone', contactPhone: '0772 123456', contactEmail: 'me@example.com' } }, r);
    assert.equal(r.statusCode, 200);
    assert.equal(sent.contactPhone, '0772 123456');
    assert.equal(sent.contactEmail, 'me@example.com');
  });
  it('the form asks for phone and email and needs at least one', () => {
    const src = readFileSync(new URL('../pages/PastoralRequests.tsx', import.meta.url), 'utf8');
    assert.match(src, /type="tel"/);
    assert.match(src, /type="email"/);
    assert.match(src, /Please give a phone number or email/);
  });
});
