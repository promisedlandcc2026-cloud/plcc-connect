/**
 * Phase 4 accessibility guards (found with an axe scan of the main screens).
 * Run: node --test scripts/test-accessibility.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

function walk(dir, out = []) {
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out);
    else if (/\.(tsx|jsx)$/.test(name)) out.push(rel);
  }
  return out;
}

function contrast(a, b) {
  const lum = (h) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl);
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

describe('accessibility', () => {
  it('pinch-zoom is allowed', () => {
    const html = read('index.html');
    assert.equal(/user-scalable=no|maximum-scale=1/.test(html), false);
  });

  it('secondary text grays pass WCAG AA on white and eggshell', () => {
    const tw = read('tailwind.config.js');
    const gray500 = /500: '(#[0-9A-Fa-f]{6})'/.exec(tw)[1];
    const inkSoft = /soft: '(#[0-9A-Fa-f]{6})'/.exec(tw)[1];
    for (const c of [gray500, inkSoft]) {
      assert.ok(contrast(c, '#FFFFFF') >= 4.5, `${c} on white`);
      assert.ok(contrast(c, '#F8F5F2') >= 4.5, `${c} on eggshell`);
    }
  });

  it('no faint gray-300 text on light member screens', () => {
    const skip = /Huddle|DigitalBulletin|WelcomeSplash|PWAPrompt|BottomNav|AWCAssistant|MemberCard|DependentDigitalCard|WatchLive|huddle\//;
    const offenders = [];
    for (const f of [...walk('components'), ...walk('pages')]) {
      if (skip.test(f)) continue;
      for (const line of read(f).split('\n')) {
        if (/(?<![:\w-])text-gray-300\b/.test(line) && !/text-white|bg-burgundy|bg-\[#1A1A1A\]|bg-black/.test(line)) {
          offenders.push(`${f}: ${line.trim().slice(0, 80)}`);
        }
      }
    }
    assert.deepEqual(offenders, []);
  });

  it('icon-only buttons found by the scan have names; visitor Home has an h1', () => {
    assert.match(read('components/PWAPrompt.tsx'), /aria-label="Dismiss"/);
    assert.match(read('components/PrayerWall.tsx'), /aria-label="Refresh prayer requests"/);
    assert.match(read('components/home/HomeHero.tsx'), /<h1 className="sr-only">/);
    assert.equal(read('pages/CommunityFeed.tsx').includes('<article\n      role="link"'), false);
  });

  it('error screen is a page region; sign-in uses shared fields', () => {
    assert.match(read('components/routing/LazyChunkErrorBoundary.jsx'), /<main className=/);
    const signIn = read('pages/MemberSignIn.tsx');
    assert.match(signIn, /inputClass\(/);
    assert.match(signIn, /LABEL_CLASS/);
  });

  it('Chat never shows the internal phone-account email', () => {
    const chat = read('pages/CommunityChat.tsx');
    assert.equal(chat.includes('user?.email'), false);
  });
});
