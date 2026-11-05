/**
 * Check-in points + member pass + seasonal theme — bridge and UI contracts.
 * Run: node --test scripts/test-checkin-points.mjs
 */
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import {
  mapPointsUpstreamError,
  parseLeaderboardResponse,
  parseMemberPassResponse,
  parseMyPointsResponse,
  parsePointsPrefsCommand,
  parsePointsResource,
  parseSelfCheckinCommand,
  parseSelfCheckinResponse,
  parseSystemSettingsSeasonal,
  sanitizeSeasonalSettings,
} from '../api/_utils/checkinPointsSanitize.js';
import {
  buildVaultMemberPassUrl,
  buildVaultPointsUrl,
  buildVaultSystemSettingsUrl,
} from '../api/_utils/vaultOrigin.js';
import vaultNewsHandler from '../api/vault-news.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const ORIGIN = 'https://plcc-opal.vercel.app';
const JWT = 'aaa.bbb.ccc';
const PASS = `AWC1.${'ab'.repeat(32)}`;
const SEASON = { key: '2026-fall', label: 'Fall 2026', emoji: '🍂' };

// ---------------------------------------------------------------------------
// Fixed Vault URLs
// ---------------------------------------------------------------------------

describe('vault urls', () => {
  it('uses fixed member-side points routes only', () => {
    assert.equal(
      buildVaultPointsUrl(ORIGIN, 'my-points'),
      `${ORIGIN}/api/vault?resource=attendance&subResource=my-points`
    );
    assert.equal(
      buildVaultPointsUrl(ORIGIN, 'points-leaderboard'),
      `${ORIGIN}/api/vault?resource=attendance&subResource=points-leaderboard`
    );
    assert.throws(() => buildVaultPointsUrl(ORIGIN, 'self-qr'));
    assert.throws(() => buildVaultPointsUrl(ORIGIN, 'my-points&x=1'));
  });

  it('member pass never carries a memberId; settings asks for system scope', () => {
    assert.equal(buildVaultMemberPassUrl(ORIGIN), `${ORIGIN}/api/vault?resource=people&subResource=member-pass`);
    assert.equal(buildVaultMemberPassUrl(ORIGIN).includes('memberId'), false);
    assert.equal(buildVaultSystemSettingsUrl(ORIGIN), `${ORIGIN}/api/vault?resource=settings&scope=system`);
  });
});

// ---------------------------------------------------------------------------
// Sanitizers
// ---------------------------------------------------------------------------

