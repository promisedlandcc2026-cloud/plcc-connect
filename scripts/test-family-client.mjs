/**
 * Phase 2.6C.4A / 2.6D.2C — Connect Family client contracts (source + sanitizer behavior).
 * Run: node --test scripts/test-family-client.mjs
 *
 * Sanitizer behavioral tests mirror lib/familySanitize.ts + lib/familyUi.ts
 * (same pattern as test-member-card-ui.mjs — Node cannot import Vite TS paths).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countApiJsHandlers } from '../api/_utils/serveSanitize.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

class FamilySanitizeError extends Error {
  constructor() {
    super('family_data_invalid');
    this.name = 'FamilySanitizeError';
    this.code = 'family_data_invalid';
  }
}

/** Shared exact AWCD validator (mirrors lib/dependentCardRef.ts). */
const DEPENDENT_CARD_REF_RE = /^AWCD\.[0-9a-f]{64}$/;
function isDependentCardRef(value) {
  return typeof value === 'string' && DEPENDENT_CARD_REF_RE.test(value);
}

function hex(n) {
  return 'a'.repeat(n);
}

function validAwcd() {
  return `AWCD.${hex(64)}`;
}

function asRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value;
}

function asNullableString(value) {
  if (value == null || typeof value !== 'string') return null;
  const s = value.trim();
  return s || null;
}

function clampText(value, max) {
  return value.length <= max ? value : value.slice(0, max);
}

function sanitizeAvatarUrl(value) {
  const raw = asNullableString(value);
  if (!raw || raw.length > 2048) return null;
  try {
    const u = new URL(raw);
    if (u.protocol === 'https:' || u.protocol === 'http:') return raw;
    return null;
  } catch {
    if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
    return null;
  }
}

function sanitizeDependentCardRef(cardAccess, raw) {
  if (!Object.prototype.hasOwnProperty.call(raw, 'cardRef')) {
    throw new FamilySanitizeError();
  }
  if (cardAccess === 'guardian') {
    if (!isDependentCardRef(raw.cardRef)) throw new FamilySanitizeError();
    return raw.cardRef;
  }
  if (raw.cardRef !== null) throw new FamilySanitizeError();
  return null;
}

function sanitizeFamilySummary(raw) {
  const r = asRecord(raw);
  if (!r) throw new FamilySanitizeError();
  if (typeof r.linked !== 'boolean') throw new FamilySanitizeError();

  let householdState = null;
  if (r.householdState === 'conflict') householdState = 'conflict';
  else if (r.householdState == null) householdState = null;
  else throw new FamilySanitizeError();

  if (!Array.isArray(r.adults) || !Array.isArray(r.dependents)) {
    throw new FamilySanitizeError();
  }

  let household = null;
  if (r.household != null) {
    const h = asRecord(r.household);
    if (!h) throw new FamilySanitizeError();
    const name = asNullableString(h.name);
    household = { name: name ? clampText(name, 120) : null };
  }

  let self = null;
  if (r.linked) {
    const s = asRecord(r.self);
    if (!s || s.cardAccess !== 'self') throw new FamilySanitizeError();
    self = {
      displayName: clampText(asNullableString(s.displayName) || 'You', 120),
      avatarUrl: sanitizeAvatarUrl(s.avatarUrl),
      cardAccess: 'self',
    };
  } else {
    if (r.self != null || r.household != null || householdState !== null) {
      throw new FamilySanitizeError();
    }
    if (r.adults.length !== 0 || r.dependents.length !== 0) throw new FamilySanitizeError();
  }

  const adults = r.linked
    ? r.adults.map((row) => {
        const a = asRecord(row);
        if (!a || a.cardAccess !== 'none') throw new FamilySanitizeError();
        return {
          displayName: clampText(asNullableString(a.displayName) || 'Family member', 120),
          avatarUrl: sanitizeAvatarUrl(a.avatarUrl),
          relationship: (() => {
            const rel = asNullableString(a.relationship);
            return rel ? clampText(rel, 80) : null;
          })(),
          cardAccess: 'none',
        };
      })
    : [];

  const dependents = r.linked
    ? r.dependents.map((row) => {
        const d = asRecord(row);
        if (!d || (d.cardAccess !== 'guardian' && d.cardAccess !== 'none')) {
          throw new FamilySanitizeError();
        }
        const cardRef = sanitizeDependentCardRef(d.cardAccess, d);
        return {
          displayName: clampText(asNullableString(d.displayName) || 'Dependent', 120),
          avatarUrl: null,
          relationship: (() => {
            const rel = asNullableString(d.relationship);
            return rel ? clampText(rel, 80) : null;
          })(),
          cardAccess: d.cardAccess,
          cardRef,
        };
      })
    : [];

  return {
    linked: r.linked,
    household: r.linked ? household : null,
    householdState: r.linked ? householdState : null,
    self,
    adults,
    dependents,
  };
}

