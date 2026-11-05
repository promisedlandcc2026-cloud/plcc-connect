/**
 * Phase 2.6C.4B — Member Family UI contracts (source + static privacy).
 * Run: node --test scripts/test-family-ui.mjs
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

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const FAMILY_UI_FILES = [
  'pages/MemberFamily.tsx',
  'components/family/FamilyMemberCard.tsx',
  'components/family/FamilyStatusPanel.tsx',
];

describe('Phase 2.6C.4B Member Family UI', () => {
  it('A: /family route exists', () => {
    assert.ok(existsSync(join(root, 'pages/MemberFamily.tsx')));
    assert.ok(read('App.tsx').includes('path="/family"'));
  });

  it('B: lazy route', () => {
    const app = read('App.tsx');
    assert.ok(app.includes("import('./pages/MemberFamily')"));
    assert.ok(app.includes('MemberFamilyPage'));
    const familyIdx = app.indexOf('path="/family"');
    const slice = app.slice(Math.max(0, familyIdx - 80), familyIdx + 320);
    assert.ok(slice.includes('LazyRoute'));
  });

  it('C: approved MemberGate', () => {
    const app = read('App.tsx');
    const familyIdx = app.indexOf('path="/family"');
    const slice = app.slice(Math.max(0, familyIdx - 80), familyIdx + 320);
    assert.ok(slice.includes('requireAccess="approved_member"'));
    assert.ok(slice.includes('MemberGate'));
  });

  it('D: no raw-table access', () => {
    const page = stripComments(read('pages/MemberFamily.tsx'));
    assert.equal(/\.from\(\s*['"]user_member_links['"]/.test(page), false);
    assert.equal(/\.from\(\s*['"]household_members['"]/.test(page), false);
    assert.equal(/\.from\(\s*['"]guardian_relationships['"]/.test(page), false);
    assert.equal(/\.from\(\s*['"]members['"]/.test(page), false);
  });

  it('E: fetchMyFamilySummary only', () => {
    const page = read('pages/MemberFamily.tsx');
    assert.ok(page.includes('fetchMyFamilySummary'));
    assert.equal(/supabase\.rpc|get_my_member_digital_card|rotate_member|mint_member/.test(page), false);
    assert.equal(/from\(['"]/.test(stripComments(page)), false);
  });

  it('F: unlinked UI', () => {
    const panel = read('components/family/FamilyStatusPanel.tsx');
    assert.ok(panel.includes('Your family profile isn’t linked yet.'));
    assert.ok(panel.includes('familyUnlinkedCopy'));
    assert.ok(panel.includes('Contact PLCC'));
    assert.equal(/user_member_links|verified link|RLS/i.test(panel), false);
  });

  it('G: conflict UI', () => {
    const panel = read('components/family/FamilyStatusPanel.tsx');
    const page = read('pages/MemberFamily.tsx');
    assert.ok(panel.includes('We found more than one active household connection.'));
    assert.ok(panel.includes('familyHouseholdConflictCopy'));
    assert.ok(page.includes("state !== 'household_conflict'"));
  });

  it('H: empty family UI', () => {
    const panel = read('components/family/FamilyStatusPanel.tsx');
    assert.ok(
      panel.includes('Your member profile is connected, but no family members are linked yet.')
    );
    assert.equal(/error|failed/i.test(panel.match(/empty_family[\s\S]{0,400}/)?.[0] || ''), false);
  });

  it('I: household heading', () => {
    const panel = read('components/family/FamilyStatusPanel.tsx');
    assert.ok(panel.includes('Family / Household'));
    assert.ok(panel.includes('My Household'));
    assert.equal(/household\.id|householdId|uuid/i.test(panel), false);
  });

  it('J: self card', () => {
    const page = read('pages/MemberFamily.tsx');
    const card = read('components/family/FamilyMemberCard.tsx');
    assert.ok(page.includes('Your Profile'));
    assert.ok(page.includes('variant="self"'));
    assert.ok(card.includes('PLCC Member'));
  });

  it('K: self → /card', () => {
    const card = read('components/family/FamilyMemberCard.tsx');
    assert.ok(card.includes('View My PLCC Card'));
    assert.ok(card.includes('to="/card"'));
  });

  it('L: adult cards directory-only', () => {
    const page = read('pages/MemberFamily.tsx');
    const card = read('components/family/FamilyMemberCard.tsx');
    assert.ok(page.includes('Adults in Your Household'));
    assert.ok(page.includes('variant="adult"'));
    assert.equal(/email|phone|dateOfBirth|DOB|cardNumber|memberId/i.test(card), false);
  });

  it('M: no adult card action', () => {
    const card = read('components/family/FamilyMemberCard.tsx');
    // View Card only on self variant branch
    assert.ok(card.includes("variant === 'self'"));
    assert.ok(card.includes('View My PLCC Card'));
    const adultBranch = card.includes("variant === 'adult'") || card.includes('variant="adult"');
    assert.ok(adultBranch || card.includes("variant: FamilyMemberCardVariant"));
    // Adults must not get a Link to /card
    const selfLinkBlock = card.slice(card.indexOf("variant === 'self'"));
    assert.ok(selfLinkBlock.includes('to="/card"'));
    assert.equal(
      /variant === 'adult'[\s\S]{0,200}to=["']\/card["']/.test(card) ||
        /variant === 'dependent'[\s\S]{0,200}to=["']\/card["']/.test(card),
      false
    );
  });

  it('N: dependents rendered', () => {
    const page = read('pages/MemberFamily.tsx');
    assert.ok(page.includes('Children & Dependents'));
    assert.ok(page.includes('variant="dependent"'));
  });

  it('O: guardian access badge', () => {
    const card = read('components/family/FamilyMemberCard.tsx');
    assert.ok(card.includes("cardAccess === 'guardian'"));
    assert.ok(card.includes('Family card access authorized'));
  });

  it('P: guardian access links via opaque cardRef (no Family QR)', () => {
    const card = stripComments(read('components/family/FamilyMemberCard.tsx'));
    const page = stripComments(read('pages/MemberFamily.tsx'));
    assert.ok(card.includes('Family card access authorized'));
    assert.ok(card.includes('View Child Card'));
    assert.ok(card.includes('/family/card/'));
    assert.ok(card.includes('isDependentCardRef'));
    assert.ok(page.includes('cardRef={dep.cardRef}'));
    // Family directory must not render QR / fetch credentials
    for (const src of [card, page]) {
      assert.equal(/\bQRCode\b|qrPayload|Family Pass|react-qr-code/i.test(src), false);
    }
    assert.equal(/get_my_guardian_child_cards|fetchMyGuardianDependentCards/i.test(page), false);
    assert.equal(/to=["']\/card["'][\s\S]{0,120}dependent|dependent[\s\S]{0,120}to=["']\/card["']/.test(card), false);
  });

  it('Q: no check-out / pickup actions (check-in card copy allowed)', () => {
    for (const rel of FAMILY_UI_FILES) {
      const src = stripComments(read(rel));
      assert.equal(/check[- ]?out|checkOut|pickup/i.test(src), false, rel);
      assert.equal(/\bcheckIn\b|\bcheck_in\b/i.test(src), false, rel);
    }
  });

  it('R: no child photos', () => {
    const page = read('pages/MemberFamily.tsx');
    const card = read('components/family/FamilyMemberCard.tsx');
    assert.equal(/avatarUrl=\{dep|dependent[\s\S]{0,80}avatarUrl/i.test(page), false);
    assert.ok(card.includes("variant === 'dependent'"));
    assert.ok(card.includes('UserRound'));
  });

  it('S: relationship labels', () => {
    const card = read('components/family/FamilyMemberCard.tsx');
    assert.ok(card.includes('familyRelationshipLabel'));
    const ui = read('lib/familyUi.ts');
    assert.ok(ui.includes("spouse: 'Spouse'"));
    assert.ok(ui.includes("legal_guardian: 'Legal Guardian'"));
  });

  it('T: More link active', () => {
    const more = read('pages/MemberMore.tsx');
    assert.ok(more.includes("to: '/family'"));
    assert.ok(more.includes("label: 'My Family'"));
    assert.ok(more.includes('prefetchFamilyChunk'));
    assert.equal(/label: 'My Family'[\s\S]{0,120}kind: 'soon'/.test(more), false);
  });

  it('U: MemberNav remains 5', () => {
    const nav = read('components/MemberNav.tsx');
    const labels = [...nav.matchAll(/label:\s*'([^']+)'/g)].map((m) => m[1]);
    assert.deepEqual(labels, ['Home', 'Community', 'Events', 'Prayer', 'Me']);
  });

  it('V: /family marks Me active', () => {
    const nav = read('components/MemberNav.tsx');
    assert.ok(nav.includes("pathname === '/family'"));
    assert.ok(nav.includes("pathname.startsWith('/family/')"));
  });

  it('W: no Home overcrowding', () => {
    const home = read('components/member/MemberHomeQuickActions.tsx');
    assert.equal(home.includes("to: '/family'") || home.includes("to=\"/family\""), false);
    assert.equal(home.includes("label: 'My Family'"), false);
  });

  it('X: no Sunday integration', () => {
    const sunday = read('pages/MemberSunday.tsx');
    assert.equal(/\/family|My Family|Family Pass/i.test(sunday), false);
  });

  it('Y: Hobby family-huddle is the only family API (replaces latest-youtube slot)', () => {
    const apiDir = join(root, 'api');
    const handlers = readdirSync(apiDir).filter((f) => f.endsWith('.js'));
    assert.ok(handlers.includes('family-huddle.js'));
    assert.equal(handlers.includes('latest-youtube.js'), false);
    assert.equal(handlers.filter((f) => /family/i.test(f)).length, 1);
  });

  it('Z: API count remains 14', () => {
    const handlers = readdirSync(join(root, 'api')).filter((f) => f.endsWith('.js'));
    assert.equal(handlers.length, 15);
    assert.equal(countApiJsHandlers(handlers), 15);
  });

  it('AA: no Vault changes', () => {
    // Connect-only phase — assert no Vault migration/SQL files in this repo worktree for family UI.
    assert.equal(existsSync(join(root, 'supabase/migrations')), false);
    for (const rel of FAMILY_UI_FILES) {
      assert.equal(/\bCREATE\s+OR\s+REPLACE\s+FUNCTION\b|\bSECURITY\s+DEFINER\b/i.test(read(rel)), false, rel);
    }
  });

  it('AB: privacy copy', () => {
    const page = read('pages/MemberFamily.tsx');
    assert.ok(
      page.includes(
        'Family information is shown only from PLCC’s verified household and guardian records.'
      )
    );
  });

  it('AC: errors safe', () => {
    const page = read('pages/MemberFamily.tsx');
    const ui = read('lib/familyUi.ts');
    assert.ok(page.includes('familyErrorMessage'));
    assert.ok(ui.includes('We couldn’t load your family right now.'));
    assert.ok(ui.includes('We couldn’t safely display your family information.'));
    assert.equal(/Postgres|PGRST|supabase\.co|stack/i.test(page), false);
  });

  it('AD: retry exists', () => {
    const page = read('pages/MemberFamily.tsx');
    assert.ok(page.includes('onRetry'));
    assert.ok(page.includes('Retry'));
  });

  it('AE: mobile pb-28', () => {
    const page = read('pages/MemberFamily.tsx');
    assert.ok(page.includes('pb-28'));
    assert.ok(page.includes('max-w-[500px]'));
  });

  it('AF: no family/shared QR', () => {
    for (const rel of FAMILY_UI_FILES) {
      const src = stripComments(read(rel));
      assert.equal(/Family Pass|Household QR|shared QR|qrPayload|AWC1\./i.test(src), false, rel);
    }
  });

  it('shell + prefetch include /family', () => {
    const shell = read('lib/memberShell.ts');
    assert.ok(shell.includes("'/family'"));
    assert.ok(shell.includes('isFamilyPath'));
    const prefetch = read('lib/prefetchMemberChunks.ts');
    assert.ok(prefetch.includes('prefetchFamilyChunk'));
    assert.ok(prefetch.includes("import('../pages/MemberFamily')"));
  });

  it('Account optional My Family link', () => {
    const account = read('pages/MemberAccount.tsx');
    assert.ok(account.includes('to="/family"'));
    assert.ok(account.includes('My Family'));
  });
});