describe('sanitizers', () => {
  it('resource whitelist excludes leader routes', () => {
    assert.equal(parsePointsResource('my-points'), 'my-points');
    assert.equal(parsePointsResource('LEADERBOARD'), 'leaderboard');
    assert.equal(parsePointsResource('self-qr'), '');
    assert.equal(parsePointsResource(''), '');
  });

  it('member pass keeps only the AWC1 token and backup code', () => {
    const r = parseMemberPassResponse({ ok: true, memberId: 'secret-id', qrPayload: PASS, accessCode: '12345678' });
    assert.deepEqual(r, { ok: true, qrPayload: PASS, accessCode: '12345678' });
    assert.equal(parseMemberPassResponse({ ok: true, qrPayload: 'AWCQ1.x', accessCode: '1' }).ok, false);
    assert.equal(parseMemberPassResponse({ ok: true, qrPayload: PASS, accessCode: 'abc' }).accessCode, null);
  });

  it('my points drops summary/history when not linked and caps history', () => {
    const notLinked = parseMyPointsResponse({ ok: true, linked: false, season: SEASON, summary: { seasonPoints: 5 }, history: [{}] });
    assert.equal(notLinked.ok, true);
    assert.equal(notLinked.summary, null);
    assert.deepEqual(notLinked.history, []);

    const history = Array.from({ length: 30 }, (_, i) => ({
      label: 'Checked in',
      reason: 'checkin',
      points: 10,
      sessionTitle: `Sunday ${i}`,
      at: '2026-10-11T14:00:00Z',
      memberId: 'nope',
    }));
    const linked = parseMyPointsResponse({
      ok: true,
      linked: true,
      season: SEASON,
      summary: { seasonPoints: 40, lifetimePoints: 90, checkins: 4, showOnLeaderboard: true, rank: 3 },
      history,
    });
    assert.equal(linked.history.length, 15);
    assert.equal('memberId' in linked.history[0], false);
    assert.equal(linked.summary.rank, 3);
    assert.equal(parseMyPointsResponse({ ok: true, season: { key: 'bad' } }).ok, false);
  });

  it('leaderboard keeps rank/name/points/isMe only and caps at 10', () => {
    const leaders = Array.from({ length: 12 }, (_, i) => ({
      rank: i + 1,
      name: 'Jane D.',
      points: 100 - i,
      isMe: i === 2,
      member_id: 'uuid',
      email: 'x@y.z',
    }));
    const r = parseLeaderboardResponse({ ok: true, season: SEASON, leaders, me: { points: 98, rank: 3, showOnLeaderboard: true } });
    assert.equal(r.leaders.length, 10);
    assert.deepEqual(Object.keys(r.leaders[0]).sort(), ['isMe', 'name', 'points', 'rank']);
    assert.equal(r.leaders[2].isMe, true);
    assert.equal(r.me.rank, 3);
  });

  it('self check-in result recomputes pointsEarned from awards', () => {
    const r = parseSelfCheckinResponse({
      ok: true,
      alreadyCheckedIn: false,
      sessionTitle: 'Sunday Worship',
      pointsEnabled: true,
      awards: [
        { reason: 'checkin', label: 'Checked in', points: 10, note: null },
        { reason: 'on_time', label: 'On time', points: 5, note: null },
        { reason: 'zero', label: 'Zero', points: 0 },
      ],
      pointsEarned: 9999,
      season: SEASON,
      summary: null,
    });
    assert.equal(r.pointsEarned, 15);
    assert.equal(r.awards.length, 2);
  });

  it('commands reject extra keys and bad types', () => {
    assert.deepEqual(parseSelfCheckinCommand({ code: ' AWCQ1.x ' }), { ok: true, code: 'AWCQ1.x' });
    assert.equal(parseSelfCheckinCommand({ code: 'x', sessionId: 'y' }).ok, false);
    assert.equal(parseSelfCheckinCommand({ code: 'x'.repeat(601) }).ok, false);
    assert.equal(parseSelfCheckinCommand({ code: 5 }).ok, false);
    assert.deepEqual(parsePointsPrefsCommand({ showOnLeaderboard: false }), { ok: true, showOnLeaderboard: false });
    assert.equal(parsePointsPrefsCommand({ showOnLeaderboard: 'no' }).ok, false);
    assert.equal(parsePointsPrefsCommand({ showOnLeaderboard: true, memberId: 'x' }).ok, false);
  });

  it('seasonal setting matches Vault rules and strips other system settings', () => {
    assert.deepEqual(sanitizeSeasonalSettings({}), {
      mode: 'automatic',
      effects: true,
      anniversaryMonth: null,
      anniversaryDay: null,
    });
    assert.equal(sanitizeSeasonalSettings({ mode: 'hacker' }).mode, 'automatic');
    assert.equal(sanitizeSeasonalSettings({ mode: 'off', effects: false }).effects, false);
    const parsed = parseSystemSettingsSeasonal({
      ok: true,
      settings: {
        security: { mfa: true },
        seasonal: { mode: 'christmas', effects: true, anniversaryMonth: 6, anniversaryDay: 14 },
      },
    });
    assert.deepEqual(parsed, {
      ok: true,
      seasonal: { mode: 'christmas', effects: true, anniversaryMonth: 6, anniversaryDay: 14 },
    });
  });

  it('upstream errors pass Vault friendly copy only for known codes', () => {
    const known = mapPointsUpstreamError(410, { code: 'code_expired', error: 'That code just changed. Scan the screen again.' }, 'x');
    assert.deepEqual(known, { status: 410, code: 'code_expired', message: 'That code just changed. Scan the screen again.' });
    const unknown = mapPointsUpstreamError(500, { code: 'points_error', error: 'stack trace here' }, 'Fallback');
    assert.deepEqual(unknown, { status: 502, code: 'vault_unavailable', message: 'Fallback' });
    assert.equal(mapPointsUpstreamError(401, {}, 'x').code, 'unauthorized');
  });
});

// ---------------------------------------------------------------------------
// Bridge handler (mocked Vault)
// ---------------------------------------------------------------------------

function mockRes() {
  const res = { statusCode: 0, headers: {}, body: undefined };
  res.setHeader = (k, v) => {
    res.headers[k.toLowerCase()] = v;
  };
  res.status = (code) => {
    res.statusCode = code;
    return { json: (b) => (res.body = b) };
  };
  return res;
}