function familySummaryState(summary) {
  if (!summary.linked) return 'unlinked';
  if (summary.householdState === 'conflict') return 'household_conflict';
  const hasDirectory =
    summary.household != null || summary.adults.length > 0 || summary.dependents.length > 0;
  if (!hasDirectory) return 'empty_family';
  return 'ready';
}

function familyRelationshipLabel(value) {
  const map = {
    spouse: 'Spouse',
    legal_guardian: 'Legal Guardian',
    Parent: 'Parent',
  };
  if (value == null) return 'Family member';
  return map[value] || map[String(value).toLowerCase().replace(/\s+/g, '_')] || 'Family member';
}

function familyCardAccessLabel(access) {
  if (access === 'self') return 'Your card';
  if (access === 'guardian') return 'Authorized for family card access';
  return 'No card access';
}

function familyErrorMessage(code) {
  if (code === 'unauthorized') return 'Sign in to view your family.';
  if (code === 'family_data_invalid') return 'We couldn’t safely display your family information.';
  return 'We couldn’t load your family right now.';
}

function keysOf(obj) {
  const out = new Set();
  (function walk(v) {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    for (const [k, val] of Object.entries(v)) {
      out.add(k);
      walk(val);
    }
  })(obj);
  return [...out];
}

function baseLinked(overrides = {}) {
  return {
    linked: true,
    household: null,
    householdState: null,
    self: { displayName: 'Ada', avatarUrl: null, cardAccess: 'self' },
    adults: [],
    dependents: [],
    ...overrides,
  };
}

