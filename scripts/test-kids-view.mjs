/**
 * Kids View + PLCC Bucks (read-only) — sanitize, bridge, route and scope tests.
 * Run: node --test scripts/test-kids-view.mjs
 */
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseKidsCardRef,
  parseKidsThemeBody,
  parseKidsViewResponse,
} from '../api/_utils/kidsViewSanitize.js';
import {
  buildVaultKidsThemeUrl,
  buildVaultKidsViewUrl,
  VAULT_KIDS_VIEW_PATH,
} from '../api/_utils/vaultOrigin.js';
import handler from '../api/family-huddle.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const CARD_REF = `AWCD.${'a1'.repeat(32)}`;
const CHILD_ID = '11111111-2222-4333-8444-555555555555';
const HOUSEHOLD_ID = '99999999-8888-4777-8666-555555555555';
const LEDGER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const UUID_ANY = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function vaultPayload(overrides = {}) {
  return {
    ok: true,
    child: { id: CHILD_ID, firstName: 'Mia', name: 'Mia Mahabir', age: 7, theme: 'adventure', householdId: HOUSEHOLD_ID },
    stats: { weekStreak: 3, totalCheckins: 12, lastCheckinAt: '2026-10-11T14:00:00Z', lifetimePoints: 140, pointsThisWeek: 20 },
    weeklyPoints: [{ weekStart: '2026-10-05', points: 20 }, { weekStart: '2026-10-12', points: 10 }],
    card: { qrPayload: `AWC1.${'b2'.repeat(32)}`, cardNumber: 'PLCC-2026-00042', memberId: CHILD_ID },
    bucks: {
      balance: 15,
      totalEarned: 20,
      memberId: CHILD_ID,
      history: [
        { id: LEDGER_ID, kind: 'award', amount: 5, reasonLabel: 'Memory verse', awardedBy: 'Sis. Jane', createdAt: '2026-10-12T15:00:00Z', reversed: false, awardedByUserId: CHILD_ID },
        { id: LEDGER_ID, kind: 'reversal', amount: -5, reasonLabel: CHILD_ID, awardedBy: 'Bro. Mark', createdAt: '2026-10-12T16:00:00Z', reversed: false },
      ],
    },
    badges: [
      { id: 'first-checkin', name: 'First Steps', description: 'Check in for the first time', category: 'checkins', tier: 'bronze', goal: 1, progress: 1, earned: true, earnedAt: '2026-01-04T14:00:00Z' },
      { id: 'bad badge id!', name: 'x', category: 'checkins', tier: 'bronze', goal: 1 },
    ],
    level: { level: 2, title: 'Explorer', points: 140, levelStart: 100, nextLevelAt: 250 },
    themeReady: true,
    householdId: HOUSEHOLD_ID,
    guardianUserId: CHILD_ID,
    ...overrides,
  };
}

