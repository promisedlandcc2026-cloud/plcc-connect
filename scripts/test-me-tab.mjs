/**
 * Phase 3 — Me tab, /more redirect, one PLCC Card / QR.
 * Run: node --test scripts/test-me-tab.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

describe('navigation', () => {
  it('tabs are Home · Community · Events · Prayer · Me', () => {
    const nav = read('components/MemberNav.tsx');
    const labels = [...nav.matchAll(/label:\s*'([^']+)'/g)].map((m) => m[1]);
    assert.deepEqual(labels, ['Home', 'Community', 'Events', 'Prayer', 'Me']);
    assert.match(nav, /to: '\/me'/);
    assert.match(nav, /isMe && avatarUrl/, 'Me tab shows the member photo');
  });

  it('Me highlights for personal screens', () => {
    const nav = read('components/MemberNav.tsx');
    for (const p of ['/me', '/more', '/profile', '/account', '/notifications', '/my-attendance', '/serve/my', '/card', '/family']) {
      assert.ok(nav.includes(`pathname === '${p}'`), p);
    }
  });

  it('/me is gated; /more redirects; back links point at Me', () => {
    const app = read('App.tsx');
    assert.match(app, /path="\/me"[\s\S]{0,200}requireAccess="approved_member"/);
    assert.match(app, /path="\/more" element=\{<Navigate to="\/me" replace \/>\}/);
    for (const f of ['pages/MemberCard.tsx', 'pages/MemberProfile.tsx', 'pages/MemberNotes.tsx', 'pages/MemberDirectory.tsx', 'pages/MemberKidsPlans.tsx']) {
      assert.equal(read(f).includes('backTo="/more"'), false, f);
    }
    assert.match(read('lib/memberShell.ts'), /'\/me'/);
  });
});

describe('Me hub', () => {
  it('shows who you are, your points, then Mine / Church life / Account', () => {
    const me = read('pages/MemberMore.tsx');
    assert.match(me, /export const MemberMePage/);
    assert.match(me, /export const MemberMorePage = MemberMePage/);
    assert.match(me, /<MyPointsCard \/>/);
    assert.match(me, /to="\/profile"/);
    assert.match(me, /\['mine', 'church', 'account'\]/);
    assert.match(me, /to: '\/my-attendance'/);
    assert.equal(read('pages/MemberProfile.tsx').includes('<MyPointsCard'), false, 'points live on Me, not twice');
  });
});

describe('one PLCC Card', () => {
  it('QR modal is the PLCC Card and links to the full card', () => {
    const modal = read('components/points/MyPassQrModal.tsx');
    assert.match(modal, /My PLCC Card/);
    assert.match(modal, /to="\/card"/);
  });

  it('card page explains check-in, links to the room scanner, keeps the screen awake', () => {
    const card = read('pages/MemberCard.tsx');
    assert.match(card, /when you check in/);
    assert.match(card, /to="\/scan-in"/);
    assert.match(card, /useScreenWakeLock\(Boolean\(card\)\)/);
    assert.match(card, /Regenerate QR/);
  });
});
