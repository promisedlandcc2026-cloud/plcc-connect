/**
 * Phones: stay signed in across tab switches / wake, and keep the screen on.
 * Run: node --test scripts/test-stay-signed-in.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

/** Bundle lib/authAccessToken.ts with ./supabase swapped for a controllable stub. */
async function loadTokenLib() {
  const stub = `
    export const isSupabaseConfigured = true;
    export const calls = { refresh: 0 };
    export const supabase = { auth: {
      refreshSession: async () => {
        calls.refresh += 1;
        await new Promise((r) => setTimeout(r, 20));
        if (globalThis.__refreshFails) return { data: { session: null }, error: { code: 'refresh_token_already_used', message: 'Invalid Refresh Token: Already Used' } };
        return { data: { session: { access_token: 'a.b.c', expires_at: Math.floor(Date.now() / 1000) + 3600 } }, error: null };
      },
      getSession: async () => ({ data: { session: globalThis.__stored || null }, error: null }),
    } };`;
  const out = await build({
    entryPoints: [join(root, 'lib/authAccessToken.ts')],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    external: ['@supabase/supabase-js'],
    plugins: [{
      name: 'stub-supabase',
      setup(b) {
        b.onResolve({ filter: /^\.\/supabase$/ }, () => ({ path: 'stub', namespace: 'stub' }));
        b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: stub, loader: 'js' }));
      },
    }],
  });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
}

describe('stay signed in', () => {
  it('parallel refreshes on wake share one request', async () => {
    const lib = await loadTokenLib();
    globalThis.__refreshFails = false;
    const results = await Promise.all([lib.refreshSessionOnce(), lib.refreshSessionOnce(), lib.refreshSessionOnce()]);
    assert.ok(results.every((r) => r.session && r.session.access_token === 'a.b.c'));
    assert.equal(results[0], results[1], 'same promise result for every caller');
  });

  it('a failed refresh falls back to the session another tab stored', async () => {
    const lib = await loadTokenLib();
    globalThis.__refreshFails = true;
    globalThis.__stored = { access_token: 'x.y.z', expires_at: Math.floor(Date.now() / 1000) + 600 };
    const r = await lib.refreshSessionOnce();
    assert.equal(r.session?.access_token, 'x.y.z');
    globalThis.__stored = null;
    const gone = await lib.refreshSessionOnce();
    assert.equal(gone.session, null);
    assert.ok(lib.isFatalRefreshError({ message: 'Invalid Refresh Token: Already Used' }));
  });

  it('no direct refreshSession calls outside the single-flight helper', () => {
    for (const f of ['context/AuthContext.tsx', 'lib/authAccessToken.ts']) {
      const n = (read(f).match(/supabase\.auth\.refreshSession\(/g) || []).length;
      assert.equal(n, f === 'lib/authAccessToken.ts' ? 1 : 0, f);
    }
  });

  it('SIGNED_OUT is double-checked unless the member tapped Sign out', () => {
    const ctx = read('context/AuthContext.tsx');
    assert.match(ctx, /if \(event === 'SIGNED_OUT'\) \{\s*if \(signingOutRef\.current\)/);
    assert.match(ctx, /confirmSessionGone/);
    assert.match(ctx, /supabase\.auth\.setSession\(/);
    assert.match(ctx, /retryIdentityIfNeeded/);
  });
});

describe('keep the screen on', () => {
  it('wake lock has the iPhone home-screen video fallback', async () => {
    const out = await build({ entryPoints: [join(root, 'lib/useScreenWakeLock.ts')], bundle: true, write: false, format: 'esm', platform: 'neutral', external: ['react'] });
    const src = out.outputFiles[0].text.replace(/import[^;]+from\s*["']react["'];?/, 'const useEffect = () => {};');
    const m = await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`);
    const iosPwa = (v) => ({ userAgent: `Mozilla/5.0 (iPhone; CPU iPhone OS ${v} like Mac OS X)`, standalone: true, wakeLock: { request() {} }, maxTouchPoints: 5 });
    assert.equal(m.needsVideoKeepAwake(iosPwa('17_5')), true);
    assert.equal(m.needsVideoKeepAwake(iosPwa('18_4')), false);
    assert.equal(m.needsVideoKeepAwake({ userAgent: 'Android', wakeLock: { request() {} } }), false);
    assert.equal(m.needsVideoKeepAwake({ userAgent: 'old' }), true);
    assert.ok(existsSync(join(root, 'public/nosleep.mp4')));
    assert.ok(existsSync(join(root, 'public/nosleep.webm')));
  });

  it('huddles, Sunday views, notes and the card keep the phone awake', () => {
    for (const f of [
      'components/community/ConnectVoiceHuddle.tsx',
      'components/family/FamilyVoiceHuddle.tsx',
      'components/sanctuary/SundayLiveHome.tsx',
      'pages/MemberSunday.tsx',
      'pages/MemberNoteEditor.tsx',
      'pages/MemberCard.tsx',
    ]) {
      assert.match(read(f), /useScreenWakeLock\(/, f);
    }
  });

  it('a huddle dropped by sleep or a tab switch rejoins when the member is back', () => {
    for (const f of ['components/community/ConnectVoiceHuddle.tsx', 'components/family/FamilyVoiceHuddle.tsx']) {
      const src = read(f);
      assert.match(src, /lostConnectionRef\.current = true;/, f);
      assert.match(src, /addEventListener\('visibilitychange', onBack\)/, f);
      assert.match(src, /reconnectAttemptsRef\.current = 0;\s*setError\(null\);\s*setConn\('reconnecting'\)/, f);
    }
  });
});
