/**
 * Phase 2.0 — member shell path + staff Vault link contracts.
 * Run: node --test scripts/test-member-shell.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// memberShell is TypeScript — assert via source contracts + duplicated pure logic below
// (Vite app has no compiled lib for node:test). Keep logic mirrored for regression.

function isCommunityMemberPath(pathname) {
  return pathname === '/community' || pathname.startsWith('/community/');
}

const AUTH_EXACT_PATHS = new Set([
  '/sign-in',
  '/auth/callback',
  '/account',
  '/community',
  '/notifications',
  '/prayer',
  '/events',
  '/more',
  '/ministries',
  '/serve',
  '/sunday',
  '/notes',
  '/card',
  '/family',
  '/kids-plans',
  '/my-attendance',
]);

function isMinistryHubPath(pathname) {
  return pathname === '/ministries' || pathname.startsWith('/ministries/');
}

function isServePath(pathname) {
  return pathname === '/serve' || pathname.startsWith('/serve/');
}

function isSundayPath(pathname) {
  return pathname === '/sunday' || pathname.startsWith('/sunday/');
}

function isNotesPath(pathname) {
  return pathname === '/notes' || pathname.startsWith('/notes/');
}

function isCardPath(pathname) {
  return pathname === '/card' || pathname.startsWith('/card/');
}

function isFamilyHuddleGuestJoinPath(pathname) {
  return pathname === '/family/huddle/join';
}

function isFamilyPath(pathname) {
  if (isFamilyHuddleGuestJoinPath(pathname)) return false;
  return pathname === '/family' || pathname.startsWith('/family/');
}

function isKidsPlansPath(pathname) {
  return pathname === '/kids-plans' || pathname.startsWith('/kids-plans/');
}

function isAuthShellPath(pathname) {
  if (AUTH_EXACT_PATHS.has(pathname)) return true;
  if (isMinistryHubPath(pathname)) return true;
  if (isServePath(pathname)) return true;
  if (isSundayPath(pathname)) return true;
  if (isNotesPath(pathname)) return true;
  if (isCardPath(pathname)) return true;
  if (isFamilyPath(pathname)) return true;
  if (isKidsPlansPath(pathname)) return true;
  return isCommunityMemberPath(pathname);
}

function isMemberNavPath(pathname) {
  if (
    pathname === '/account' ||
    pathname === '/notifications' ||
    pathname === '/prayer' ||
    pathname === '/events' ||
    pathname === '/more' ||
    pathname === '/ministries' ||
    pathname === '/sunday' ||
    pathname === '/card' ||
    pathname === '/family' ||
    pathname === '/kids-plans' ||
    pathname === '/my-attendance'
  ) {
    return true;
  }
  if (isMinistryHubPath(pathname)) return true;
  if (isServePath(pathname)) return true;
  if (isSundayPath(pathname)) return true;
  if (isNotesPath(pathname)) return true;
  if (isCardPath(pathname)) return true;
  if (isFamilyPath(pathname)) return true;
  if (isKidsPlansPath(pathname)) return true;
  return isCommunityMemberPath(pathname);
}

function shouldShowMemberNav(pathname, opts) {
  if (isMemberNavPath(pathname)) return true;
  if (pathname === '/' && opts.hasSeenSplash && opts.isApprovedMember) return true;
  return false;
}

function shouldHidePublicBottomNav(pathname, opts) {
  if (opts.isWelcomeScreen) return true;
  if (isFamilyHuddleGuestJoinPath(pathname)) return true;
  if (isAuthShellPath(pathname)) return true;
  if (pathname === '/' && opts.hasSeenSplash && opts.isApprovedMember) return true;
  return false;
}

const VAULT_STAFF_ROLES = new Set([
  'SUPER_ADMIN',
  'PASTOR',
  'MINISTRY_LEADER',
  'FINANCE',
  'MEDIA_TEAM',
  'ADMIN_STAFF',
  'STAFF',
  'SECRETARY',
  'ASST_SECRETARY',
  'FIRST_LADY',
  'ADMIN',
]);

function canOpenVaultStaffLink(role) {
  if (!role) return false;
  return VAULT_STAFF_ROLES.has(String(role).trim().toUpperCase());
}

describe('member shell path helpers', () => {
  it('classifies community nested paths', () => {
    assert.equal(isCommunityMemberPath('/community'), true);
    assert.equal(isCommunityMemberPath('/community/chat'), true);
    assert.equal(isCommunityMemberPath('/community/post/abc'), true);
    assert.equal(isCommunityMemberPath('/prayer'), false);
  });

  it('treats prayer/events/more/ministries/serve/sunday/notes/card/family as auth shell + member nav', () => {
    for (const p of [
      '/prayer',
      '/events',
      '/more',
      '/ministries',
      '/ministries/events',
      '/serve',
      '/serve/my',
      '/serve/11111111-1111-4111-8111-111111111111',
      '/sunday',
      '/notes',
      '/notes/new',
      '/notes/11111111-1111-4111-8111-111111111111',
      '/card',
      '/family',
      '/kids-plans',
    ]) {
      assert.equal(isAuthShellPath(p), true, p);
      assert.equal(isMemberNavPath(p), true, p);
    }
  });

  it('excludes public Family Huddle guest join from member shell nav', () => {
    assert.equal(isFamilyPath('/family/huddle/join'), false);
    assert.equal(isMemberNavPath('/family/huddle/join'), false);
    assert.equal(isAuthShellPath('/family/huddle/join'), false);
    assert.equal(
      shouldHidePublicBottomNav('/family/huddle/join', {
        isWelcomeScreen: false,
        isApprovedMember: false,
        hasSeenSplash: true,
      }),
      true
    );
  });

  it('shows MemberNav on Home only for approved members after splash', () => {
    assert.equal(
      shouldShowMemberNav('/', { isApprovedMember: true, hasSeenSplash: true }),
      true
    );
    assert.equal(
      shouldShowMemberNav('/', { isApprovedMember: false, hasSeenSplash: true }),
      false
    );
    assert.equal(
      shouldShowMemberNav('/', { isApprovedMember: true, hasSeenSplash: false }),
      false
    );
  });

  it('hides public BottomNav for approved members on Home', () => {
    assert.equal(
      shouldHidePublicBottomNav('/', {
        isWelcomeScreen: false,
        isApprovedMember: true,
        hasSeenSplash: true,
      }),
      true
    );
    assert.equal(
      shouldHidePublicBottomNav('/', {
        isWelcomeScreen: false,
        isApprovedMember: false,
        hasSeenSplash: true,
      }),
      false
    );
  });
});

describe('staff Vault link', () => {
  it('allows leadership roles and denies ordinary members', () => {
    assert.equal(canOpenVaultStaffLink('PASTOR'), true);
    assert.equal(canOpenVaultStaffLink('STAFF'), true);
    assert.equal(canOpenVaultStaffLink('MEMBER'), false);
    assert.equal(canOpenVaultStaffLink('PARENT'), false);
    assert.equal(canOpenVaultStaffLink(null), false);
  });
});

describe('Foundation source contracts', () => {
  it('MemberNav uses Home · Community · Events · Prayer · Me', () => {
    const src = readFileSync(join(root, 'components/MemberNav.tsx'), 'utf8');
    assert.ok(src.includes("label: 'Home'"));
    assert.ok(src.includes("label: 'Community'"));
    assert.ok(src.includes("label: 'Prayer'"));
    assert.ok(src.includes("label: 'Events'"));
    assert.ok(src.includes("label: 'Me'"));
    assert.equal(src.includes("label: 'Feed'"), false);
    assert.equal(src.includes("label: 'Chat'"), false);
    assert.equal(src.includes("label: 'Alerts'"), false);
  });

  it('App registers prayer/events/more/ministries/serve/sunday/notes/card/family behind MemberGate', () => {
    const src = readFileSync(join(root, 'App.tsx'), 'utf8');
    assert.ok(src.includes('path="/prayer"'));
    assert.ok(src.includes('path="/events"'));
    assert.ok(src.includes('path="/more"'));
    assert.ok(src.includes('path="/ministries"'));
    assert.ok(src.includes('path="/ministries/:slug"'));
    assert.ok(src.includes('path="/serve"'));
    assert.ok(src.includes('path="/serve/my"'));
    assert.ok(src.includes('path="/serve/:id"'));
    assert.ok(src.includes('path="/sunday"'));
    assert.ok(src.includes('path="/notes"'));
    assert.ok(src.includes('path="/notes/new"'));
    assert.ok(src.includes('path="/notes/:id"'));
    assert.ok(src.includes('path="/card"'));
    assert.ok(src.includes('path="/family"'));
    assert.ok(src.includes('path="/family/card/:cardRef"'));
    assert.ok(src.includes('path="/family/huddle/join"'));
    assert.ok(src.includes('FamilyHuddleJoinPage'));
    assert.ok(src.includes('path="/kids-plans"'));
    assert.ok(src.includes('MemberKidsPlansPage'));
    assert.ok(src.includes('path="/my-attendance"'));
    assert.ok(src.includes('MemberPrayerPage'));
    assert.ok(src.includes('MemberEventsPage'));
    assert.ok(src.includes('MemberMorePage'));
    assert.ok(src.includes('MemberMinistriesPage'));
    assert.ok(src.includes('MemberServePage'));
    assert.ok(src.includes('MemberSundayPage'));
    assert.ok(src.includes('MemberNotesPage'));
    assert.ok(src.includes('MemberCardPage'));
    assert.ok(src.includes('MemberFamilyPage'));
    assert.ok(src.includes('MemberDependentCardPage'));
    assert.ok(src.includes('shouldShowMemberNav'));
  });

  it('memberShell + staffVaultAccess modules exist with expected exports', () => {
    const shell = readFileSync(join(root, 'lib/memberShell.ts'), 'utf8');
    const staff = readFileSync(join(root, 'lib/staffVaultAccess.ts'), 'utf8');
    assert.ok(shell.includes('export function shouldShowMemberNav'));
    assert.ok(shell.includes('export function shouldHidePublicBottomNav'));
    assert.ok(staff.includes('export function canOpenVaultStaffLink'));
    assert.ok(staff.includes('VAULT_PUBLIC_ORIGIN'));
  });
});
