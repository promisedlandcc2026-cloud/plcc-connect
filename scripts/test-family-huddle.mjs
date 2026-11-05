/**
 * Family Huddle — sanitize / URL / Hobby consolidate contract tests.
 * Run: node --test scripts/test-family-huddle.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseFamilyHuddleEndResponse,
  parseFamilyHuddleStatusResponse,
  parseFamilyHuddleTokenResponse,
  parseFamilyInviteCreateResponse,
  parseGuestRedeemBody,
} from '../api/_utils/familyHuddleSanitize.js';
import {
  buildVaultFamilyHuddleUrl,
  VAULT_FAMILY_HUDDLE_BASE,
} from '../api/_utils/vaultOrigin.js';
import { parseLatestEntry } from '../api/family-huddle.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('Vault Family Huddle URLs', () => {
  it('builds resource=family huddle URLs without client householdId', () => {
    const status = buildVaultFamilyHuddleUrl('https://vault.example.com/', 'status');
    assert.ok(status.includes(VAULT_FAMILY_HUDDLE_BASE));
    assert.ok(status.includes('huddleType=status'));
    assert.equal(status.includes('householdId'), false);

    const redeem = buildVaultFamilyHuddleUrl('https://vault.example.com', 'invite-redeem');
    assert.ok(redeem.includes('huddleType=invite-redeem'));
  });
});

describe('familyHuddleSanitize', () => {
  it('parses status and strips secrets', () => {
    const parsed = parseFamilyHuddleStatusResponse({
      ok: true,
      live: true,
      participantCount: 3,
      householdName: 'Mahabir',
      householdId: 'should-not-leak',
      LIVEKIT_API_SECRET: 'x',
    });
    assert.equal(parsed.ok, true);
    assert.equal(parsed.live, true);
    assert.equal(parsed.participantCount, 3);
    assert.equal(parsed.householdName, 'Mahabir');
    assert.equal('householdId' in parsed, false);
  });

  it('accepts token payloads and rejects secret-looking tokens', () => {
    const good = parseFamilyHuddleTokenResponse({
      ok: true,
      token: 'eyJhbGciOiJIUzI1NiJ9.payload.sig',
      url: 'wss://livekit.example.com',
      roomName: 'awc-family-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      expiresIn: 3600,
      canModerate: true,
      householdId: 'leak',
    });
    assert.equal(good.ok, true);
    assert.equal(good.token.canModerate, true);
    assert.equal('householdId' in good.token, false);

    const bad = parseFamilyHuddleTokenResponse({
      ok: true,
      token: 'LIVEKIT_API_SECRET=abc',
      url: 'wss://livekit.example.com',
      roomName: 'awc-family-x',
    });
    assert.equal(bad.ok, false);
  });

  it('invite create requires relative join path; never returns token_hash', () => {
    const ok = parseFamilyInviteCreateResponse({
      ok: true,
      code: 'abc123',
      path: '/family/huddle/join?code=abc123',
      expiresAt: '2099-01-01T00:00:00.000Z',
      maxUses: 10,
      token_hash: 'should-strip',
    });
    assert.equal(ok.ok, true);
    assert.equal(ok.code, 'abc123');
    assert.equal('token_hash' in ok, false);

    const abs = parseFamilyInviteCreateResponse({
      ok: true,
      code: 'x',
      path: 'https://evil.example/family/huddle/join?code=x',
    });
    assert.equal(abs.ok, false);
  });

  it('guest redeem body caps displayName and requires token', () => {
    assert.equal(parseGuestRedeemBody({ token: 'c', displayName: 'Pat' }).ok, true);
    assert.equal(
      parseGuestRedeemBody({ token: 'c', displayName: 'x'.repeat(41) }).ok,
      false
    );
    assert.equal(parseGuestRedeemBody({ displayName: 'Pat' }).ok, false);
  });

  it('parses end response', () => {
    assert.equal(parseFamilyHuddleEndResponse({ ok: true, ended: true }).ended, true);
  });
});

describe('Hobby consolidate + YouTube', () => {
  it('keeps YouTube folded into family-huddle (no latest-youtube.js)', () => {
    assert.equal(existsSync(join(root, 'api/latest-youtube.js')), false);
    assert.ok(existsSync(join(root, 'api/family-huddle.js')));
    const vercel = read('vercel.json');
    assert.ok(vercel.includes('/api/latest-youtube'));
    assert.ok(vercel.includes('resource=youtube'));
  });

  it('parseLatestEntry returns title from Atom entry', () => {
    const xml = `<?xml version="1.0"?>
      <feed><entry>
        <yt:videoId>vid123</yt:videoId>
        <title>Be Strong &amp; Courageous</title>
        <published>2026-01-01T00:00:00Z</published>
      </entry></feed>`;
    const latest = parseLatestEntry(xml);
    assert.equal(latest.videoId, 'vid123');
    assert.equal(latest.title, 'Be Strong & Courageous');
  });

  it('family-huddle bridge never forwards client householdId', () => {
    const src = read('api/family-huddle.js');
    assert.equal(src.includes('householdId'), false);
    assert.ok(src.includes('invite-redeem'));
    assert.ok(src.includes('resource=youtube') || src.includes("'youtube'"));
  });
});

describe('UI + routing', () => {
  it('My Family mounts FamilyVoiceHuddle and live CTAs', () => {
    const page = read('pages/MemberFamily.tsx');
    assert.ok(page.includes('FamilyVoiceHuddle'));
    assert.ok(page.includes('Start Family Huddle'));
    assert.ok(page.includes('Share invite link'));
    assert.ok(page.includes('fetchFamilyHuddleStatus'));
    const overlay = read('components/family/FamilyVoiceHuddle.tsx');
    assert.ok(overlay.includes('Hands raised'));
    assert.ok(overlay.includes('HuddlePeoplePanel'));
    assert.ok(overlay.includes('HuddleMobileTabs'));
    assert.ok(overlay.includes('HuddleChatPanel'));
  });

  it('guest join page is public and redeems displayName', () => {
    const join = read('pages/FamilyHuddleJoin.tsx');
    assert.ok(join.includes('redeemFamilyHuddleInvite'));
    assert.ok(join.includes('You were invited by a family'));
    const app = read('App.tsx');
    assert.ok(app.includes('path="/family/huddle/join"'));
    assert.equal(
      /path="\/family\/huddle\/join"[\s\S]*?MemberGate/.test(app.split('path="/family/huddle/join"')[1].slice(0, 400)),
      false
    );
  });

  it('member shell excludes guest join from MemberNav', () => {
    const shell = read('lib/memberShell.ts');
    assert.ok(shell.includes('isFamilyHuddleGuestJoinPath'));
    assert.ok(shell.includes("pathname === '/family/huddle/join'"));
  });
});
