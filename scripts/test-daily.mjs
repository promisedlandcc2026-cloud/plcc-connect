// Daily: Psalms plan, daily pauses, KJV verse lookup, and the read-only Vault bridge.
// Run: node --test scripts/test-daily.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import { dailyUpstreamQuery, handleDailyBridge } from '../api/_utils/dailyBridge.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Phone storage + bundled Bible files, as the browser would have them.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const m = String(url).match(/^\/bible\/kjv\/([1-3A-Z]{3})\.json$/);
  if (m) return new Response(readFileSync(join(root, 'public/bible/kjv', `${m[1]}.json`), 'utf8'), { status: 200 });
  return realFetch(url, init);
};

// Bundled inside the project so the app's own packages resolve.
const out = join(root, 'node_modules', '.cache', 'awc-test-daily', 'dailyClient.mjs');
await build({
  entryPoints: [join(root, 'lib/dailyClient.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  packages: 'external',
  define: { 'import.meta.env': '{}' },
  outfile: out,
  logLevel: 'silent',
});
const d = await import(pathToFileURL(out).href);

test('Psalms plan: five a day, all 150 in 30 days', () => {
  assert.deepEqual(d.psalmsForDay(1), [1, 2, 3, 4, 5]);
  assert.deepEqual(d.psalmsForDay(18), [86, 87, 88, 89, 90]);
  assert.deepEqual(d.psalmsForDay(30), [146, 147, 148, 149, 150]);
  const all = Array.from({ length: 30 }, (_, i) => d.psalmsForDay(i + 1)).flat();
  assert.equal(new Set(all).size, 150);
});

test('plan moves with you: finish a day, and the next calendar day opens the next five', () => {
  store.clear();
  let s = d.readPlan('2026-10-24');
  assert.equal(s.day, 1);
  for (const n of [1, 2, 3, 4]) s = d.togglePsalm(n, '2026-10-24');
  assert.equal(s.finishedOn, null, 'not done until all five');
  s = d.togglePsalm(5, '2026-10-24');
  assert.equal(s.finishedOn, '2026-10-24');
  assert.equal(d.planDaysDone(s), 1);
  assert.equal(d.readPlan('2026-10-24').day, 1, 'same day: stays on day 1, shows complete');
  s = d.readPlan('2026-10-29');
  assert.equal(s.day, 2, 'days later: just the next day, no catching up');
  assert.deepEqual(s.done, []);
  s = d.togglePsalm(3, '2026-10-29');
  assert.deepEqual(s.done, [], 'a psalm from another day is ignored');
  s = d.togglePsalm(6, '2026-10-29');
  s = d.togglePsalm(6, '2026-10-29');
  assert.deepEqual(s.done, [], 'tap again to undo');
});

test('finishing day 30 completes the plan; start again resets it', () => {
  store.set('awc_daily_psalms_plan_v1', JSON.stringify({ day: 30, done: [146, 147, 148, 149], finishedOn: null, complete: false }));
  const s = d.togglePsalm(150, '2026-11-30');
  assert.equal(s.complete, true);
  assert.equal(d.planDaysDone(s), 30);
  assert.equal(d.readPlan('2026-12-05').day, 30, 'stays finished');
  assert.equal(d.restartPlan().day, 1);
});

test('broken saved progress never breaks the page', () => {
  store.set('awc_daily_psalms_plan_v1', '{not json');
  assert.equal(d.readPlan('2026-10-24').day, 1);
  store.set('awc_daily_psalms_plan_v1', JSON.stringify({ day: 99, done: ['x', 3] }));
  assert.equal(d.readPlan('2026-10-24').day, 1);
});

test('three pauses: toggle, and count days this week with a pause', () => {
  store.clear();
  assert.deepEqual(d.togglePause('2026-10-20', 'morning'), ['morning']);
  assert.deepEqual(d.togglePause('2026-10-24', 'evening'), ['evening']);
  assert.deepEqual(d.togglePause('2026-10-24', 'morning'), ['morning', 'evening']);
  assert.deepEqual(d.togglePause('2026-10-24', 'morning'), ['evening']);
  assert.deepEqual(d.pauseDaysThisWeek('2026-10-19', '2026-10-24'), { withPause: 2, daysSoFar: 6 });
});

test('verse text comes from the bundled KJV, tidied', async () => {
  assert.equal(
    await d.kjvTextFor('Lamentations 3:22-23'),
    'It is of the LORD’s mercies that we are not consumed, because his compassions fail not. They are new every morning: great is thy faithfulness.'
  );
  assert.match(await d.kjvTextFor('Psalm 86:1'), /^Bow down thine ear, O LORD, hear me/);
  assert.equal(await d.kjvTextFor('Not A Book 9:9'), null);
  assert.equal(d.bibleLink('Psalm 23:1-3'), '/bible?q=Psalm%2023%3A1-3');
});

test('reflection splits into paragraphs on blank lines', () => {
  assert.deepEqual(d.paragraphs('One\nline.\n\nTwo.\n\n\n'), ['One line.', 'Two.']);
});

test('bridge: read-only, fixed Vault address, only the fields Daily shows', async () => {
  assert.equal(dailyUpstreamQuery({ date: '2026-10-24' }), 'resource=daily&action=week&date=2026-10-24');
  assert.equal(dailyUpstreamQuery({ date: 'drop table' }), 'resource=daily&action=week');

  const res = () => {
    const r = { statusCode: 0, body: null, headers: {} };
    r.setHeader = (k, v) => (r.headers[k] = v);
    r.status = (c) => ((r.statusCode = c), r);
    r.json = (b) => ((r.body = b), r);
    return r;
  };
  const post = res();
  await handleDailyBridge({ method: 'POST', query: {} }, post);
  assert.equal(post.statusCode, 405);

  process.env.VAULT_API_ORIGIN = 'https://vault.example.com';
  const seen = [];
  const prev = globalThis.fetch;
  globalThis.fetch = async (url) => {
    seen.push(String(url));
    return new Response(
      JSON.stringify({
        ok: true,
        today: '2026-10-24',
        monday: '2026-10-19',
        seriesTitle: 'New Every Morning',
        days: [{ day: '2026-10-24', source: 'church', title: 'T', ref: 'Psalm 23:1', body: 'B', authorId: 'secret', question: null, prayer: 'P' }],
      }),
      { status: 200 }
    );
  };
  try {
    const r = res();
    await handleDailyBridge({ method: 'GET', query: { date: '2026-10-24' } }, r);
    assert.equal(r.statusCode, 200);
    assert.equal(seen[0], 'https://vault.example.com/api/vault?resource=daily&action=week&date=2026-10-24');
    assert.equal(r.body.seriesTitle, 'New Every Morning');
    assert.equal('authorId' in r.body.days[0], false);
    assert.equal(r.body.days[0].source, 'church');
  } finally {
    globalThis.fetch = prev;
  }
});

test('Daily page: no journal, reachable from Home and Me, signed-in route', () => {
  const page = readFileSync(join(root, 'pages/MemberDaily.tsx'), 'utf8');
  assert.equal(/journal/i.test(page.replace(/Private journaling lives in Sermon Notes/, '')), false, 'journal stays out of Daily');
  assert.match(readFileSync(join(root, 'components/member/MemberHome.tsx'), 'utf8'), /<MemberHomeDaily \/>/);
  assert.match(readFileSync(join(root, 'pages/MemberMore.tsx'), 'utf8'), /to: '\/daily'/);
  assert.match(readFileSync(join(root, 'App.tsx'), 'utf8'), /path="\/daily"[\s\S]{0,80}<MemberGate>/);
});
