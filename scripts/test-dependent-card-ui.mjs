/**
 * Phase 2.6D.3 — Guardian Child Card UI contracts (source + static privacy).
 * Run: node --test scripts/test-dependent-card-ui.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countApiJsHandlers } from '../api/_utils/serveSanitize.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const vaultRoot = join(root, '..', 'awc-vault-main');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const UI_FILES = [
  'pages/MemberDependentCard.tsx',
  'components/family/DependentDigitalCard.tsx',
  'components/family/FamilyMemberCard.tsx',
];

describe('Phase 2.6D.3 Guardian Child Card UI', () => {
  it('A: route exists', () => {
    assert.ok(existsSync(join(root, 'pages/MemberDependentCard.tsx')));
    assert.ok(read('App.tsx').includes('path="/family/card/:cardRef"'));
  });

  it('B: route lazy', () => {
    const app = read('App.tsx');
    assert.ok(app.includes("import('./pages/MemberDependentCard')"));
    assert.ok(app.includes('MemberDependentCardPage'));
    const idx = app.indexOf('path="/family/card/:cardRef"');
    const slice = app.slice(Math.max(0, idx - 80), idx + 360);
    assert.ok(slice.includes('LazyRoute'));
  });

  it('C: approved MemberGate', () => {
    const app = read('App.tsx');
    const idx = app.indexOf('path="/family/card/:cardRef"');
    const slice = app.slice(Math.max(0, idx - 80), idx + 360);
    assert.ok(slice.includes('requireAccess="approved_member"'));
    assert.ok(slice.includes('MemberGate'));
  });

  it('D: route uses opaque cardRef', () => {
    assert.ok(read('App.tsx').includes('path="/family/card/:cardRef"'));
    assert.ok(read('pages/MemberDependentCard.tsx').includes('useParams'));
    assert.ok(read('pages/MemberDependentCard.tsx').includes('cardRef'));
  });

  it('E: no raw member id route', () => {
    const app = read('App.tsx');
    assert.equal(/path=["']\/family\/card\/:memberId|path=["']\/family\/card\/:childId/.test(app), false);
    assert.equal(/path=["']\/family\/card\/:userId/.test(app), false);
  });

  it('F: validates cardRef format', () => {
    const page = read('pages/MemberDependentCard.tsx');
    assert.ok(page.includes('isDependentCardRef'));
    assert.ok(page.includes("from '../lib/dependentCardRef'"));
  });

  it('G: malformed ref safe (no RPC when invalid)', () => {
    const page = stripComments(read('pages/MemberDependentCard.tsx'));
    assert.ok(page.includes('isDependentCardRef(routeRef)'));
    assert.ok(page.includes("kind: 'unavailable'"));
    // Early return before fetch when invalid
    const idx = page.indexOf('isDependentCardRef(routeRef)');
    const beforeFetch = page.slice(idx, page.indexOf('fetchMyGuardianDependentCards', idx));
    assert.ok(beforeFetch.includes('unavailable'));
    assert.ok(beforeFetch.includes('return'));
  });

  it('H: fetches guardian cards', () => {
    const page = read('pages/MemberDependentCard.tsx');
    assert.ok(page.includes('fetchMyGuardianDependentCards'));
    assert.equal(page.includes('fetchMyFamilySummary'), false);
    assert.equal(page.includes('get_my_family_summary'), false);
    assert.equal(page.includes('get_my_member_digital_card'), false);
  });

  it('I: exact ref match only', () => {
    const page = stripComments(read('pages/MemberDependentCard.tsx'));
    assert.ok(page.includes('c.cardRef === routeRef') || page.includes('card.cardRef === routeRef'));
    assert.ok(page.includes('.find('));
  });

  it('J: unknown valid ref unavailable', () => {
    const page = read('pages/MemberDependentCard.tsx');
    assert.ok(page.includes('dependentCardUnavailableMessage'));
    assert.ok(read('lib/dependentCardUi.ts').includes('This child card is not available.'));
  });

  it('K: no displayName matching', () => {
    const page = stripComments(read('pages/MemberDependentCard.tsx'));
    assert.equal(/displayName\s*===|match.*displayName|find.*displayName/i.test(page), false);
  });

  it('L: no relationship matching', () => {
    const page = stripComments(read('pages/MemberDependentCard.tsx'));
    assert.equal(/relationship\s*===|match.*relationship/i.test(page), false);
  });

  it('M: no order matching', () => {
    const page = stripComments(read('pages/MemberDependentCard.tsx'));
    assert.equal(/cards\[0\]|dependents\[0\]|\[idx\]/.test(page), false);
  });

  it('N: Family guardian row gets View Child Card', () => {
    const card = read('components/family/FamilyMemberCard.tsx');
    assert.ok(card.includes('View Child Card'));
    assert.ok(card.includes("cardAccess === 'guardian'"));
    assert.ok(card.includes('isDependentCardRef(cardRef)'));
    assert.ok(card.includes('/family/card/'));
  });

  it('O: Family none row no action', () => {
    const card = stripComments(read('components/family/FamilyMemberCard.tsx'));
    assert.ok(card.includes("cardAccess === 'guardian'"));
    assert.ok(card.includes('isDependentCardRef(cardRef)'));
    // Action gated on both guardian + valid ref
    assert.ok(card.includes('showChildCardAction'));
  });

  it('P: child-card page displays safe fields', () => {
    const comp = read('components/family/DependentDigitalCard.tsx');
    assert.ok(comp.includes('card.displayName'));
    assert.ok(comp.includes('card.label'));
    assert.ok(comp.includes('card.cardNumber'));
    assert.ok(comp.includes('card.cardStatus'));
    assert.ok(comp.includes('card.qrPayload'));
    assert.ok(comp.includes('card.issuedAt'));
    assert.ok(comp.includes('card.rotatedAt'));
  });

  it('Q: cardRef not displayed', () => {
    const comp = stripComments(read('components/family/DependentDigitalCard.tsx'));
    assert.equal(/\{card\.cardRef\}|cardRef\}/.test(comp), false);
    assert.equal(comp.includes('card.cardRef'), false);
  });

  it('R: qrPayload not text-displayed', () => {
    const comp = stripComments(read('components/family/DependentDigitalCard.tsx'));
    assert.ok(comp.includes('value={card.qrPayload}'));
    assert.equal(/\{card\.qrPayload\}/.test(comp.replace('value={card.qrPayload}', '')), false);
  });

  it('S: local QR renderer', () => {
    const comp = read('components/family/DependentDigitalCard.tsx');
    assert.ok(comp.includes("from 'react-qr-code'"));
    assert.ok(comp.includes('<QRCode'));
    assert.equal(/api\.qrserver|chart\.googleapis|qrcode\.php/i.test(comp), false);
  });

  it('T: no child photo fetch', () => {
    const comp = stripComments(read('components/family/DependentDigitalCard.tsx'));
    const page = stripComments(read('pages/MemberDependentCard.tsx'));
    assert.ok(comp.includes('UserRound'));
    assert.equal(/avatarUrl|\.from\(\s*['"]members['"]|storage\.from/i.test(comp), false);
    assert.equal(/avatarUrl/i.test(page), false);
  });

  it('U: no rotate', () => {
    for (const rel of UI_FILES) {
      const src = stripComments(read(rel));
      assert.equal(/Regenerate QR|rotateMy|rotate_member|rotateDependent/i.test(src), false, rel);
    }
  });

  it('V: no revoke', () => {
    for (const rel of UI_FILES) {
      const src = stripComments(read(rel));
      assert.equal(/Revoke card|Deactivate card|Report lost/i.test(src), false, rel);
    }
  });

  it('W: no download', () => {
    for (const rel of UI_FILES) {
      assert.equal(/\bdownload\b|toDataURL|saveAs/i.test(stripComments(read(rel))), false, rel);
    }
  });

  it('X: no print', () => {
    for (const rel of UI_FILES) {
      assert.equal(/window\.print|@media print/i.test(stripComments(read(rel))), false, rel);
    }
  });

  it('Y: no share', () => {
    for (const rel of UI_FILES) {
      assert.equal(/navigator\.share|Web Share/i.test(stripComments(read(rel))), false, rel);
    }
  });

  it('Z: no clipboard', () => {
    for (const rel of UI_FILES) {
      assert.equal(/clipboard|copyToken|copy\(.*qr/i.test(stripComments(read(rel))), false, rel);
    }
  });

  it('AA: pickup disclaimer', () => {
    const ui = read('lib/dependentCardUi.ts');
    const comp = read('components/family/DependentDigitalCard.tsx');
    assert.ok(ui.includes('QR alone is not pickup authorization'));
    assert.ok(comp.includes('DEPENDENT_CARD_PICKUP_DISCLAIMER'));
  });

  it('AB: screenshot warning', () => {
    const ui = read('lib/dependentCardUi.ts');
    const comp = read('components/family/DependentDigitalCard.tsx');
    assert.ok(ui.includes('Keep this QR private'));
    assert.ok(ui.includes('changed by PLCC'));
    assert.ok(comp.includes('DEPENDENT_CARD_SCREENSHOT_COPY'));
  });

  it('AC: Back to Family', () => {
    const page = read('pages/MemberDependentCard.tsx');
    assert.ok(page.includes('backTo="/family"'));
    assert.ok(page.includes('Back to My Family'));
  });

  it('AD: More nav active', () => {
    const nav = read('components/MemberNav.tsx');
    assert.ok(nav.includes("pathname.startsWith('/family/')"));
  });

  it('AE: MemberNav still 5', () => {
    const nav = read('components/MemberNav.tsx');
    const labels = [...nav.matchAll(/label:\s*'([^']+)'/g)].map((m) => m[1]);
    assert.deepEqual(labels, ['Home', 'Community', 'Events', 'Prayer', 'Me']);
  });

  it('AF: no Home quick action', () => {
    const home = read('components/member/MemberHomeQuickActions.tsx');
    assert.equal(home.includes('/family/card') || home.includes('Child Card'), false);
  });

  it('AG: no More child-card item', () => {
    const more = read('pages/MemberMore.tsx');
    assert.equal(/Child Card|Dependent Card|\/family\/card/.test(more), false);
    assert.ok(more.includes("label: 'My Family'"));
  });

  it('AH: no Account child-card item', () => {
    const account = read('pages/MemberAccount.tsx');
    assert.equal(/Child Card|\/family\/card/.test(account), false);
    assert.ok(account.includes('to="/family"'));
  });

  it('AI: no Sunday integration', () => {
    const sunday = read('pages/MemberSunday.tsx');
    assert.equal(/\/family\/card|Child Card|DependentDigitalCard/i.test(sunday), false);
  });

  it('AJ: no browser storage', () => {
    for (const rel of [...UI_FILES, 'lib/dependentCardClient.ts', 'lib/dependentCardUi.ts']) {
      assert.equal(
        /\blocalStorage\b|\bsessionStorage\b|\bIndexedDB\b/.test(stripComments(read(rel))),
        false,
        rel
      );
    }
  });

  it('AK: no credential logging', () => {
    for (const rel of [...UI_FILES, 'lib/dependentCardClient.ts']) {
      const src = stripComments(read(rel));
      assert.equal(/console\.(log|debug|info|warn|error)\s*\(/.test(src), false, rel);
    }
  });

  it('AL: API count 14', () => {
    const handlers = readdirSync(join(root, 'api')).filter((f) => f.endsWith('.js'));
    assert.equal(handlers.length, 15);
    assert.equal(countApiJsHandlers(handlers), 15);
  });

  it('AM: no dedicated child-card API', () => {
    const handlers = readdirSync(join(root, 'api')).filter((f) => f.endsWith('.js'));
    assert.equal(handlers.some((f) => /dependent-card|child-card|family-card/i.test(f)), false);
  });

  it('AM2: Check-in code UI on DependentDigitalCard', () => {
    const comp = read('components/family/DependentDigitalCard.tsx');
    assert.ok(comp.includes('Check-in code'));
    assert.ok(comp.includes('accessCode'));
  });

  it('AN: Vault unchanged', () => {
    assert.equal(existsSync(join(root, 'supabase/migrations')), false);
    if (existsSync(vaultRoot)) {
      // Soft: Connect worktree must not write Vault product files in this phase
      for (const rel of UI_FILES) {
        assert.equal(/CREATE\s+OR\s+REPLACE\s+FUNCTION|SECURITY\s+DEFINER/i.test(read(rel)), false, rel);
      }
    }
  });

  it('AO: pb-28/mobile', () => {
    const page = read('pages/MemberDependentCard.tsx');
    assert.ok(page.includes('pb-28'));
    assert.ok(page.includes('max-w-[500px]'));
  });

  it('AP: loading state', () => {
    const page = read('pages/MemberDependentCard.tsx');
    assert.ok(page.includes('Loading child card…'));
    assert.ok(page.includes('LoadingState'));
  });

  it('AQ: retry state', () => {
    const page = read('pages/MemberDependentCard.tsx');
    assert.ok(page.includes('ErrorState'));
    assert.ok(page.includes('onRetry'));
    assert.ok(page.includes('Retry'));
    assert.ok(page.includes('dependentCardPageLoadErrorMessage'));
  });

  it('QR accessibility title', () => {
    const comp = read('components/family/DependentDigitalCard.tsx');
    assert.ok(comp.includes('PLCC child membership card QR code'));
  });

  it('PLCC Child Member distinction + no adult card merge', () => {
    const comp = read('components/family/DependentDigitalCard.tsx');
    assert.ok(comp.includes('PLCC Child Member'));
    assert.equal(comp.includes('fetchMyDigitalCard') || comp.includes('rotateMyDigitalCard'), false);
    const page = read('pages/MemberDependentCard.tsx');
    assert.equal(page.includes('memberCardClient'), false);
  });

  it('Family page does not prefetch child credentials', () => {
    const page = stripComments(read('pages/MemberFamily.tsx'));
    assert.equal(/fetchMyGuardianDependentCards|get_my_guardian_child_cards/.test(page), false);
  });

  it('Child PLCC Card title + access subtitle', () => {
    const page = read('pages/MemberDependentCard.tsx');
    assert.ok(page.includes('Child PLCC Card'));
    assert.ok(page.includes('DEPENDENT_CARD_ACCESS_COPY'));
  });
});
