/**
 * Phase 2.3G — Member Serve UI contracts.
 * Run: node --test scripts/test-serve-ui.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countApiJsHandlers } from '../api/_utils/serveSanitize.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asUuid(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return UUID_RE.test(t) ? t : null;
}

function remainingLabel(remainingSlots) {
  if (remainingSlots == null) return 'Open availability';
  const n = Number(remainingSlots);
  if (!Number.isFinite(n) || n <= 0) return 'Full';
  if (n === 1) return '1 spot left';
  return `${Math.trunc(n)} spots left`;
}

function showSignup(eligibility, opportunity) {
  if (!eligibility || !opportunity) return false;
  if (!eligibility.signupEnabled || eligibility.status !== 'eligible') return false;
  const mine = String(opportunity.mySignupStatus || '').toLowerCase();
  if (mine === 'pending' || mine === 'confirmed') return false;
  if (opportunity.remainingSlots === 0) return false;
  return true;
}

function showCancel(status) {
  const s = String(status || '').toLowerCase();
  return s === 'pending' || s === 'confirmed';
}

function mapError(code) {
  switch (String(code || '')) {
    case 'serve_not_verified':
      return 'Your Serve eligibility has not been verified yet.';
    case 'serve_ineligible':
      return 'You are not currently eligible for Serve self-signup.';
    case 'serve_suspended':
      return 'Your Serve self-signup is temporarily suspended.';
    case 'opportunity_full':
      return 'This opportunity just filled up.';
    case 'opportunity_not_open':
      return 'This opportunity is no longer open.';
    case 'serve_unavailable':
      return 'Serve is temporarily unavailable. Please try again.';
    default:
      return 'Serve is temporarily unavailable. Please try again.';
  }
}

const eligible = {
  status: 'eligible',
  signupEnabled: true,
};
const notVerified = {
  status: 'not_verified',
  signupEnabled: false,
};
const ineligible = {
  status: 'ineligible',
  signupEnabled: false,
};
const suspended = {
  status: 'suspended',
  signupEnabled: false,
};

describe('Serve UI pure helpers', () => {
  it('formats capacity from API remainingSlots only', () => {
    assert.equal(remainingLabel(null), 'Open availability');
    assert.equal(remainingLabel(0), 'Full');
    assert.equal(remainingLabel(1), '1 spot left');
    assert.equal(remainingLabel(3), '3 spots left');
  });

  it('hides signup for not_verified / ineligible / suspended', () => {
    const open = { mySignupStatus: null, remainingSlots: 2 };
    assert.equal(showSignup(notVerified, open), false);
    assert.equal(showSignup(ineligible, open), false);
    assert.equal(showSignup(suspended, open), false);
    assert.equal(showSignup(eligible, open), true);
  });

  it('shows signup for eligible without active signup', () => {
    assert.equal(showSignup(eligible, { mySignupStatus: null, remainingSlots: null }), true);
    assert.equal(showSignup(eligible, { mySignupStatus: 'pending', remainingSlots: 2 }), false);
    assert.equal(showSignup(eligible, { mySignupStatus: 'confirmed', remainingSlots: 2 }), false);
    assert.equal(showSignup(eligible, { mySignupStatus: null, remainingSlots: 0 }), false);
  });

  it('cancel available regardless of eligibility', () => {
    assert.equal(showCancel('pending'), true);
    assert.equal(showCancel('confirmed'), true);
    assert.equal(showCancel('cancelled'), false);
    assert.equal(showCancel('declined'), false);
  });

  it('maps member-safe API error codes', () => {
    assert.match(mapError('serve_not_verified'), /not been verified/);
    assert.match(mapError('serve_ineligible'), /not currently eligible/);
    assert.match(mapError('serve_suspended'), /temporarily suspended/);
    assert.match(mapError('opportunity_full'), /just filled up/);
    assert.equal(mapError('opportunity_not_open'), 'This opportunity is no longer open.');
    assert.match(mapError('serve_unavailable'), /temporarily unavailable/);
  });

  it('signup request body excludes ownership / eligibility fields', () => {
    const body = { action: 'signup', opportunityId: '11111111-1111-4111-8111-111111111111' };
    assert.deepEqual(Object.keys(body).sort(), ['action', 'opportunityId']);
    assert.equal('userId' in body, false);
    assert.equal('memberId' in body, false);
    assert.equal('eligibility' in body, false);
    assert.equal('status' in body, false);
    assert.equal('capacity' in body, false);
    assert.equal('role' in body, false);
  });

  it('sanitizes ministryId / teamId UUIDs', () => {
    assert.equal(asUuid('nope'), null);
    assert.equal(asUuid('11111111-1111-4111-8111-111111111111'), '11111111-1111-4111-8111-111111111111');
  });
});

describe('Serve routes + gating', () => {
  it('registers /serve, /serve/my, /serve/:id behind approved_member MemberGate', () => {
    const app = readFileSync(join(root, 'App.tsx'), 'utf8');
    assert.ok(app.includes('path="/serve"'));
    assert.ok(app.includes('path="/serve/my"'));
    assert.ok(app.includes('path="/serve/:id"'));
    assert.ok(app.includes('MemberServePage'));
    assert.ok(app.includes('MemberServeMyPage'));
    assert.ok(app.includes('MemberServeDetailPage'));
    assert.ok(app.indexOf('path="/serve/my"') < app.indexOf('path="/serve/:id"'));
    const serveBlock = app.slice(app.indexOf('path="/serve"'), app.indexOf('path="/serve/:id"') + 200);
    assert.ok(serveBlock.includes('requireAccess="approved_member"'));
  });

  it('MemberNav stays five items without Serve tab', () => {
    const nav = readFileSync(join(root, 'components/MemberNav.tsx'), 'utf8');
    assert.ok(nav.includes("label: 'Home'"));
    assert.ok(nav.includes("label: 'Me'"));
    assert.equal(nav.includes("label: 'Serve'"), false);
  });
});

describe('Serve pages + privacy', () => {
  it('directory uses opportunities resource and capacity/eligibility helpers', () => {
    const page = readFileSync(join(root, 'pages/MemberServe.tsx'), 'utf8');
    const client = readFileSync(join(root, 'lib/serveClient.ts'), 'utf8');
    assert.ok(existsSync(join(root, 'pages/MemberServe.tsx')));
    assert.ok(page.includes('fetchServeOpportunities'));
    assert.ok(page.includes('ServeEligibilityNotice'));
    assert.ok(page.includes('Loading Serve opportunities'));
    assert.ok(page.includes('No Serve opportunities are open right now'));
    assert.ok(client.includes("resource: 'opportunities'") || client.includes('resource=opportunities'));
    assert.ok(client.includes('ministryId'));
    assert.ok(client.includes('teamId'));
  });

  it('detail wires signup/cancel without spoof fields; handles full/closed', () => {
    const detail = readFileSync(join(root, 'pages/MemberServeDetail.tsx'), 'utf8');
    const ui = readFileSync(join(root, 'lib/serveUi.ts'), 'utf8');
    assert.ok(detail.includes('postServeSignup'));
    assert.ok(detail.includes('Sign Up to Serve'));
    assert.ok(detail.includes('Cancel Signup'));
    assert.ok(detail.includes('Are you sure you want to cancel this Serve signup?'));
    assert.ok(detail.includes('signed up'));
    assert.ok(detail.includes('Signup submitted'));
    assert.ok(ui.includes('This opportunity just filled up.'));
    assert.ok(ui.includes('This opportunity is no longer open.'));
    assert.equal(detail.includes('verified_by'), false);
    assert.equal(detail.includes('date_of_birth'), false);
    assert.equal(detail.includes('dateOfBirth'), false);
    assert.equal(detail.includes('roster'), false);
  });

  it('My Serving renders commitments without eligibility gate on list', () => {
    const my = readFileSync(join(root, 'pages/MemberServeMy.tsx'), 'utf8');
    assert.ok(my.includes('fetchMyServing'));
    assert.ok(my.includes("You haven't signed up to serve yet."));
    assert.ok(my.includes('Cancel Signup'));
    assert.ok(my.includes('Pending Approval'));
    assert.ok(my.includes('signupStatusLabel'));
    assert.equal(my.includes('if (!eligibility.signupEnabled) return'), false);
  });

  it('client signup POST only sends action + opportunityId', () => {
    const client = readFileSync(join(root, 'lib/serveClient.ts'), 'utf8');
    const signupFn = client.slice(client.indexOf('export async function postServeSignup'));
    const bodyLine = signupFn.match(/JSON\.stringify\(\{[\s\S]*?\}\)/);
    assert.ok(bodyLine);
    assert.ok(bodyLine[0].includes("action: 'signup'"));
    assert.ok(bodyLine[0].includes('opportunityId'));
    assert.equal(bodyLine[0].includes('userId'), false);
    assert.equal(bodyLine[0].includes('memberId'), false);
    assert.equal(bodyLine[0].includes('eligibility'), false);
    assert.equal(bodyLine[0].includes('capacity'), false);
    assert.equal(bodyLine[0].includes('verified_by'), false);
    assert.equal(bodyLine[0].includes('date_of_birth'), false);
  });

  it('eligibility notice copy covers eligible / not_verified / blocked', () => {
    const notice = readFileSync(join(root, 'components/serve/ServeEligibilityNotice.tsx'), 'utf8');
    const ui = readFileSync(join(root, 'lib/serveUi.ts'), 'utf8');
    assert.ok(ui.includes('verified to serve'));
    assert.ok(ui.includes('has not been reviewed yet'));
    assert.ok(ui.includes('Contact church leadership'));
    assert.ok(ui.includes('limited to verified adult members'));
    assert.ok(ui.includes('temporarily suspended'));
    assert.ok(notice.includes('eligibilityNoticeCopy'));
  });

  it('does not expose roster / DOB / verifiedBy in Serve UI sources', () => {
    const files = [
      'pages/MemberServe.tsx',
      'pages/MemberServeDetail.tsx',
      'pages/MemberServeMy.tsx',
      'lib/serveClient.ts',
      'lib/serveUi.ts',
      'components/serve/ServeOpportunityCard.tsx',
      'components/serve/ServeEligibilityNotice.tsx',
    ];
    for (const f of files) {
      const src = readFileSync(join(root, f), 'utf8');
      assert.equal(
        /verifiedBy|verified_by|dateOfBirth|date_of_birth|rosterMembers|signupRoster/i.test(src),
        false,
        f
      );
    }
  });
});

describe('Home / More / Hub integration', () => {
  it('Home Serve Quick Action routes to /serve', () => {
    const home = readFileSync(join(root, 'components/member/MemberHomeQuickActions.tsx'), 'utf8');
    assert.ok(home.includes("to: '/serve'"));
    assert.ok(home.includes("label: 'Serve'"));
    assert.ok(home.includes('prefetchServeChunks'));
    assert.ok(home.includes("to: '/card'"));
    assert.ok(home.includes("label: 'My Card'"));
  });

  it('More Serve + My Serving are active routes', () => {
    const more = readFileSync(join(root, 'pages/MemberMore.tsx'), 'utf8');
    assert.ok(more.includes("to: '/serve'"));
    assert.ok(more.includes("to: '/serve/my'"));
    assert.ok(more.includes("label: 'Serve'"));
    assert.ok(more.includes("label: 'My Serving'"));
  });

  it('Ministry Hub filters Serve by ministryId UUID', () => {
    const hub = readFileSync(join(root, 'pages/MemberMinistryHub.tsx'), 'utf8');
    assert.ok(hub.includes('Serve with this ministry'));
    assert.ok(hub.includes('/serve?ministryId='));
    assert.ok(hub.includes('ministry.id'));
    assert.equal(hub.includes('Serve opportunities coming soon'), false);
  });

  it('visitor PublicHome unchanged (no Serve routes)', () => {
    const home = readFileSync(join(root, 'components/Home.tsx'), 'utf8');
    assert.ok(home.includes('PublicHome'));
    assert.equal(home.includes('/serve'), false);
    const candidates = [
      'components/PublicHome.tsx',
      'components/home/PublicHome.tsx',
      'pages/PublicHome.tsx',
    ];
    for (const rel of candidates) {
      const p = join(root, rel);
      if (!existsSync(p)) continue;
      const src = readFileSync(p, 'utf8');
      assert.equal(src.includes('/serve'), false, rel);
    }
  });
});

describe('API surface unchanged', () => {
  it('API function count remains 14; no new serve API files', () => {
    const files = readdirSync(join(root, 'api')).filter((f) => f.endsWith('.js'));
    assert.equal(countApiJsHandlers(files), 15);
    assert.ok(files.includes('serve.js'));
    assert.equal(files.includes('serve-list.js'), false);
    assert.equal(files.includes('serve-signup.js'), false);
  });
});