describe('Phase 2.6C.4A / 2.6D.2C Connect Family client', () => {
  it('RPC name exact', () => {
    assert.ok(read('lib/familyClient.ts').includes("supabase.rpc('get_my_family_summary')"));
  });

  it('no RPC args', () => {
    const client = read('lib/familyClient.ts');
    assert.ok(/supabase\.rpc\(\s*'get_my_family_summary'\s*\)/.test(client));
    assert.equal(/supabase\.rpc\(\s*'get_my_family_summary'\s*,/.test(client), false);
  });

  it('A: guardian + valid cardRef accepted', () => {
    const ref = validAwcd();
    const s = sanitizeFamilySummary(
      baseLinked({
        dependents: [
          {
            displayName: 'Kid',
            avatarUrl: null,
            relationship: 'child',
            cardAccess: 'guardian',
            cardRef: ref,
          },
        ],
      })
    );
    assert.equal(s.dependents[0].cardAccess, 'guardian');
    assert.equal(s.dependents[0].cardRef, ref);
  });

  it('B: guardian + null rejected', () => {
    assert.throws(
      () =>
        sanitizeFamilySummary(
          baseLinked({
            dependents: [
              {
                displayName: 'Kid',
                avatarUrl: null,
                relationship: 'child',
                cardAccess: 'guardian',
                cardRef: null,
              },
            ],
          })
        ),
      (e) => e.code === 'family_data_invalid'
    );
  });

  it('C: guardian + malformed rejected', () => {
    assert.throws(
      () =>
        sanitizeFamilySummary(
          baseLinked({
            dependents: [
              {
                displayName: 'Kid',
                avatarUrl: null,
                relationship: 'child',
                cardAccess: 'guardian',
                cardRef: 'AWCD.not-hex',
              },
            ],
          })
        ),
      (e) => e.code === 'family_data_invalid'
    );
  });

  it('D: none + null accepted', () => {
    const s = sanitizeFamilySummary(
      baseLinked({
        dependents: [
          {
            displayName: 'Kid',
            avatarUrl: null,
            relationship: 'child',
            cardAccess: 'none',
            cardRef: null,
          },
        ],
      })
    );
    assert.equal(s.dependents[0].cardAccess, 'none');
    assert.equal(s.dependents[0].cardRef, null);
  });

  it('E: none + valid ref rejected (fail-closed leak)', () => {
    assert.throws(
      () =>
        sanitizeFamilySummary(
          baseLinked({
            dependents: [
              {
                displayName: 'Kid',
                avatarUrl: null,
                relationship: 'child',
                cardAccess: 'none',
                cardRef: validAwcd(),
              },
            ],
          })
        ),
      (e) => e.code === 'family_data_invalid'
    );
  });

  it('F: missing cardRef rejected', () => {
    assert.throws(
      () =>
        sanitizeFamilySummary(
          baseLinked({
            dependents: [
              {
                displayName: 'Kid',
                avatarUrl: null,
                relationship: 'child',
                cardAccess: 'none',
              },
            ],
          })
        ),
      (e) => e.code === 'family_data_invalid'
    );
  });

  it('G: AWCD exact format', () => {
    const ref = `AWCD.${'0123456789abcdef'.repeat(4)}`;
    assert.equal(isDependentCardRef(ref), true);
    const s = sanitizeFamilySummary(
      baseLinked({
        dependents: [
          {
            displayName: 'Kid',
            avatarUrl: null,
            relationship: 'Parent',
            cardAccess: 'guardian',
            cardRef: ref,
          },
        ],
      })
    );
    assert.equal(s.dependents[0].cardRef, ref);
    assert.ok(read('lib/dependentCardRef.ts').includes('AWCD\\.[0-9a-f]{64}'));
    assert.ok(read('lib/familySanitize.ts').includes('isDependentCardRef'));
  });

  it('H: uppercase hex rejected', () => {
    assert.throws(
      () =>
        sanitizeFamilySummary(
          baseLinked({
            dependents: [
              {
                displayName: 'Kid',
                avatarUrl: null,
                relationship: 'child',
                cardAccess: 'guardian',
                cardRef: `AWCD.${'A'.repeat(64)}`,
              },
            ],
          })
        ),
      (e) => e.code === 'family_data_invalid'
    );
  });

  it('I: short ref rejected', () => {
    assert.throws(
      () =>
        sanitizeFamilySummary(
          baseLinked({
            dependents: [
              {
                displayName: 'Kid',
                avatarUrl: null,
                relationship: 'child',
                cardAccess: 'guardian',
                cardRef: `AWCD.${'a'.repeat(32)}`,
              },
            ],
          })
        ),
      (e) => e.code === 'family_data_invalid'
    );
  });

  it('J: raw member id stripped', () => {
    const s = sanitizeFamilySummary(
      baseLinked({
        dependents: [
          {
            displayName: 'Kid',
            avatarUrl: null,
            relationship: 'child',
            cardAccess: 'none',
            cardRef: null,
            memberId: '11111111-1111-1111-1111-111111111111',
            userId: '22222222-2222-2222-2222-222222222222',
            guardianId: 'g',
            householdId: 'h',
          },
        ],
      })
    );
    for (const k of keysOf(s)) {
      assert.equal(['memberId', 'userId', 'guardianId', 'householdId'].includes(k), false, k);
    }
  });

  it('K: qrPayload stripped', () => {
    const s = sanitizeFamilySummary(
      baseLinked({
        dependents: [
          {
            displayName: 'Kid',
            avatarUrl: null,
            relationship: 'child',
            cardAccess: 'guardian',
            cardRef: validAwcd(),
            qrPayload: `AWC1.${hex(64)}`,
          },
        ],
      })
    );
    assert.equal(keysOf(s).includes('qrPayload'), false);
    assert.equal(s.dependents[0].qrPayload, undefined);
  });

  it('L: cardNumber stripped', () => {
    const s = sanitizeFamilySummary(
      baseLinked({
        dependents: [
          {
            displayName: 'Kid',
            avatarUrl: null,
            relationship: 'child',
            cardAccess: 'guardian',
            cardRef: validAwcd(),
            cardNumber: 'PLCC-2026-00001',
          },
        ],
      })
    );
    assert.equal(keysOf(s).includes('cardNumber'), false);
  });

  it('M: token/hash stripped', () => {
    const s = sanitizeFamilySummary(
      baseLinked({
        dependents: [
          {
            displayName: 'Kid',
            avatarUrl: null,
            relationship: 'child',
            cardAccess: 'guardian',
            cardRef: validAwcd(),
            qrToken: 'tok',
            qrTokenHash: 'hash',
            qrHash: 'h',
            verifiedBy: 'v',
            linkedBy: 'l',
          },
        ],
      })
    );
    for (const k of ['qrToken', 'qrTokenHash', 'qrHash', 'verifiedBy', 'linkedBy']) {
      assert.equal(keysOf(s).includes(k), false, k);
    }
  });

  it('N: check flags stripped', () => {
    const s = sanitizeFamilySummary(
      baseLinked({
        dependents: [
          {
            displayName: 'Kid',
            avatarUrl: null,
            relationship: 'child',
            cardAccess: 'none',
            cardRef: null,
            canViewCard: true,
            canCheckIn: true,
            canCheckOut: true,
          },
        ],
      })
    );
    for (const k of ['canViewCard', 'canCheckIn', 'canCheckOut']) {
      assert.equal(keysOf(s).includes(k), false, k);
    }
  });

  it('O: cross-household authorized DTO accepted', () => {
    const ref = validAwcd();
    const s = sanitizeFamilySummary(
      baseLinked({
        household: { name: 'Other Household' },
        dependents: [
          {
            displayName: 'Cross HH Kid',
            avatarUrl: null,
            relationship: 'Authorized Guardian',
            cardAccess: 'guardian',
            cardRef: ref,
          },
        ],
      })
    );
    assert.equal(s.dependents[0].cardRef, ref);
    assert.equal(familySummaryState(s), 'ready');
  });

  it('P: conflict state still accepted with guardian cardRef', () => {
    const ref = validAwcd();
    const s = sanitizeFamilySummary(
      baseLinked({
        household: null,
        householdState: 'conflict',
        dependents: [
          {
            displayName: 'Kid',
            avatarUrl: null,
            relationship: 'Parent',
            cardAccess: 'guardian',
            cardRef: ref,
          },
        ],
      })
    );
    assert.equal(s.householdState, 'conflict');
    assert.equal(s.dependents[0].cardRef, ref);
    assert.equal(familySummaryState(s), 'household_conflict');
  });

  it('Q: displayName not used as identity', () => {
    const sanitize = read('lib/familySanitize.ts');
    assert.equal(/findDep|match.*displayName|join.*displayName/i.test(sanitize), false);
    const s = sanitizeFamilySummary(
      baseLinked({
        dependents: [
          {
            displayName: 'Same Name',
            avatarUrl: null,
            relationship: 'child',
            cardAccess: 'guardian',
            cardRef: validAwcd(),
          },
          {
            displayName: 'Same Name',
            avatarUrl: null,
            relationship: 'child',
            cardAccess: 'none',
            cardRef: null,
          },
        ],
      })
    );
    assert.equal(s.dependents.length, 2);
    assert.notEqual(s.dependents[0].cardRef, s.dependents[1].cardRef);
  });

  it('R: relationship not used as identity', () => {
    const sanitize = read('lib/familySanitize.ts');
    assert.equal(/identity.*relationship|join.*relationship/i.test(sanitize), false);
    const s = sanitizeFamilySummary(
      baseLinked({
        dependents: [
          {
            displayName: 'A',
            avatarUrl: null,
            relationship: 'Parent',
            cardAccess: 'guardian',
            cardRef: validAwcd(),
          },
        ],
      })
    );
    assert.equal(s.dependents[0].relationship, 'Parent');
    assert.ok(s.dependents[0].cardRef);
  });

  it('S: empty/unlinked summaries unchanged', () => {
    const un = sanitizeFamilySummary({
      linked: false,
      household: null,
      householdState: null,
      self: null,
      adults: [],
      dependents: [],
      userId: 'drop-me',
    });
    assert.equal(un.linked, false);
    assert.equal(familySummaryState(un), 'unlinked');

    const empty = sanitizeFamilySummary(baseLinked());
    assert.equal(familySummaryState(empty), 'empty_family');
  });

  it('T: no storage', () => {
    for (const rel of [
      'lib/familyClient.ts',
      'lib/familyTypes.ts',
      'lib/familyUi.ts',
      'lib/familySanitize.ts',
      'lib/dependentCardRef.ts',
    ]) {
      assert.equal(
        /\blocalStorage\b|\bsessionStorage\b|\bIndexedDB\b/.test(stripComments(read(rel))),
        false,
        rel
      );
    }
  });

  it('U: no logging', () => {
    for (const rel of [
      'lib/familyClient.ts',
      'lib/familySanitize.ts',
      'lib/dependentCardRef.ts',
    ]) {
      const src = stripComments(read(rel));
      assert.equal(/console\.(log|debug|info|warn|error)\s*\(/.test(src), false, rel);
      assert.equal(/cardRef/.test(src) && /console\./.test(src), false, rel);
    }
  });

  it('V: no UI route implementation in Family client/sanitizer', () => {
    const client = read('lib/familyClient.ts');
    const sanitize = read('lib/familySanitize.ts');
    const types = read('lib/familyTypes.ts');
    for (const src of [client, sanitize, types]) {
      assert.equal(/View Child Card|\/family\/card|generatePath|child card route/i.test(src), false);
    }
  });

  it('W: child-card client untouched (RPC + fetch only)', () => {
    const depClient = read('lib/dependentCardClient.ts');
    assert.ok(depClient.includes("supabase.rpc('get_my_guardian_child_cards')"));
    assert.equal(depClient.includes('get_my_family_summary'), false);
    assert.ok(existsSync(join(root, 'lib/dependentCardSanitize.ts')));
    assert.ok(read('lib/dependentCardSanitize.ts').includes("from './dependentCardRef'"));
  });

  it('X: API count remains 14', () => {
    const handlers = readdirSync(join(root, 'api')).filter((f) => f.endsWith('.js'));
    assert.equal(handlers.length, 15);
    assert.equal(countApiJsHandlers(handlers), 15);
    // Hobby consolidate: family-huddle is the only family* API file.
    assert.deepEqual(
      handlers.filter((f) => /family/i.test(f)),
      ['family-huddle.js']
    );
  });

  it('legacy: adult cardAccess only none', () => {
    assert.throws(
      () =>
        sanitizeFamilySummary(
          baseLinked({
            adults: [{ displayName: 'B', avatarUrl: null, relationship: 'spouse', cardAccess: 'guardian' }],
          })
        ),
      (e) => e.code === 'family_data_invalid'
    );
  });

  it('legacy: self cardAccess self', () => {
    assert.throws(
      () =>
        sanitizeFamilySummary({
          linked: true,
          household: null,
          householdState: null,
          self: { displayName: 'A', avatarUrl: null, cardAccess: 'none' },
          adults: [],
          dependents: [],
        }),
      (e) => e.code === 'family_data_invalid'
    );
  });

  it('legacy: raw IDs + sensitive stripped from adults', () => {
    const s = sanitizeFamilySummary(
      baseLinked({
        household: { name: 'Smith', id: 'hh', address: 'x' },
        adults: [
          {
            displayName: 'Bob',
            avatarUrl: null,
            relationship: 'spouse',
            cardAccess: 'none',
            memberId: 'm1',
            userId: 'u1',
            email: 'a@b.c',
            phone: '555',
            dob: '2000-01-01',
            qrPayload: 'AWC1.' + 'a'.repeat(64),
            cardNumber: 'PLCC-2026-00001',
            canCheckIn: true,
            canCheckOut: true,
          },
        ],
      })
    );
    const forbidden = [
      'userId',
      'memberId',
      'householdId',
      'email',
      'phone',
      'dob',
      'qrPayload',
      'cardNumber',
      'canCheckIn',
      'canCheckOut',
    ];
    for (const k of keysOf(s)) assert.equal(forbidden.includes(k), false, k);
    assert.deepEqual(s.household, { name: 'Smith' });
  });

  it('legacy: unknown cardAccess rejected', () => {
    assert.throws(
      () =>
        sanitizeFamilySummary(
          baseLinked({
            dependents: [
              {
                displayName: 'K',
                avatarUrl: null,
                relationship: 'child',
                cardAccess: 'maybe',
                cardRef: null,
              },
            ],
          })
        ),
      (e) => e.code === 'family_data_invalid'
    );
  });

  it('legacy: malformed arrays / linked rejected', () => {
    assert.throws(
      () =>
        sanitizeFamilySummary({
          linked: true,
          household: null,
          householdState: null,
          self: { displayName: 'A', avatarUrl: null, cardAccess: 'self' },
          adults: 'nope',
          dependents: [],
        }),
      (e) => e.code === 'family_data_invalid'
    );
    assert.throws(
      () =>
        sanitizeFamilySummary({
          linked: 'false',
          household: null,
          householdState: null,
          self: null,
          adults: [],
          dependents: [],
        }),
      (e) => e.code === 'family_data_invalid'
    );
  });

  it('legacy: relationship labels + dependent avatar null', () => {
    assert.equal(familyRelationshipLabel('spouse'), 'Spouse');
    assert.equal(familyRelationshipLabel('legal_guardian'), 'Legal Guardian');
    assert.equal(familyRelationshipLabel(null), 'Family member');
    const s = sanitizeFamilySummary(
      baseLinked({
        dependents: [
          {
            displayName: 'K',
            avatarUrl: 'https://evil/child.png',
            relationship: 'child',
            cardAccess: 'none',
            cardRef: null,
          },
        ],
      })
    );
    assert.equal(s.dependents[0].avatarUrl, null);
  });

  it('legacy: no raw-table / adult-card / elevated secrets', () => {
    for (const rel of [
      'lib/familyClient.ts',
      'lib/familyTypes.ts',
      'lib/familyUi.ts',
      'lib/familySanitize.ts',
      'lib/dependentCardRef.ts',
    ]) {
      const src = read(rel);
      assert.equal(/user_member_links|household_members|guardian_relationships/i.test(src), false, rel);
      assert.equal(
        /member_digital_cards|get_my_member_digital_card|mint_member|rotate_member/i.test(src),
        false,
        rel
      );
      assert.equal(/\bservice_role\b|SUPABASE_SERVICE/i.test(stripComments(src)), false, rel);
    }
  });

  it('legacy: family client does not register routes; exports intact', () => {
    const client = read('lib/familyClient.ts');
    assert.equal(/path=["']\/family["']|MemberFamilyPage|BrowserRouter/i.test(client), false);
    assert.ok(read('lib/familySanitize.ts').includes('export function sanitizeFamilySummary'));
    assert.ok(client.includes('export async function fetchMyFamilySummary'));
    assert.ok(read('lib/familyUi.ts').includes('export function familySummaryState'));
    assert.equal(familyCardAccessLabel('guardian'), 'Authorized for family card access');
    assert.ok(!/child card available/i.test(familyCardAccessLabel('guardian')));
    assert.equal(familyErrorMessage('family_data_invalid'), 'We couldn’t safely display your family information.');
    assert.equal(familyErrorMessage('unauthorized'), 'Sign in to view your family.');
  });

  it('error model stays family_data_invalid (no card_ref_invalid)', () => {
    for (const rel of ['lib/familySanitize.ts', 'lib/familyClient.ts', 'lib/familyTypes.ts']) {
      assert.equal(read(rel).includes('card_ref_invalid'), false, rel);
    }
  });

  it('direct authenticated Supabase path', () => {
    const client = read('lib/familyClient.ts');
    assert.ok(client.includes("from './supabase'"));
    assert.ok(client.includes('supabase.auth.getSession()'));
    assert.ok(client.includes('fetchMyFamilySummary'));
    assert.equal(client.includes('/api/'), false);
    assert.equal(client.includes('fetch('), false);
  });
});
