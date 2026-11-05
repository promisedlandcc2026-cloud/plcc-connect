/**
 * Phase 10 — lazy route fallback / error boundary smoke tests.
 * Run: node --test scripts/test-lazy-route.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import {
  connectionLooksConstrainedForTest,
  shouldPrefetch,
} from './helpers/prefetchRules.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

describe('LazyRoute source contracts', () => {
  it('exposes branded fallback, retry, and home recovery without stack traces', () => {
    const routeSrc = readFileSync(join(root, 'components/routing/LazyRoute.tsx'), 'utf8');
    const boundarySrc = readFileSync(
      join(root, 'components/routing/LazyChunkErrorBoundary.jsx'),
      'utf8'
    );
    assert.ok(routeSrc.includes('RouteSectionFallback'));
    assert.ok(routeSrc.includes('LazyChunkErrorBoundary'));
    assert.ok(routeSrc.includes('role="status"'));
    assert.ok(boundarySrc.includes('Retry'));
    assert.ok(boundarySrc.includes('Return Home'));
    assert.equal(boundarySrc.includes('componentStack'), false);
    assert.equal(/console\.(log|error|info).*stack/i.test(boundarySrc), false);
  });

  it('App lazy-loads member routes and keeps MemberGate outside private chunks', () => {
    const src = readFileSync(join(root, 'App.tsx'), 'utf8');
    assert.ok(src.includes("lazy(() =>"));
    assert.ok(src.includes('MemberGate'));
    assert.ok(src.includes('CommunityProvidersLayout'));
    assert.ok(src.includes('MemberNotificationsPage'));
    assert.ok(src.includes('MemberPrayerPage'));
    assert.ok(src.includes('MemberEventsPage'));
    assert.ok(src.includes('MemberMorePage'));
    assert.ok(src.includes('MemberServePage'));
    assert.ok(src.includes('MemberServeMyPage'));
    assert.ok(src.includes('MemberServeDetailPage'));
    assert.ok(src.includes('MemberSundayPage'));
    assert.ok(src.includes('MemberNotesPage'));
    assert.ok(src.includes('MemberNoteNewPage'));
    assert.ok(src.includes('MemberNoteEditPage'));
    assert.ok(src.includes('MemberCardPage'));
    assert.ok(src.includes('MemberSignIn'));
    assert.ok(src.includes('AuthCallback'));
    // Eager public shell
    assert.ok(src.includes("from './components/Home'"));
    assert.ok(src.includes("from './pages/WelcomeSplash'"));
    // Community providers not mounted globally
    assert.equal(src.includes('CommunityReactionsProvider'), false);
    assert.equal(src.includes('CommunityPostsSyncProvider'), false);
  });

  it('PLCC Assistant does not statically import Gemini', () => {
    const src = readFileSync(join(root, 'components/AWCAssistant.tsx'), 'utf8');
    assert.equal(src.includes("from '../lib/ai'"), false);
    assert.ok(src.includes("import('../lib/ai')"));
  });
});

describe('prefetch rules', () => {
  it('skips prefetch on save-data and slow connections', () => {
    assert.equal(shouldPrefetch({ saveData: true }), false);
    assert.equal(shouldPrefetch({ effectiveType: '2g' }), false);
    assert.equal(shouldPrefetch({ effectiveType: 'slow-2g' }), false);
    assert.equal(shouldPrefetch({ effectiveType: '4g' }), true);
    assert.equal(shouldPrefetch({}), true);
    assert.equal(connectionLooksConstrainedForTest({ saveData: true }), true);
  });
});

describe('production bundle markers (when dist exists)', () => {
  it('keeps Gemini and Community feature markers out of the public entry chunk', () => {
    const assets = join(root, 'dist/assets');
    if (!existsSync(assets)) {
      // Build may not have run yet in isolation — skip softly.
      return;
    }
    const files = readdirSync(assets).filter((f) => f.endsWith('.js'));
    const entry =
      files.find((f) => f.startsWith('index-')) ||
      files.sort((a, b) => {
        const sa = readFileSync(join(assets, a)).length;
        const sb = readFileSync(join(assets, b)).length;
        return sb - sa;
      })[0];
    assert.ok(entry, 'expected a JS entry chunk');
    const text = readFileSync(join(assets, entry), 'utf8');
    assert.equal(text.includes('GoogleGenAI'), false, 'Gemini must not be in entry');
    assert.equal(
      /community-reaction|CommunityReactionsProvider|mention-candidates/.test(text),
      false,
      'Community feature code must not be in public entry'
    );
    // Entry should stay under the Vite warning threshold when gzip-aware raw is considered
    const rawKb = readFileSync(join(assets, entry)).length / 1024;
    assert.ok(rawKb < 500, `entry chunk ${entry} is ${rawKb.toFixed(1)} kB (want < 500)`);
  });

  it('reports chunk inventory for the Phase 10 report', () => {
    const assets = join(root, 'dist/assets');
    if (!existsSync(assets)) return;
    const rows = readdirSync(assets)
      .filter((f) => f.endsWith('.js') || f.endsWith('.css'))
      .map((f) => {
        const buf = readFileSync(join(assets, f));
        return {
          file: f,
          rawKb: +(buf.length / 1024).toFixed(2),
          gzipKb: +(gzipSync(buf).length / 1024).toFixed(2),
        };
      })
      .sort((a, b) => b.rawKb - a.rawKb);
    assert.ok(rows.length >= 2);
    // Ensure output is visible in test runner logs
    console.log(JSON.stringify(rows, null, 2));
  });
});
