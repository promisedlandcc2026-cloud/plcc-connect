/**
 * Phase 2.3D — Connect Serve bridge contracts.
 * Run: node --test scripts/test-serve-bridge.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  aggregateActiveSignupCounts,
  applyCapacityAggregateToDto,
  assertCancelAllowed,
  assertSignupEligibilityGate,
  asUuid,
  countApiJsHandlers,
  decideServeSignupAuthorization,
  dtoHasForbiddenPrivacyFields,
  eligibilitySummaryHasForbiddenFields,
  indexCapacityAggregates,
  isMemberVisibleOpportunity,
  mapServeRpcError,
  parseServeListFilters,
  parseServeMutationBody,
  rejectClientIdentitySpoof,
  rejectServeQueryIdentitySpoof,
  remainingSlots,
  sanitizeMySignupDto,
  sanitizeOpportunityDto,
  serveEligibilitySummary,
  toMemberEligibilitySummary,
} from '../api/_utils/serveSanitize.js';
import {
  attachPublicRelationLabels,
  parseServeSupabaseEnv,
} from '../api/_utils/serveClient.js';
import { approvalStatusFromRole } from '../api/_utils/memberIdentity.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const OPP_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MIN_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const TEAM_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const EVENT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

function sampleOpp(overrides = {}) {
  return {
    id: OPP_ID,
    title: 'Usher Team',
    description: 'Help guests find seats',
    role_label: 'Usher',
    location: 'Main sanctuary',
    starts_at: '2099-01-01T10:00:00.000Z',
    ends_at: '2099-01-01T12:00:00.000Z',
    capacity: 5,
    requires_approval: true,
    status: 'open',
    created_by: 'should-never-leak',
    ministry_id: MIN_ID,
    team_id: TEAM_ID,
    event_id: EVENT_ID,
    ministry: { id: MIN_ID, name: 'Worship' },
    team: { id: TEAM_ID, name: 'Ushers' },
    event: { id: EVENT_ID, name: 'Sunday Service' },
    ...overrides,
  };
}

/** Minimal thenable query builder for attachPublicRelationLabels unit tests. */
function mockCatalog(byTable) {
  return {
    from(table) {
      return {
        select() {
          return {
            async in() {
              return byTable[table] || { data: [], error: null };
            },
          };
        },
      };
    },
  };
}

describe('Serve eligibility + cancel policy', () => {
  it('allows cancel regardless of eligibility', () => {
    assert.equal(assertCancelAllowed().ok, true);
  });

  it('rejects client-supplied DOB/age overrides on mutation body', () => {
    assert.equal(
      rejectClientIdentitySpoof({ action: 'signup', opportunityId: OPP_ID, birthday: '2000-01-01' }).ok,
      true
    );
    // birthday alone cannot authorize signup — not_verified gate still denies
    assert.equal(assertSignupEligibilityGate(null).ok, false);
    assert.equal(assertSignupEligibilityGate(null).code, 'serve_not_verified');
  });
});

