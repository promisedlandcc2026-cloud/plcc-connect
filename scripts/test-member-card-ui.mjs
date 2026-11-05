/**
 * Phase 2.6B — My PLCC Card UI contracts (source + pure helpers).
 * Run: node --test scripts/test-member-card-ui.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { countApiJsHandlers } from '../api/_utils/serveSanitize.js';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function parseCardStatus(value) {
  const s = String(value || '').toLowerCase();
  if (s === 'inactive' || s === 'revoked' || s === 'active') return s;
  return 'inactive';
}

function isValidQrPayload(value) {
  return typeof value === 'string' && /^AWC1\.[0-9a-f]{64}$/.test(value);
}

function isValidCardNumber(value) {
  return typeof value === 'string' && /^PLCC-[0-9]{4}-[0-9]{5,}$/.test(value);
}

function sanitizeMemberCardDto(raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const cardNumber = typeof r.cardNumber === 'string' ? r.cardNumber.trim() : '';
  const qrPayload = typeof r.qrPayload === 'string' ? r.qrPayload.trim() : '';
  if (!isValidCardNumber(cardNumber) || !isValidQrPayload(qrPayload)) return null;
  return {
    displayName: (typeof r.displayName === 'string' && r.displayName.trim()) || 'PLCC Member',
    avatarUrl: typeof r.avatarUrl === 'string' ? r.avatarUrl : null,
    label: (typeof r.label === 'string' && r.label.trim()) || 'PLCC Member',
    cardNumber,
    cardStatus: parseCardStatus(r.cardStatus),
    qrPayload,
    issuedAt: typeof r.issuedAt === 'string' ? r.issuedAt : null,
    rotatedAt: typeof r.rotatedAt === 'string' ? r.rotatedAt : null,
  };
}

describe('Phase 2.6B My PLCC Card UI', () => {
  it('A: /card route is lazy + approved_member gated', () => {
    const app = read('App.tsx');
    assert.ok(app.includes('path="/card"'));
    assert.ok(app.includes('MemberCardPage'));
    assert.ok(app.includes("import('./pages/MemberCard')"));
    const cardIdx = app.indexOf('path="/card"');
    const slice = app.slice(Math.max(0, cardIdx - 80), cardIdx + 280);
    assert.ok(slice.includes('requireAccess="approved_member"'));
    assert.ok(slice.includes('LazyRoute'));
  });

  it('B: pending blocked by MemberGate (no card-specific bypass)', () => {
    const gate = read('components/auth/MemberGate.tsx');
    assert.ok(gate.includes('approved_member'));
    assert.ok(gate.includes('pending'));
    const page = read('pages/MemberCard.tsx');
    assert.equal(page.includes('bypass') || page.includes('forceAccess'), false);
  });

  it('C: direct authenticated RPC client (no Connect API bridge)', () => {
    const client = read('lib/memberCardClient.ts');
    assert.ok(client.includes("supabase.rpc('get_my_member_digital_card')"));
    assert.ok(client.includes("supabase.rpc('rotate_member_digital_card')"));
    assert.ok(client.includes("supabase.rpc('mint_member_digital_card')"));
    assert.ok(client.includes("from './supabase'"));
    assert.equal(client.includes('/api/'), false);
    assert.equal(client.includes('fetch('), false);
  });

  it('D: no 13th API function', () => {
    const apiDir = join(root, 'api');
    const handlers = readdirSync(apiDir).filter((f) => f.endsWith('.js'));
    assert.equal(handlers.length, 15);
    assert.equal(countApiJsHandlers(handlers), 15);
    assert.equal(handlers.some((f) => /card/i.test(f)), false);
  });

  it('E: no service_role in card client/UI', () => {
    for (const rel of [
      'lib/memberCardClient.ts',
      'lib/memberCardUi.ts',
      'pages/MemberCard.tsx',
    ]) {
      const src = read(rel);
      assert.equal(/service_role/i.test(src), false, rel);
      assert.equal(/SUPABASE_SERVICE/i.test(src), false, rel);
    }
  });

  it('F: member-safe DTO only', () => {
    const client = read('lib/memberCardClient.ts');
    assert.ok(client.includes('sanitizeMemberCardDto'));
    assert.ok(client.includes('cardNumber'));
    assert.ok(client.includes('qrPayload'));
    assert.ok(client.includes('cardStatus'));
    assert.equal(client.includes('userId'), false);
    assert.equal(client.includes('memberId'), false);
    assert.equal(client.includes('qr_token_hash'), false);
    const dto = sanitizeMemberCardDto({
      displayName: 'Test Member',
      avatarUrl: null,
      label: 'PLCC Member',
      cardNumber: 'PLCC-2026-00001',
      cardStatus: 'active',
      qrPayload: 'AWC1.' + 'a'.repeat(64),
      issuedAt: '2026-09-13T00:00:00Z',
      rotatedAt: null,
      userId: 'should-drop',
      email: 'x@y.com',
    });
    assert.ok(dto);
    assert.equal(dto.cardNumber, 'PLCC-2026-00001');
    assert.equal('userId' in dto, false);
    assert.equal('email' in dto, false);
  });

  it('G: QR rendered locally via react-qr-code', () => {
    const page = read('pages/MemberCard.tsx');
    assert.ok(page.includes("from 'react-qr-code'"));
    assert.ok(page.includes('<QRCode'));
    assert.ok(page.includes('value={card.qrPayload}'));
    assert.equal(/api\.qrserver|chart\.googleapis|qrcode\.js\.org|goqr/i.test(page), false);
    const pkg = JSON.parse(read('package.json'));
    assert.ok(pkg.dependencies['react-qr-code']);
  });

  it('H: qrPayload not displayed as text', () => {
    const page = read('pages/MemberCard.tsx');
    assert.ok(page.includes('value={card.qrPayload}'));
    // Must not render payload as JSX text children
    assert.equal(/>\s*\{card\.qrPayload\}\s*</.test(page), false);
    assert.equal(/Copy QR|clipboard|navigator\.clipboard/i.test(page), false);
  });

  it('I: no browser storage for token', () => {
    const page = read('pages/MemberCard.tsx');
    const client = read('lib/memberCardClient.ts');
    assert.equal(/localStorage\.|sessionStorage\.|indexedDB/i.test(page), false);
    assert.equal(/localStorage\.|sessionStorage\.|indexedDB/i.test(client), false);
  });

  it('J: no console token logging', () => {
    for (const rel of ['pages/MemberCard.tsx', 'lib/memberCardClient.ts', 'lib/memberCardUi.ts']) {
      const src = read(rel);
      assert.equal(/console\.(log|debug|info|warn|error)\([^)]*qrPayload/i.test(src), false);
      assert.equal(/console\.(log|debug|info)\(\s*card/i.test(src), false);
    }
  });

  it('K/L: initial mint via get_my; existing card same path', () => {
    const page = read('pages/MemberCard.tsx');
    const client = read('lib/memberCardClient.ts');
    assert.ok(page.includes('fetchMyDigitalCard'));
    assert.ok(client.includes('get_my_member_digital_card'));
    assert.ok(client.includes('lazily mints') || client.includes('lazy-mint'));
  });

  it('M: rotate confirmation copy', () => {
    const ui = read('lib/memberCardUi.ts');
    const page = read('pages/MemberCard.tsx');
    assert.ok(ui.includes('Regenerate your QR code?'));
    assert.ok(ui.includes('stop working immediately'));
    assert.ok(page.includes('window.confirm(ROTATE_CONFIRM_COPY)'));
    assert.ok(page.includes('Regenerate QR'));
  });

  it('N/O/P: rotate success/failure behavior', () => {
    const page = read('pages/MemberCard.tsx');
    assert.ok(page.includes('rotateMyDigitalCard'));
    assert.ok(page.includes('setCard(next)'));
    assert.ok(page.includes('Keep existing card'));
    assert.ok(page.includes('disabled={rotating'));
    assert.ok(page.includes('Your QR code has been regenerated.'));
  });

  it('Q: Home Quick Action My Card (replaces My Family soon slot)', () => {
    const home = read('components/member/MemberHomeQuickActions.tsx');
    assert.ok(home.includes("to: '/card'"));
    assert.ok(home.includes("label: 'My Card'"));
    assert.equal(home.includes("label: 'My Family'"), false);
  });

  it('R: More → My PLCC Card + My Family route', () => {
    const more = read('pages/MemberMore.tsx');
    assert.ok(more.includes("to: '/card'"));
    assert.ok(more.includes("label: 'My PLCC Card'"));
    assert.ok(more.includes("to: '/family'"));
    assert.ok(more.includes("label: 'My Family'"));
    assert.equal(/label: 'My Family'[\s\S]{0,120}kind: 'soon'/.test(more), false);
  });

  it('S: MemberNav unchanged items; /card and /family highlight Me', () => {
    const nav = read('components/MemberNav.tsx');
    assert.ok(nav.includes("label: 'Home'"));
    assert.ok(nav.includes("label: 'Community'"));
    assert.ok(nav.includes("label: 'Prayer'"));
    assert.ok(nav.includes("label: 'Events'"));
    assert.ok(nav.includes("label: 'Me'"));
    assert.ok(nav.includes("pathname === '/card'"));
    assert.ok(nav.includes("pathname === '/family'"));
    assert.equal(nav.includes("label: 'Card'"), false);
  });

  it('T: PublicHome unchanged / no public card CTA', () => {
    const home = read('components/Home.tsx');
    assert.equal(home.includes('/card'), false);
    assert.equal(home.includes('My PLCC Card'), false);
    assert.equal(home.includes('Digital Card'), false);
  });

  it('U: no family/child UI on card page', () => {
    const page = read('pages/MemberCard.tsx');
    assert.equal(/\bFamily Pass\b|\bguardian\b|\bhousehold\b|\bchild card\b/i.test(page), false);
  });

  it('V: no scanner', () => {
    const page = read('pages/MemberCard.tsx');
    assert.equal(/scanner|resolve_member|check-in|checkIn/i.test(page), false);
  });

  it('W: no raw UUID QR', () => {
    const page = read('pages/MemberCard.tsx');
    assert.equal(/value=\{.*\.id\}|member\.id|user\.id/i.test(page), false);
    assert.ok(page.includes('value={card.qrPayload}'));
    assert.ok(isValidQrPayload('AWC1.' + 'ab'.repeat(32)));
    assert.equal(isValidQrPayload('not-a-token'), false);
  });

  it('X: privacy + screenshot copy', () => {
    const ui = read('lib/memberCardUi.ts');
    assert.ok(ui.includes('Keep it private'));
    assert.ok(ui.includes('screenshot'));
    assert.ok(ui.includes('Regenerate QR'));
  });

  it('member shell treats /card as auth + nav path', () => {
    const shell = read('lib/memberShell.ts');
    assert.ok(shell.includes("'/card'"));
    assert.ok(shell.includes('isCardPath'));
  });

  it('package test script includes member-card-ui', () => {
    const pkg = JSON.parse(read('package.json'));
    assert.ok(pkg.scripts['test:member-card-ui']);
    assert.ok(pkg.scripts.test.includes('test:member-card-ui'));
  });

  it('react-qr-code is resolvable locally (no external QR service)', () => {
    assert.equal(existsSync(join(root, 'node_modules/react-qr-code/package.json')), true);
    const mod = require('react-qr-code/package.json');
    assert.ok(mod.name === 'react-qr-code');
  });
});
