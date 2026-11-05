/**
 * Prayer Wall submit — what Connect forwards to the Vault.
 * Run: node --test scripts/test-prayer-submit.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parsePrayerSubmit,
  parseVaultPrayerResponse,
  PRAYER_MAX_CHARS,
} from '../api/_utils/prayerSubmitSanitize.js';
import { buildVaultPrayerUrl, VAULT_PRAYER_PATH } from '../api/_utils/vaultOrigin.js';

describe('parsePrayerSubmit', () => {
  it('member: sends content, private and anonymous flags only', () => {
    const r = parsePrayerSubmit({ content: '  Pray for my mom ', is_anonymous: true }, { signedIn: true });
    assert.equal(r.ok, true);
    assert.deepEqual(r.payload, { content: 'Pray for my mom', is_confidential: false, is_anonymous: true });
  });

  it('member: name from the form is not accepted (Vault uses the sign-in name)', () => {
    const r = parsePrayerSubmit({ content: 'x', member_name: 'Pastor' }, { signedIn: true });
    assert.equal(r.ok, true);
    assert.equal('member_name' in r.payload, false);
  });

  it('visitor: needs a name', () => {
    assert.deepEqual(parsePrayerSubmit({ content: 'x' }, { signedIn: false }), { ok: false, reason: 'missing_name' });
    const r = parsePrayerSubmit({ content: 'x', member_name: ' Vic ', is_confidential: true }, { signedIn: false });
    assert.deepEqual(r.payload, { content: 'x', is_confidential: true, member_name: 'Vic' });
  });

  it('refuses status, user id and other extra fields', () => {
    for (const extra of ['status', 'user_id', 'prayed_count', 'agreements']) {
      assert.equal(parsePrayerSubmit({ content: 'x', [extra]: 'Published' }, { signedIn: true }).ok, false, extra);
    }
  });

  it('refuses empty, too long and bot-filled requests', () => {
    assert.equal(parsePrayerSubmit({ content: '   ' }, { signedIn: true }).reason, 'empty_content');
    assert.equal(parsePrayerSubmit({ content: 'a'.repeat(PRAYER_MAX_CHARS + 1) }, { signedIn: true }).reason, 'content_too_long');
    assert.equal(parsePrayerSubmit({ content: 'x', website: 'spam.example' }, { signedIn: true }).ok, false);
    assert.equal(parsePrayerSubmit(null, { signedIn: true }).ok, false);
    assert.equal(parsePrayerSubmit([], { signedIn: true }).ok, false);
  });

  it('three choices: wall, intercessors, pastor', () => {
    assert.deepEqual(parsePrayerSubmit({ content: 'x', share_with: 'intercessors' }, { signedIn: true }).payload, {
      content: 'x', is_confidential: true, share_with: 'intercessors', is_anonymous: false,
    });
    assert.equal(parsePrayerSubmit({ content: 'x', share_with: 'wall', is_confidential: true }, { signedIn: true }).payload.is_confidential, false);
    assert.equal(parsePrayerSubmit({ content: 'x', share_with: 'pastor' }, { signedIn: true }).payload.is_confidential, true);
    assert.equal(parsePrayerSubmit({ content: 'x', share_with: 'everyone' }, { signedIn: true }).ok, false);
  });

  it('only true counts as private', () => {
    assert.equal(parsePrayerSubmit({ content: 'x', is_confidential: 'yes' }, { signedIn: true }).payload.is_confidential, false);
  });
});

describe('parseVaultPrayerResponse', () => {
  it('returns only a known status', () => {
    assert.equal(parseVaultPrayerResponse({ id: '1', status: 'Published', content: 'secret' }), 'Published');
    assert.equal(parseVaultPrayerResponse({ status: 'Vetting' }), 'Vetting');
    assert.equal(parseVaultPrayerResponse({ status: 'Archived' }), null);
    assert.equal(parseVaultPrayerResponse(null), null);
  });
});

describe('Vault URL and form', () => {
  it('uses the fixed Vault prayer path', () => {
    assert.equal(buildVaultPrayerUrl('https://vault.example/'), `https://vault.example${VAULT_PRAYER_PATH}`);
  });

  it('/api/prayer rides on the vault-news function (Hobby function budget)', () => {
    const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
    const rule = vercel.rewrites.find((r) => r.source === '/api/prayer');
    assert.equal(rule?.destination, '/api/vault-news?bridge=prayer');
    const catchAll = vercel.rewrites.findIndex((r) => r.source === '/api/(.*)');
    assert.ok(vercel.rewrites.indexOf(rule) < catchAll, 'prayer rewrite comes before the catch-all');
    const fn = readFileSync(new URL('../api/vault-news.js', import.meta.url), 'utf8');
    assert.match(fn, /handlePrayerBridge/);
  });

  it('form no longer writes to the database directly or fakes success', () => {
    const src = readFileSync(new URL('../components/PrayerModule.tsx', import.meta.url), 'utf8');
    assert.equal(src.includes("from('prayer_requests')"), false);
    assert.equal(src.includes('submitPrayer('), true);
    assert.match(src, /role="alert"/);
  });
});