describe('kidsViewSanitize', () => {
  it('keeps the Kids View fields and drops every UUID', () => {
    const parsed = parseKidsViewResponse(vaultPayload());
    assert.equal(parsed.ok, true);
    const v = parsed.view;
    assert.deepEqual(v.child, { firstName: 'Mia', name: 'Mia Mahabir', age: 7, theme: 'adventure' });
    assert.equal(v.stats.weekStreak, 3);
    assert.equal(v.weeklyPoints.length, 2);
    assert.deepEqual(v.card, { qrPayload: `AWC1.${'b2'.repeat(32)}`, cardNumber: 'PLCC-2026-00042' });
    assert.equal(v.bucks.balance, 15);
    assert.equal(v.bucks.onHold, 0);
    assert.equal(v.bucks.outstandingCorrection, 0);
    assert.deepEqual(v.bucks.requests, []);
    assert.equal(v.bucks.history.length, 2);
    assert.deepEqual(v.bucks.history.map((l) => l.id), ['b0', 'b1']);
    assert.equal(v.bucks.history[1].reasonLabel, 'PLCC Bucks');
    assert.equal(v.badges.length, 1);
    assert.equal(v.level.title, 'Explorer');
    assert.equal(v.themeReady, true);
    const json = JSON.stringify(v);
    assert.equal(UUID_ANY.test(json), false, 'no UUIDs reach Connect');
    assert.equal(/householdId|guardianUserId|memberId|awardedByUserId|"id":"1111/.test(json), false);
  });

  it('keeps prize requests and drops church cost and child ids', () => {
    const parsed = parseKidsViewResponse(vaultPayload({
      bucks: {
        balance: 50,
        totalEarned: 400,
        onHold: 400,
        outstandingCorrection: 20,
        unitCostCents: 300,
        childId: CHILD_ID,
        history: [
          { id: LEDGER_ID, kind: 'redemption', amount: -400, reasonLabel: 'Prize: Creative Art Kit', awardedBy: 'Sis. Jane', createdAt: '2026-10-12T17:00:00Z' },
          { id: LEDGER_ID, kind: 'recovery', amount: -20, reasonLabel: 'Earlier correction recovered', awardedBy: 'Sis. Jane', createdAt: '2026-10-12T18:00:00Z' },
          { id: LEDGER_ID, kind: 'secret', amount: 1, reasonLabel: 'Nope', awardedBy: 'X', createdAt: '2026-10-12T19:00:00Z' },
        ],
        requests: [
          { id: CHILD_ID, prizeId: 'art_kit', prizeName: 'Creative Art Kit', price: 400, status: 'approved', unitCostCents: 300, childId: CHILD_ID },
          { id: LEDGER_ID, prizeName: CHILD_ID, price: 50, status: 'requested' },
        ],
      },
    }));
    assert.equal(parsed.ok, true);
    const bucks = parsed.view.bucks;
    assert.equal(bucks.onHold, 400);
    assert.equal(bucks.outstandingCorrection, 20);
    assert.deepEqual(bucks.history.map((l) => l.kind), ['redemption', 'recovery']);
    assert.deepEqual(bucks.requests, [{ id: 'r0', prizeName: 'Creative Art Kit', price: 400, status: 'approved' }]);
    const json = JSON.stringify(bucks);
    assert.equal(UUID_ANY.test(json), false);
    assert.equal(json.includes('unitCost'), false);
    assert.equal(json.includes('childId'), false);
    assert.equal(json.includes('prizeId'), false);
  });

  it('omits the wallet when Vault has not run the Bucks migration', () => {
    const parsed = parseKidsViewResponse(vaultPayload({ bucks: null }));
    assert.equal(parsed.ok, true);
    assert.equal(parsed.view.bucks, null);
  });

  it('drops a malformed QR and fails closed on a missing child or level', () => {
    const badCard = parseKidsViewResponse(vaultPayload({ card: { qrPayload: CHILD_ID, cardNumber: 'x' } }));
    assert.equal(badCard.view.card, null);
    assert.equal(parseKidsViewResponse(vaultPayload({ child: null })).ok, false);
    assert.equal(parseKidsViewResponse(vaultPayload({ level: null })).ok, false);
    assert.equal(parseKidsViewResponse(null).ok, false);
    assert.equal(parseKidsViewResponse({ ok: false }).ok, false);
  });

  it('accepts only an exact AWCD cardRef', () => {
    assert.equal(parseKidsCardRef(CARD_REF), CARD_REF);
    assert.equal(parseKidsCardRef(CHILD_ID), null);
    assert.equal(parseKidsCardRef(`AWCD.${'A1'.repeat(32)}`), null);
    assert.equal(parseKidsCardRef(`${CARD_REF}&childId=${CHILD_ID}`), null);
  });

  it('theme body allows only cardRef + a known theme', () => {
    assert.deepEqual(parseKidsThemeBody({ cardRef: CARD_REF, kidsTheme: 'soft_garden' }), {
      ok: true,
      cardRef: CARD_REF,
      kidsTheme: 'soft_garden',
    });
    assert.equal(parseKidsThemeBody({ cardRef: CARD_REF, kidsTheme: 'neon' }).ok, false);
    assert.equal(parseKidsThemeBody({ cardRef: CARD_REF, kidsTheme: 'adventure', childId: CHILD_ID }).ok, false);
    assert.equal(parseKidsThemeBody({ cardRef: CARD_REF, kidsTheme: 'adventure', remove: true }).ok, false);
    assert.equal(parseKidsThemeBody({ childId: CHILD_ID, kidsTheme: 'adventure' }).ok, false);
  });
});

describe('Vault Kids View URLs', () => {
  it('uses fixed dependents paths keyed by cardRef, never childId', () => {
    const view = buildVaultKidsViewUrl('https://vault.example.com/', CARD_REF);
    assert.ok(view.startsWith(`https://vault.example.com${VAULT_KIDS_VIEW_PATH}`));
    assert.ok(view.endsWith(`&cardRef=${CARD_REF}`));
    assert.equal(view.includes('childId'), false);
    assert.equal(
      buildVaultKidsThemeUrl('https://vault.example.com'),
      'https://vault.example.com/api/vault?resource=family&subResource=dependents&action=kids-theme'
    );
  });
});

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

const BEARER = 'Bearer aaa.bbb.ccc';
const realFetch = globalThis.fetch;

describe('family-huddle kids bridge', () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('GET kids-view forwards Bearer + cardRef and returns the sanitized view', async () => {
    process.env.VAULT_API_ORIGIN = 'https://vault.example.com';
    const calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify(vaultPayload()), { status: 200 });
    };
    const res = mockRes();
    await handler({ method: 'GET', headers: { authorization: BEARER }, query: { resource: 'kids-view', cardRef: CARD_REF } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, buildVaultKidsViewUrl('https://vault.example.com', CARD_REF));
    assert.equal(calls[0].init.headers.Authorization, BEARER);
    assert.equal(res.body.ok, true);
    assert.equal(UUID_ANY.test(JSON.stringify(res.body)), false);
    assert.equal(res.headers['cache-control'], 'private, no-store');
  });

  it('rejects a bad cardRef or missing auth before calling Vault', async () => {
    process.env.VAULT_API_ORIGIN = 'https://vault.example.com';
    let called = false;
    globalThis.fetch = async () => {
      called = true;
      return new Response('{}');
    };
    const bad = mockRes();
    await handler({ method: 'GET', headers: { authorization: BEARER }, query: { resource: 'kids-view', cardRef: CHILD_ID } }, bad);
    assert.equal(bad.statusCode, 400);
    const anon = mockRes();
    await handler({ method: 'GET', headers: {}, query: { resource: 'kids-view', cardRef: CARD_REF } }, anon);
    assert.equal(anon.statusCode, 401);
    assert.equal(called, false);
  });

  it('POST kids-theme sends PATCH with only cardRef + kidsTheme', async () => {
    process.env.VAULT_API_ORIGIN = 'https://vault.example.com';
    const calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ ok: true, theme: 'adventure' }), { status: 200 });
    };
    const res = mockRes();
    await handler(
      { method: 'POST', headers: { authorization: BEARER }, query: { resource: 'kids-theme' }, body: { cardRef: CARD_REF, kidsTheme: 'adventure' } },
      res
    );
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ok: true, theme: 'adventure' });
    assert.equal(calls[0].init.method, 'PATCH');
    assert.deepEqual(JSON.parse(calls[0].init.body), { cardRef: CARD_REF, kidsTheme: 'adventure' });

    const extra = mockRes();
    await handler(
      { method: 'POST', headers: { authorization: BEARER }, query: { resource: 'kids-theme' }, body: { cardRef: CARD_REF, kidsTheme: 'adventure', firstName: 'X' } },
      extra
    );
    assert.equal(extra.statusCode, 400);
    assert.equal(calls.length, 1);
  });

  it('passes Vault household denial through as 403', async () => {
    process.env.VAULT_API_ORIGIN = 'https://vault.example.com';
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ ok: false, code: 'forbidden', error: 'That child is not in your household.' }), { status: 403 });
    const res = mockRes();
    await handler({ method: 'GET', headers: { authorization: BEARER }, query: { resource: 'kids-view', cardRef: CARD_REF } }, res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.ok, false);
  });
});