describe('bridge handler', () => {
  const realFetch = globalThis.fetch;
  let calls;
  let reply;

  beforeEach(() => {
    process.env.VAULT_API_ORIGIN = ORIGIN;
    calls = [];
    reply = { status: 200, body: { ok: true } };
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return {
        ok: reply.status >= 200 && reply.status < 300,
        status: reply.status,
        json: async () => reply.body,
      };
    };
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  const run = async (query, opts = {}) => {
    const { method = 'GET', body } = opts;
    const auth = 'auth' in opts ? opts.auth : `Bearer ${JWT}`;
    const res = mockRes();
    await vaultNewsHandler(
      { method, query: { bridge: 'points', ...query }, headers: { authorization: auth }, body },
      res
    );
    return res;
  };

  it('forwards the member token to the fixed my-points route and sanitizes', async () => {
    reply.body = { ok: true, linked: true, season: SEASON, summary: { seasonPoints: 20 }, history: [] };
    const res = await run({ resource: 'my-points' });
    assert.equal(res.statusCode, 200);
    assert.equal(calls[0].url, `${ORIGIN}/api/vault?resource=attendance&subResource=my-points`);
    assert.equal(calls[0].init.headers.Authorization, `Bearer ${JWT}`);
    assert.equal(calls[0].init.redirect, 'error');
    assert.equal(res.body.summary.seasonPoints, 20);
    assert.match(res.headers['cache-control'], /no-store/);
  });

  it('requires sign-in for points and the pass', async () => {
    const res = await run({ resource: 'member-pass' }, { auth: undefined });
    assert.equal(res.statusCode, 401);
    assert.equal(calls.length, 0);
  });

  it('member pass returns only qrPayload + accessCode', async () => {
    reply.body = { ok: true, memberId: 'm-1', qrPayload: PASS, accessCode: '12345678' };
    const res = await run({ resource: 'member-pass' });
    assert.deepEqual(res.body, { ok: true, qrPayload: PASS, accessCode: '12345678' });
  });

  it('self check-in posts only { code } and relays Vault messages', async () => {
    reply = { status: 410, body: { ok: false, code: 'code_expired', error: 'That code just changed. Scan the screen again.' } };
    const res = await run({ resource: 'self-check-in' }, { method: 'POST', body: { code: 'AWCQ1.abc' } });
    assert.equal(calls[0].init.method, 'POST');
    assert.deepEqual(JSON.parse(calls[0].init.body), { code: 'AWCQ1.abc' });
    assert.equal(res.statusCode, 410);
    assert.equal(res.body.code, 'code_expired');
  });

  it('rejects wrong methods and leader routes without calling Vault', async () => {
    assert.equal((await run({ resource: 'self-check-in' })).statusCode, 405);
    assert.equal((await run({ resource: 'leaderboard' }, { method: 'POST', body: {} })).statusCode, 405);
    assert.equal((await run({ resource: 'self-qr' })).statusCode, 404);
    assert.equal(calls.length, 0);
  });

  it('season is always 200: defaults for visitors, church setting when signed in', async () => {
    const visitor = await run({ resource: 'season' }, { auth: undefined });
    assert.equal(visitor.statusCode, 200);
    assert.equal(visitor.body.source, 'default');
    assert.equal(calls.length, 0);

    reply.body = { ok: true, settings: { seasonal: { mode: 'off', effects: false }, integrations: { key: 'x' } } };
    const member = await run({ resource: 'season' });
    assert.deepEqual(member.body, {
      ok: true,
      source: 'church',
      seasonal: { mode: 'off', effects: false, anniversaryMonth: null, anniversaryDay: null },
    });

    reply = { status: 500, body: null };
    const down = await run({ resource: 'season' });
    assert.equal(down.statusCode, 200);
    assert.equal(down.body.source, 'default');
  });
});

// ---------------------------------------------------------------------------
// Season logic parity with Vault (bundled from the mirrored TS)
// ---------------------------------------------------------------------------

async function loadSeasons() {
  const out = await build({
    entryPoints: [join(root, 'lib/seasons/index.ts')],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
  });
  const code = out.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}

describe('seasons', () => {
  it('seasons, holidays and effects match the Vault calendar', async () => {
    const s = await loadSeasons();
    const at = (y, m, d) => s.dateOnNyDay(y, m, d);
    // Uganda: two rainy seasons (Mar–May, Sep–Nov), dry otherwise; no US Thanksgiving.
    assert.equal(s.getActiveTheme(at(2026, 10, 15)).id, 'rainy');
    assert.equal(s.getActiveTheme(at(2026, 11, 26)).id, 'rainy');
    assert.equal(s.getActiveTheme(at(2026, 12, 20)).id, 'christmas');
    assert.equal(s.getActiveTheme(at(2027, 1, 1)).id, 'new_year');
    assert.equal(s.getActiveTheme(at(2027, 1, 15)).id, 'dry');
    // Easter 2027 is Mar 28 → Palm Sunday Mar 21 through Mar 29
    assert.equal(s.getActiveTheme(at(2027, 3, 21)).id, 'easter');
    assert.equal(s.getActiveTheme(at(2027, 4, 10)).id, 'rainy');
    assert.equal(s.getActiveTheme(at(2027, 7, 4)).effect, 'sun');
    assert.notEqual(s.getActiveTheme(at(2026, 10, 15)).effect, 'leaves');
    assert.equal(s.getActiveTheme(at(2026, 10, 15), { mode: 'off' }).id, 'brand');
    assert.equal(s.getActiveTheme(at(2026, 10, 15), { mode: 'winter' }).id, 'winter');
    assert.equal(
      s.getActiveTheme(at(2026, 6, 14), { anniversaryMonth: 6, anniversaryDay: 14 }).id,
      'anniversary'
    );
  });
});

// ---------------------------------------------------------------------------
// Source contracts
// ---------------------------------------------------------------------------

describe('source contracts', () => {
  it('bridge rides on vault-news (no new serverless function)', () => {
    const vercel = JSON.parse(read('vercel.json'));
    const rule = vercel.rewrites.find((r) => r.source === '/api/checkin-points');
    assert.ok(rule);
    assert.equal(rule.destination, '/api/vault-news?bridge=points');
    const idxRule = vercel.rewrites.findIndex((r) => r.source === '/api/checkin-points');
    const idxCatch = vercel.rewrites.findIndex((r) => r.source === '/api/(.*)');
    assert.ok(idxRule < idxCatch, 'rewrite must come before the /api catch-all');
    assert.match(read('vite.config.ts'), /\/api\/checkin-points/);
    assert.match(read('api/vault-news.js'), /handleCheckinPointsBridge/);
  });

  it('Connect never signs QR codes or awards points itself', () => {
    const bridge = read('api/_utils/checkinPointsBridge.js');
    const client = read('lib/checkinPointsClient.ts');
    for (const src of [bridge, client]) {
      assert.equal(/createHmac|CHECKIN_QR_SECRET|service_role|SERVICE_ROLE/.test(src), false);
      assert.equal(/member_point_ledger|award_points_for_session|attendance_self_checkin/.test(src), false);
    }
    assert.equal(bridge.includes("'self-qr'"), false);
  });

  it('profile card has the two buttons; home has My QR + scan link; route exists', () => {
    const card = read('components/points/MyPointsCard.tsx');
    assert.match(card, /Show my QR/);
    assert.match(card, /Scan the room code/);
    assert.match(card, /Show me on the leaderboard/);
    // Phase 3: the points card lives on the Me tab (your profile hub).
    assert.match(read('pages/MemberMore.tsx'), /<MyPointsCard \/>/);

    const board = read('components/member/MemberHomeLeaderboard.tsx');
    // My QR lives in the Home header shortcuts; the board keeps the room-code scan.
    assert.match(read('components/member/MemberHomeHeader.tsx'), /My QR/);
    assert.match(board, /Scan the room code/);
    assert.match(read('components/member/MemberHome.tsx'), /<MemberHomeLeaderboard \/>/);

    const app = read('App.tsx');
    assert.match(app, /path="\/scan-in"/);
    assert.match(app, /<SeasonThemeProvider>/);
    assert.match(read('lib/memberShell.ts'), /'\/scan-in'/);
    assert.match(read('pages/ScanIn.tsx'), /params\.get\('c'\)/);
  });

  it('season CSS variables and falling effect are wired', () => {
    const css = read('index.css');
    for (const id of ['fall', 'winter', 'spring', 'summer', 'thanksgiving', 'christmas', 'new_year', 'easter', 'anniversary', 'brand']) {
      assert.ok(css.includes(`html[data-season='${id}']`), id);
    }
    assert.match(css, /--season-accent: #9a3412/);
    assert.match(read('components/season/SeasonParticles.tsx'), /drawLeaf/);
    assert.match(read('components/Home.tsx'), /<SeasonHeroLayer \/>/);
    assert.match(read('components/member/MemberHome.tsx'), /<SeasonHeroLayer \/>/);
  });
});
