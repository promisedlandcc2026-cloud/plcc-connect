/**
 * Phase 2 design kit — readable text floor, shared components, next service,
 * assistant launcher. Run: node --test scripts/test-design-kit.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

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

async function load(entry) {
  const out = await build({ entryPoints: [join(root, entry)], bundle: true, write: false, format: 'esm', platform: 'neutral' });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
}

describe('readable text', () => {
  it('no UI text below 12px (count badges may use 11px)', () => {
    const offenders = [];
    for (const f of [...walk('components'), ...walk('pages')]) {
      const src = read(f);
      for (const m of src.matchAll(/text-\[(\d+)px\]/g)) {
        const px = Number(m[1]);
        if (px < 11) offenders.push(`${f}: ${m[0]}`);
      }
    }
    assert.deepEqual(offenders, []);
  });

  it('Sanctuary type is actually loaded (Jakarta UI weights, Playfair with italics)', () => {
    const html = read('index.html');
    assert.match(html, /Plus\+Jakarta\+Sans:wght@400;500;600;700;800/);
    assert.match(html, /Playfair\+Display:ital,wght@0,600;0,700;1,600;1,700/);
    assert.match(read('tailwind.config.js'), /sans: \['Plus Jakarta Sans'/);
  });

  it('serif is reserved for page titles via font-display', () => {
    const css = read('index.css');
    assert.match(css, /h1, h2, h3 \{\s*font-family: 'Plus Jakarta Sans'/);
    assert.match(css, /\.font-display/);
    assert.match(read('components/member/MemberPageHeader.tsx'), /font-display/);
    assert.match(read('tailwind.config.js'), /'gold-ink': '#7A5C0F'/);
  });
});

describe('kit components', () => {
  it('Button has the variant set and link forms', () => {
    const src = read('components/ui/Button.tsx');
    for (const v of ['primary', 'secondary', 'subtle', 'ghost', 'danger', 'dark']) assert.ok(src.includes(`${v}:`), v);
    assert.match(src, /export const ButtonLink/);
    assert.match(src, /export const ButtonAnchor/);
    assert.match(src, /min-h-\[48px\]/);
  });

  it('More uses grouped ListRows and opens Give directly', () => {
    const more = read('pages/MemberMore.tsx');
    assert.match(more, /<ListGroup/);
    assert.match(more, /kind: 'modal',\s*modal: 'give'/);
    assert.equal(more.includes("sectionId: 'actions'"), false, 'Home no longer has an actions section');
    assert.match(more, /<GiveModule/);
  });

  it('page headers drop the repeated "PLCC Connect" eyebrow', () => {
    for (const f of walk('pages')) {
      assert.equal(read(f).includes('eyebrow="PLCC Connect"'), false, f);
    }
  });

  it('member bottom bar is the floating glass dock: sentence case, gold-leaf active pill', () => {
    const nav = read('components/MemberNav.tsx');
    assert.match(nav, /awc-dock/);
    assert.match(nav, /active \? 'bg-leaf text-wine'/);
    // Sliding pill: the current tab widens; every tab keeps its name under the icon.
    assert.match(nav, /function tabGrow/);
    assert.match(nav, /\{item\.label\}\s*<\/span>/);
    assert.equal(nav.includes('max-w-0'), false, 'names are never hidden');
    assert.match(read('index.css'), /prefers-reduced-motion: reduce\)[\s\S]*\.awc-dock-tab/);
    assert.equal(/text-xs uppercase/.test(nav), false);
    assert.match(read('index.css'), /\.awc-dock \{[\s\S]*backdrop-filter/);
  });
});

describe('next service (Watch)', () => {
  it('no hardcoded service time in Watch', () => {
    const src = read('components/WatchLive.tsx');
    assert.equal(src.includes('Sun @ 10:30 AM'), false);
    assert.match(src, /pickNextService/);
    assert.match(src, /Live now/);
  });

  it('uses the calendar service, else the next scheduled Sunday', async () => {
    const n = await load('lib/nextService.ts');
    const thu = new Date(2026, 9, 15, 9, 0); // Thu Oct 15 2026, local
    const sun = n.nextScheduledSunday(thu);
    assert.equal(sun.getDay(), 0);
    assert.equal(sun.getDate(), 18);
    assert.equal(sun.getHours(), 10);
    assert.equal(sun.getMinutes(), 30);
    // During Sunday service it is still "today"; after it ends it rolls to next week.
    assert.equal(n.nextScheduledSunday(new Date(2026, 9, 18, 11, 0)).getDate(), 18);
    assert.equal(n.nextScheduledSunday(new Date(2026, 9, 18, 13, 0)).getDate(), 25);

    const cal = [
      { id: 'a', title: 'Sunday Worship', starts_at: new Date(2026, 9, 18, 10, 0).toISOString() },
      { id: 'b', title: 'Choir practice', starts_at: new Date(2026, 9, 16, 18, 0).toISOString() },
    ];
    const pick = n.pickNextService(cal, thu);
    assert.equal(pick.fromCalendar, true);
    assert.equal(pick.startsAt.getHours(), 10);
    assert.equal(pick.startsAt.getMinutes(), 0);
    assert.equal(n.pickNextService([], thu).fromCalendar, false);

    assert.match(n.formatServiceWhen(new Date(2026, 9, 15, 19, 30), thu), /^Today · 7:30/);
    assert.match(n.formatServiceWhen(new Date(2026, 9, 16, 19, 30), thu), /^Tomorrow · /);
    assert.match(n.formatServiceWhen(sun, thu), /^Sun, Oct 18 · 10:30/);
  });
});

describe('assistant', () => {
  it('members open it from the Home header; visitors get a scroll-aware launcher', () => {
    const a = read('components/AWCAssistant.tsx');
    assert.match(a, /export const ASSISTANT_OPEN_EVENT/);
    assert.match(a, /useLauncherHidden/);
    assert.match(a, /Ask PLCC/);
    assert.match(a, /rounded-t-\[28px\]/, 'opens as a bottom sheet on phones');
    assert.match(read('App.tsx'), /<AWCAssistant showLauncher=\{!isApprovedMember\} \/>/);
    assert.match(read('components/member/MemberHomeHeader.tsx'), /onClick=\{openAssistant\}/);
  });
});
