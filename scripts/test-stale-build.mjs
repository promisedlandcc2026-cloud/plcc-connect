/**
 * Out-of-date app after a deploy: reload once, never loop; Retry reloads.
 * Run: node --test scripts/test-stale-build.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

async function load() {
  const out = await build({ entryPoints: [join(root, 'lib/staleBuild.ts')], bundle: true, write: false, format: 'esm', platform: 'neutral' });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
}

describe('stale build', () => {
  it('recognizes chunk load failures from Chrome, Safari and Firefox', async () => {
    const s = await load();
    assert.equal(s.isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/a.js')), true);
    assert.equal(s.isChunkLoadError(new TypeError('Importing a module script failed.')), true);
    assert.equal(s.isChunkLoadError(new TypeError('error loading dynamically imported module')), true);
    assert.equal(s.isChunkLoadError(new Error("Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of \"text/html\". Strict MIME type checking is enforced for module scripts per HTML spec. is not a valid JavaScript MIME type")), true);
    assert.equal(s.isChunkLoadError(new Error('Cannot read properties of undefined')), false);
  });

  it('reloads at most once per 30 seconds', async () => {
    const s = await load();
    const store = new Map();
    globalThis.sessionStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
    let reloads = 0;
    globalThis.window = { location: { reload: () => (reloads += 1) } };
    assert.equal(s.reloadOnceForNewVersion(1_000_000), true);
    assert.equal(s.reloadOnceForNewVersion(1_010_000), false, 'no loop');
    assert.equal(s.reloadOnceForNewVersion(1_000_000 + s.STALE_RELOAD_GUARD_MS + 1), true);
    assert.equal(reloads, 2);
  });

  it('is wired into the app, the route boundary and Vercel', () => {
    assert.match(read('index.tsx'), /vite:preloadError/);
    const boundary = read('components/routing/LazyChunkErrorBoundary.jsx');
    assert.match(boundary, /isChunkLoadError/);
    assert.match(boundary, /window\.location\.reload\(\)/);
    const rewrites = JSON.parse(read('vercel.json')).rewrites.map((r) => r.source);
    assert.ok(rewrites.indexOf('/assets/(.*)') > -1 && rewrites.indexOf('/assets/(.*)') < rewrites.indexOf('/(.*)'),
      'missing script files must 404, not return the home page');
  });
});
