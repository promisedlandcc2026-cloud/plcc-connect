/**
 * Member experience shell helpers — path classification for Connect 2.0 Foundation.
 * Keeps App chrome logic (MemberNav vs public BottomNav) in one place.
 */

const AUTH_EXACT_PATHS = new Set([
  '/sign-in',
  '/auth/callback',
  '/auth/sso',
  '/account',
  '/community',
  '/notifications',
  '/prayer',
  '/events',
  '/more',
  '/me',
  '/ministries',
  '/serve',
  '/sunday',
  '/notes',
  '/card',
  '/family',
  '/kids-plans',
  '/my-attendance',
  '/profile',
  '/directory',
  '/scan-in',
  '/intercessors',
]);

export function isServePath(pathname: string): boolean {
  return pathname === '/serve' || pathname.startsWith('/serve/');
}

export function isSundayPath(pathname: string): boolean {
  return pathname === '/sunday' || pathname.startsWith('/sunday/');
}

export function isNotesPath(pathname: string): boolean {
  return pathname === '/notes' || pathname.startsWith('/notes/');
}

export function isCardPath(pathname: string): boolean {
  return pathname === '/card' || pathname.startsWith('/card/');
}

export function isFamilyPath(pathname: string): boolean {
  if (isFamilyHuddleGuestJoinPath(pathname)) return false;
  return pathname === '/family' || pathname.startsWith('/family/');
}

export function isKidsPlansPath(pathname: string): boolean {
  return pathname === '/kids-plans' || pathname.startsWith('/kids-plans/');
}

/** Public "add the app to your phone" guide — full screen, no nav or assistant on top of the steps. */
export function isInstallGuidePath(pathname: string): boolean {
  return pathname === '/install';
}

/** Public guest invite redeem — no MemberGate / MemberNav. */
export function isFamilyHuddleGuestJoinPath(pathname: string): boolean {
  return pathname === '/family/huddle/join';
}

export function isCommunityMemberPath(pathname: string): boolean {
  return pathname === '/community' || pathname.startsWith('/community/');
}

export function isMinistryHubPath(pathname: string): boolean {
  return pathname === '/ministries' || pathname.startsWith('/ministries/');
}

/** Routes that use the member auth shell (no public BottomNav / assistant chrome). */
export function isAuthShellPath(pathname: string): boolean {
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

/** Primary member destinations that always show MemberNav when mounted. */
export function isMemberNavPath(pathname: string): boolean {
  if (
    pathname === '/account' ||
    pathname === '/notifications' ||
    pathname === '/prayer' ||
    pathname === '/events' ||
    pathname === '/more' ||
    pathname === '/me' ||
    pathname === '/ministries' ||
    pathname === '/sunday' ||
    pathname === '/card' ||
    pathname === '/family' ||
    pathname === '/kids-plans' ||
    pathname === '/my-attendance' ||
    pathname === '/profile' ||
    pathname === '/directory' ||
    pathname === '/scan-in' ||
    pathname === '/intercessors'
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

/**
 * Approved members get MemberNav on Home as well (visitor BottomNav stays for everyone else).
 */
export function shouldShowMemberNav(
  pathname: string,
  opts: { isApprovedMember: boolean; hasSeenSplash: boolean }
): boolean {
  if (isMemberNavPath(pathname)) return true;
  if (pathname === '/' && opts.hasSeenSplash && opts.isApprovedMember) return true;
  return false;
}

/** Hide visitor BottomNav on auth shell routes and on Home for approved members. */
export function shouldHidePublicBottomNav(
  pathname: string,
  opts: { isWelcomeScreen: boolean; isApprovedMember: boolean; hasSeenSplash: boolean }
): boolean {
  if (opts.isWelcomeScreen) return true;
  if (isFamilyHuddleGuestJoinPath(pathname)) return true;
  if (isInstallGuidePath(pathname)) return true;
  if (isAuthShellPath(pathname)) return true;
  if (pathname === '/' && opts.hasSeenSplash && opts.isApprovedMember) return true;
  return false;
}

/** PLCC Assistant stays on public Home for visitors; hide on auth/member feature routes. */
export function shouldHideAssistant(
  pathname: string,
  opts: { isWelcomeScreen: boolean }
): boolean {
  if (opts.isWelcomeScreen) return true;
  if (isFamilyHuddleGuestJoinPath(pathname)) return true;
  if (isInstallGuidePath(pathname)) return true;
  return isAuthShellPath(pathname);
}