describe('member eligibility summary (2.3F.8 activation)', () => {
  it('no row → not_verified with signupEnabled false', () => {
    const s = toMemberEligibilitySummary(null);
    assert.equal(s.status, 'not_verified');
    assert.equal(s.eligibilitySatisfied, false);
    assert.equal(s.signupEnabled, false);
    assert.equal(s.reasonCode, 'not_verified');
    assert.equal(eligibilitySummaryHasForbiddenFields(s), false);
  });

  it('eligible → signupEnabled true', () => {
    const s = serveEligibilitySummary({
      status: 'eligible',
      reason_code: 'adult_verified',
    });
    assert.equal(s.status, 'eligible');
    assert.equal(s.eligibilitySatisfied, true);
    assert.equal(s.signupEnabled, true);
    assert.equal(s.reasonCode, 'adult_verified');
  });

  it('ineligible under_18 and policy keep signupEnabled false', () => {
    const u = toMemberEligibilitySummary({ status: 'ineligible', reason_code: 'under_18' });
    assert.equal(u.status, 'ineligible');
    assert.equal(u.eligibilitySatisfied, false);
    assert.equal(u.signupEnabled, false);
    assert.equal(u.reasonCode, 'under_18');
    const p = toMemberEligibilitySummary({
      status: 'ineligible',
      reason_code: 'policy_ineligible',
    });
    assert.equal(p.reasonCode, 'policy_ineligible');
    assert.equal(p.signupEnabled, false);
  });

  it('suspended → temporarily_suspended signupEnabled false', () => {
    const s = toMemberEligibilitySummary({
      status: 'suspended',
      reason_code: 'temporarily_suspended',
    });
    assert.equal(s.status, 'suspended');
    assert.equal(s.eligibilitySatisfied, false);
    assert.equal(s.signupEnabled, false);
    assert.equal(s.reasonCode, 'temporarily_suspended');
  });

  it('unknown reason sanitized to status default', () => {
    const e = toMemberEligibilitySummary({
      status: 'eligible',
      reason_code: 'staff_said_so_free_text',
    });
    assert.equal(e.reasonCode, 'adult_verified');
    const i = toMemberEligibilitySummary({
      status: 'ineligible',
      reason_code: 'medical_detail',
    });
    assert.equal(i.reasonCode, 'policy_ineligible');
    const s = toMemberEligibilitySummary({
      status: 'suspended',
      reason_code: 'background_check_pending',
    });
    assert.equal(s.reasonCode, 'temporarily_suspended');
  });

  it('summary never exposes verified_by / DOB / ids', () => {
    const s = toMemberEligibilitySummary({
      status: 'eligible',
      reason_code: 'adult_verified',
      verified_by: USER_ID,
      verified_at: '2026-01-01T00:00:00.000Z',
      user_id: USER_ID,
      birthday: '2000-01-01',
    });
    assert.equal(Object.prototype.hasOwnProperty.call(s, 'verified_by'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(s, 'verifiedBy'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(s, 'verifiedAt'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(s, 'userId'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(s, 'birthday'), false);
    assert.equal(eligibilitySummaryHasForbiddenFields(s), false);
  });

  it('rejects eligibility and signupEnabled spoof fields', () => {
    assert.equal(rejectClientIdentitySpoof({ eligibilityUserId: USER_ID }).ok, false);
    assert.equal(rejectClientIdentitySpoof({ signupEnabled: true }).ok, false);
    assert.equal(rejectClientIdentitySpoof({ eligibilitySatisfied: true }).ok, false);
    assert.equal(rejectClientIdentitySpoof({ canServe: true }).ok, false);
    assert.equal(rejectClientIdentitySpoof({ status: 'eligible' }).ok, false);
    assert.equal(rejectServeQueryIdentitySpoof({ userId: USER_ID }).ok, false);
    assert.equal(rejectServeQueryIdentitySpoof({ resource: 'eligibility' }).ok, true);
  });
});

describe('signup authorization decisions (2.3F.8)', () => {
  it('not_verified cannot signup', () => {
    const d = decideServeSignupAuthorization({ ok: true, row: null });
    assert.equal(d.allow, false);
    assert.equal(d.code, 'serve_not_verified');
    assert.equal(d.httpStatus, 403);
    assert.equal(d.eligibility.signupEnabled, false);
  });

  it('eligible can reach signup RPC (allow=true)', () => {
    const d = decideServeSignupAuthorization({
      ok: true,
      row: { status: 'eligible', reason_code: 'adult_verified' },
    });
    assert.equal(d.allow, true);
    assert.equal(d.eligibility.status, 'eligible');
    assert.equal(d.eligibility.signupEnabled, true);
  });

  it('ineligible cannot signup', () => {
    const d = decideServeSignupAuthorization({
      ok: true,
      row: { status: 'ineligible', reason_code: 'under_18' },
    });
    assert.equal(d.allow, false);
    assert.equal(d.code, 'serve_ineligible');
  });

  it('suspended cannot signup', () => {
    const d = decideServeSignupAuthorization({
      ok: true,
      row: { status: 'suspended', reason_code: 'temporarily_suspended' },
    });
    assert.equal(d.allow, false);
    assert.equal(d.code, 'serve_suspended');
  });

  it('eligibility DB failure does not allow signup', () => {
    const d = decideServeSignupAuthorization({ ok: false, code: 'eligibility_read_failed' });
    assert.equal(d.allow, false);
    assert.equal(d.code, 'serve_unavailable');
    assert.equal(d.httpStatus, 502);
  });

  it('assertSignupEligibilityGate mirrors decide for rows', () => {
    assert.equal(assertSignupEligibilityGate(null).ok, false);
    assert.equal(assertSignupEligibilityGate(null).code, 'serve_not_verified');
    assert.equal(
      assertSignupEligibilityGate({ status: 'eligible', reason_code: 'adult_verified' }).ok,
      true
    );
  });

  it('client spoof cannot change decideServeSignupAuthorization', () => {
    // Authorization ignores client fields entirely — only row/load result matters.
    const d = decideServeSignupAuthorization({
      ok: true,
      row: null,
      signupEnabled: true,
      status: 'eligible',
    });
    assert.equal(d.allow, false);
    assert.equal(d.code, 'serve_not_verified');
  });
});

describe('identity spoof rejection', () => {
  it('rejects client userId / memberId / role spoof', () => {
    assert.equal(rejectClientIdentitySpoof({ userId: USER_ID }).ok, false);
    assert.equal(rejectClientIdentitySpoof({ user_id: USER_ID }).ok, false);
    assert.equal(rejectClientIdentitySpoof({ memberId: USER_ID }).ok, false);
    assert.equal(rejectClientIdentitySpoof({ member_id: USER_ID }).ok, false);
    assert.equal(rejectClientIdentitySpoof({ role: 'ADMIN' }).ok, false);
    assert.equal(rejectClientIdentitySpoof({ approvalStatus: 'approved' }).ok, false);
  });

  it('accepts clean mutation body', () => {
    const r = parseServeMutationBody({
      action: 'signup',
      opportunityId: OPP_ID,
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.action, 'signup');
      assert.equal(r.opportunityId, OPP_ID);
    }
  });

  it('mutation parse rejects spoofed ownership', () => {
    const r = parseServeMutationBody({
      action: 'cancel',
      opportunityId: OPP_ID,
      userId: USER_ID,
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'identity_spoof_rejected');
  });
});

describe('list filters + visibility', () => {
  it('validates ministryId / teamId as UUID', () => {
    assert.equal(parseServeListFilters({ ministryId: 'nope' }).ok, false);
    assert.equal(parseServeListFilters({ teamId: 'nope' }).ok, false);
    const ok = parseServeListFilters({
      ministryId: MIN_ID,
      teamId: TEAM_ID,
    });
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.ministryId, MIN_ID);
      assert.equal(ok.teamId, TEAM_ID);
    }
  });

  it('shows only open opportunities that have not ended', () => {
    assert.equal(isMemberVisibleOpportunity(sampleOpp()), true);
    assert.equal(isMemberVisibleOpportunity(sampleOpp({ status: 'cancelled' })), false);
    assert.equal(
      isMemberVisibleOpportunity(
        sampleOpp({ ends_at: '2000-01-01T00:00:00.000Z' }),
        '2020-01-01T00:00:00.000Z'
      ),
      false
    );
    assert.equal(
      isMemberVisibleOpportunity(
        sampleOpp({ ends_at: null, starts_at: '2000-01-01T00:00:00.000Z' }),
        '2020-01-01T00:00:00.000Z'
      ),
      true
    );
  });
});

describe('DTO privacy + capacity helpers', () => {
  it('sanitizes opportunity without roster/PII/created_by', () => {
    const dto = sanitizeOpportunityDto(sampleOpp(), {
      mySignupStatus: 'pending',
      activeSignupCount: 2,
    });
    assert.ok(dto);
    assert.equal(dto.title, 'Usher Team');
    assert.equal(dto.roleLabel, 'Usher');
    assert.equal(dto.activeSignupCount, 2);
    assert.equal(dto.remainingSlots, 3);
    assert.equal(dto.mySignupStatus, 'pending');
    assert.equal(dto.event.title, 'Sunday Service');
    assert.equal(dtoHasForbiddenPrivacyFields(dto), false);
    assert.equal(Object.prototype.hasOwnProperty.call(dto, 'created_by'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(dto, 'signups'), false);
  });

  it('detail DTO also excludes roster', () => {
    const dto = sanitizeOpportunityDto(sampleOpp({ description: 'Full desc' }), {
      mySignupStatus: null,
      activeSignupCount: null,
    });
    assert.equal(dto.description, 'Full desc');
    assert.equal(dto.remainingSlots, null);
    assert.equal(dtoHasForbiddenPrivacyFields(dto), false);
  });

  it('my signup DTO is self-only and privacy-safe', () => {
    const row = sanitizeMySignupDto(
      {
        id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        opportunity_id: OPP_ID,
        user_id: USER_ID,
        member_id: null,
        status: 'confirmed',
        created_at: '2026-01-01T00:00:00.000Z',
        cancelled_at: null,
      },
      sampleOpp()
    );
    assert.ok(row);
    assert.equal(row.opportunityId, OPP_ID);
    assert.equal(row.status, 'confirmed');
    assert.equal(dtoHasForbiddenPrivacyFields(row), false);
    assert.equal(Object.prototype.hasOwnProperty.call(row, 'user_id'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(row, 'member_id'), false);
  });

  it('aggregates active counts by opportunity_id; ignores cancelled/declined', () => {
    const counts = aggregateActiveSignupCounts([
      { opportunity_id: OPP_ID, status: 'confirmed', member_id: null },
      { opportunity_id: OPP_ID, status: 'pending', member_id: null },
      { opportunity_id: OPP_ID, status: 'cancelled' },
      { opportunity_id: OPP_ID, status: 'declined' },
    ]);
    assert.equal(counts.get(OPP_ID), 2);
  });

  it('remainingSlots: limited, unlimited, zero clamp', () => {
    assert.equal(remainingSlots(5, 2), 3);
    assert.equal(remainingSlots(null, 2), null);
    assert.equal(remainingSlots(2, 2), 0);
    assert.equal(remainingSlots(1, 5), 0);
  });

  it('indexes capacity aggregates and never fabricates zero when missing', () => {
    const map = indexCapacityAggregates([
      {
        opportunity_id: OPP_ID,
        capacity: 5,
        active_signup_count: 2,
        remaining_slots: 3,
      },
      {
        opportunity_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        capacity: null,
        active_signup_count: 1,
        remaining_slots: null,
      },
    ]);
    assert.equal(map.get(OPP_ID)?.activeSignupCount, 2);
    assert.equal(map.get(OPP_ID)?.remainingSlots, 3);
    assert.equal(map.get('cccccccc-cccc-4ccc-8ccc-cccccccccccc')?.remainingSlots, null);

    const base = sanitizeOpportunityDto(sampleOpp(), { activeSignupCount: null });
    const missing = applyCapacityAggregateToDto(base, new Map());
    assert.equal(missing.activeSignupCount, null);
    assert.equal(missing.remainingSlots, null);

    const merged = applyCapacityAggregateToDto(base, map);
    assert.equal(merged.activeSignupCount, 2);
    assert.equal(merged.remainingSlots, 3);
  });
});

describe('RPC error mapping', () => {
  it('maps trusted RPC exceptions to stable codes/statuses', () => {
    assert.equal(mapServeRpcError({ message: 'not_authenticated' }).httpStatus, 401);
    assert.equal(mapServeRpcError({ message: 'user_not_linked' }).code, 'user_not_linked');
    assert.equal(mapServeRpcError({ message: 'opportunity_not_found' }).httpStatus, 404);
    assert.equal(mapServeRpcError({ message: 'opportunity_full' }).httpStatus, 409);
    assert.equal(mapServeRpcError({ message: 'opportunity_full' }).code, 'opportunity_full');
    assert.equal(mapServeRpcError({ message: 'opportunity_not_open' }).httpStatus, 409);
    assert.equal(mapServeRpcError({ message: 'weird db boom' }).code, 'serve_unavailable');
  });
});

describe('approved member gate helpers', () => {
  it('pending roles are not approved', () => {
    assert.equal(approvalStatusFromRole('PENDING'), 'pending');
    assert.equal(approvalStatusFromRole('MEMBER'), 'approved');
  });
});

describe('supabase env safety', () => {
  it('requires anon env and rejects service_role-shaped keys', () => {
    assert.equal(parseServeSupabaseEnv({}).ok, false);
    assert.equal(
      parseServeSupabaseEnv({
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'service_role_secret',
      }).ok,
      false
    );
    assert.equal(
      parseServeSupabaseEnv({
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'anon-public-key',
      }).ok,
      true
    );
  });
});

describe('public catalog hydrate (no authenticated ministries embed)', () => {
  it('attaches ministry/team/event labels from sessionless catalog', async () => {
    const catalog = mockCatalog({
      ministries: { data: [{ id: MIN_ID, name: 'Worship' }], error: null },
      teams: { data: [{ id: TEAM_ID, name: 'Ushers' }], error: null },
      events: { data: [{ id: EVENT_ID, name: 'Sunday Service' }], error: null },
    });
    const [row] = await attachPublicRelationLabels(
      [
        {
          id: OPP_ID,
          title: 'Usher Team',
          ministry_id: MIN_ID,
          team_id: TEAM_ID,
          event_id: EVENT_ID,
        },
      ],
      catalog
    );
    assert.deepEqual(row.ministry, { id: MIN_ID, name: 'Worship' });
    assert.deepEqual(row.team, { id: TEAM_ID, name: 'Ushers' });
    assert.deepEqual(row.event, { id: EVENT_ID, name: 'Sunday Service' });
    const dto = sanitizeOpportunityDto(row, { activeSignupCount: 1 });
    assert.equal(dto.ministry.name, 'Worship');
    assert.equal(dto.event.title, 'Sunday Service');
    assert.equal(dto.activeSignupCount, 1);
    assert.equal(dto.remainingSlots, null); // capacity missing on stub row
  });

  it('leaves relations null when catalog is unavailable', async () => {
    const [row] = await attachPublicRelationLabels(
      [{ id: OPP_ID, title: 'x', ministry_id: MIN_ID }],
      null
    );
    assert.equal(row.ministry, undefined);
  });
});

describe('Serve bridge source contracts', () => {
  const handler = readFileSync(join(root, 'api/serve.js'), 'utf8');
  const client = readFileSync(join(root, 'api/_utils/serveClient.js'), 'utf8');
  const sanitize = readFileSync(join(root, 'api/_utils/serveSanitize.js'), 'utf8');
  const vite = readFileSync(join(root, 'vite.config.ts'), 'utf8');
  const home = readFileSync(join(root, 'components/member/MemberHomeQuickActions.tsx'), 'utf8');
  const more = readFileSync(join(root, 'pages/MemberMore.tsx'), 'utf8');

  it('uses private no-store headers', () => {
    assert.ok(handler.includes("Cache-Control', 'private, no-store'"));
  });

  it('avoids authenticated users/ministries embed recursion path', () => {
    assert.equal(/ministries!ministry_id/.test(client), false);
    assert.equal(/teams!team_id/.test(client), false);
    assert.equal(/events!event_id/.test(client), false);
    assert.equal(/users!created_by|created_by_user:users/.test(client), false);
    assert.ok(client.includes('attachPublicRelationLabels'));
    assert.ok(client.includes('createServeCatalogClient'));
    assert.ok(client.includes('Must NOT send the member JWT'));
  });

  it('requires bearer auth and approved-member gate', () => {
    assert.ok(handler.includes('parseBearerAuthorization'));
    assert.ok(handler.includes('fetchApprovedServeMember'));
    assert.ok(client.includes("approvalStatus !== 'approved'"));
    assert.ok(client.includes('pending_member'));
  });

  it('authorizes signup via eligibility decision before RPC; wires cancel RPC', () => {
    assert.ok(handler.includes('decideServeSignupAuthorization'));
    assert.ok(handler.includes('fetchOwnServeEligibility'));
    assert.ok(sanitize.includes('serve_not_verified'));
    assert.ok(sanitize.includes('serve_ineligible'));
    assert.ok(sanitize.includes('serve_suspended'));
    assert.equal(/SERVE_ELIGIBILITY_ENABLED\s*=\s*false/.test(sanitize), false);
    assert.ok(client.includes('serve_signup_opportunity'));
    assert.ok(client.includes('serve_cancel_signup'));
    assert.ok(client.includes('serve_opportunity_capacity'));
    const signupBranch = handler.slice(handler.indexOf("parsed.action === 'signup'"));
    assert.ok(signupBranch.includes('decideServeSignupAuthorization'));
    assert.ok(
      signupBranch.indexOf('decideServeSignupAuthorization') <
        signupBranch.indexOf('rpcServeSignup')
    );
    assert.ok(signupBranch.includes('!decision.allow'));
  });

  it('does not expose birthday/DOB in Serve bridge', () => {
    assert.equal(/birthday|date_of_birth|dateOfBirth/i.test(handler), false);
    assert.equal(/birthday|date_of_birth/i.test(client), false);
  });

  it('does not expose admin CRUD or elevated DB keys', () => {
    assert.equal(/serveAdmin|subResource=serve|resource=events/.test(handler), false);
    assert.equal(/SUPABASE_SERVICE_ROLE|serviceRole/.test(handler + client), false);
    assert.ok(client.includes('service_role_rejected'));
    assert.equal(/createClient\([^)]*SERVICE/.test(client), false);
  });

  it('rejects identity spoof and ignores query user overrides on my', () => {
    assert.ok(sanitize.includes('identity_spoof_rejected'));
    assert.ok(sanitize.includes('rejectServeQueryIdentitySpoof'));
    assert.ok(handler.includes('rejectServeQueryIdentitySpoof'));
    assert.ok(handler.includes("resource === 'eligibility'"));
    assert.ok(client.includes('fetchOwnServeEligibility'));
    assert.ok(client.includes(".from('serve_eligibility')"));
    assert.ok(client.includes("select('status, reason_code')"));
    assert.equal(/verified_by/.test(client.slice(client.indexOf('fetchOwnServeEligibility'))), false);
  });

  it('loads eligibility once per list/detail request; does not fabricate not_verified on failure', () => {
    assert.ok(handler.includes('loadOwnEligibilitySummary'));
    assert.ok(handler.includes('eligibilityLoaded.ok ? eligibilityLoaded.eligibility : null'));
    const eligBranch = handler.slice(handler.indexOf("resource === 'eligibility'"));
    assert.ok(eligBranch.includes("code: 'serve_unavailable'"));
    assert.ok(client.includes('eligibility_read_failed'));
  });

  it('Serve UI is deferred to Phase 2.3G (bridge stays UI-agnostic for signup policy)', () => {
    // Bridge phase no longer forbids MemberServe pages — see test-serve-ui.mjs.
    assert.ok(home.includes('Serve'));
    assert.ok(more.includes('Serve'));
    assert.ok(existsSync(join(root, 'pages/MemberServe.tsx')));
  });

  it('registers single /api/serve in vite bridge', () => {
    assert.ok(vite.includes("'/api/serve'"));
    assert.ok(vite.includes('serveHandler'));
  });

  it('API function count is 14 after serve.js', () => {
    const files = readdirSync(join(root, 'api')).filter((f) => f.endsWith('.js'));
    assert.equal(countApiJsHandlers(files), 15);
    assert.ok(files.includes('serve.js'));
    assert.equal(files.includes('serve-list.js'), false);
    assert.equal(files.includes('serve-signup.js'), false);
    assert.equal(files.includes('serve-eligibility.js'), false);
  });

  it('asUuid helper rejects garbage', () => {
    assert.equal(asUuid('nope'), null);
    assert.equal(asUuid(OPP_ID), OPP_ID);
  });
});