describe('Connect Kids View UI + scope', () => {
  it('routes /family/kids/:cardRef behind approved-member MemberGate', () => {
    const app = read('App.tsx');
    const i = app.indexOf('path="/family/kids/:cardRef"');
    assert.ok(i > 0);
    const block = app.slice(i, i + 400);
    assert.match(block, /MemberGate requireAccess="approved_member"/);
    assert.match(block, /MemberKidsViewPage/);
  });

  it('My Family links to Kids View only for guardian cardRef rows', () => {
    const card = read('components/family/FamilyMemberCard.tsx');
    assert.match(card, /to=\{`\/family\/kids\/\$\{cardRef\}`\}/);
    assert.match(card, /showChildCardAction =\s*variant === 'dependent' && cardAccess === 'guardian' && isDependentCardRef\(cardRef\)/);
  });

  it('client and page select by cardRef and never send childId', () => {
    const client = read('lib/kidsViewClient.ts');
    const page = read('pages/MemberKidsView.tsx');
    assert.match(client, /resource=kids-view&cardRef=/);
    assert.match(client, /resource=kids-theme/);
    for (const src of [client, page]) {
      assert.equal(/childId|child\.id|\/api\/vault/.test(src), false);
    }
    assert.match(page, /BucksWalletCard wallet=\{bucks\}/);
    assert.match(page, /\{bucks \? </);
  });

  it('has no PLCC Bucks award, reverse, or admin surface on Connect', () => {
    const scan = ['api', 'api/_utils', 'lib', 'pages', 'components/kids', 'components/family'];
    for (const dir of scan) {
      for (const f of readdirSync(join(root, dir))) {
        if (!/\.(js|ts|tsx)$/.test(f)) continue;
        const src = read(`${dir}/${f}`);
        assert.equal(/kids-bucks|awc_bucks_award|awc_bucks_reverse|resource=kids-bucks/.test(src), false, `${dir}/${f}`);
      }
    }
    assert.equal(existsSync(join(root, 'pages/KidsBucks.tsx')), false);
    const wallet = read('components/kids/BucksWalletCard.tsx');
    assert.equal(/<button|onClick|fetch\(/.test(wallet), false, 'wallet is read-only');
  });

  it('stays on the Hobby function budget (no new api/*.js)', () => {
    const fns = readdirSync(join(root, 'api')).filter((f) => f.endsWith('.js'));
    assert.ok(fns.length <= 15, `api/*.js count ${fns.length}`);
    assert.equal(fns.includes('kids-view.js'), false);
  });
});
