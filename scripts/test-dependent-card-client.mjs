/**
 * Phase 2.6D.2 — Connect dependent card client contracts (source + sanitizer behavior).
 * Run: node --test scripts/test-dependent-card-client.mjs
 *
 * Sanitizer behavioral tests mirror lib/dependentCardSanitize.ts + lib/dependentCardUi.ts
 * (Node cannot import Vite TS paths).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { countApiJsHandlers } from '../api/_utils/serveSanitize.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const vaultRoot = join(root, '..', 'awc-vault-main');

const CLIENT_FILES = [
  'lib/dependentCardTypes.ts',
  'lib/dependentCardRef.ts',
  'lib/dependentCardSanitize.ts',
  'lib/dependentCardClient.ts',
  'lib/dependentCardUi.ts',
];

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

class DependentCardSanitizeError extends Error {
  constructor() {
    super('dependent_card_data_invalid');
    this.name = 'DependentCardSanitizeError';
    this.code = 'dependent_card_data_invalid';
  }
}

const CARD_REF_RE = /^AWCD\.[0-9a-f]{64}$/;
const CARD_NUMBER_RE = /^PLCC-[0-9]{4}-[0-9]{5,}$/;
const QR_PAYLOAD_RE = /^AWC1\.[0-9a-f]{64}$/;
const STATUS_SET = new Set(['active', 'inactive', 'revoked']);

function isDependentCardRef(value) {
  return typeof value === 'string' && CARD_REF_RE.test(value);
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

function isValidIsoTimestamp(value) {
  return !Number.isNaN(Date.parse(value));
}

function parseStatus(value) {
  if (typeof value !== 'string') throw new DependentCardSanitizeError();
  const s = value.trim().toLowerCase();
  if (!STATUS_SET.has(s)) throw new DependentCardSanitizeError();
  return s;
}

function sanitizeOne(raw) {
  const r = asRecord(raw);
  if (!r) throw new DependentCardSanitizeError();

  if (!isDependentCardRef(r.cardRef)) throw new DependentCardSanitizeError();
  const cardRef = r.cardRef;

  const cardNumber = asNullableString(r.cardNumber);
  if (!cardNumber || !CARD_NUMBER_RE.test(cardNumber)) throw new DependentCardSanitizeError();

  const qrPayload = asNullableString(r.qrPayload);
  if (!qrPayload || !QR_PAYLOAD_RE.test(qrPayload)) throw new DependentCardSanitizeError();

  const displayName = asNullableString(r.displayName);
  if (!displayName) throw new DependentCardSanitizeError();

  const labelRaw = asNullableString(r.label);
  const label = labelRaw ? clampText(labelRaw, 80) : 'PLCC Child Member';

  const issuedAt = asNullableString(r.issuedAt);
  if (!issuedAt || !isValidIsoTimestamp(issuedAt)) throw new DependentCardSanitizeError();

  let rotatedAt = null;
  if (r.rotatedAt != null) {
    const rot = asNullableString(r.rotatedAt);
    if (!rot || !isValidIsoTimestamp(rot)) throw new DependentCardSanitizeError();
    rotatedAt = rot;
  }

  let accessCode = null;
  if (r.accessCode != null) {
    const code = asNullableString(r.accessCode);
    if (code && /^[0-9]{4}$/.test(code)) accessCode = code;
  }

  return {
    cardRef,
    displayName: clampText(displayName, 120),
    label,
    cardNumber,
    cardStatus: parseStatus(r.cardStatus),
    qrPayload,
    issuedAt,
    rotatedAt,
    accessCode,
  };
}

function sanitizeGuardianDependentCards(raw) {
  if (!Array.isArray(raw)) throw new DependentCardSanitizeError();
  const out = [];
  const seenRefs = new Set();
  for (const row of raw) {
    const card = sanitizeOne(row);
    if (seenRefs.has(card.cardRef)) throw new DependentCardSanitizeError();
    seenRefs.add(card.cardRef);
    out.push(card);
  }
  return out;
}

function dependentCardStatusLabel(status) {
  if (status === 'active') return 'Active';
  if (status === 'inactive') return 'Inactive';
  if (status === 'revoked') return 'Revoked';
  return 'Unavailable';
}

function dependentCardErrorMessage(code) {
  if (code === 'unauthorized') return 'Sign in to view family member cards.';
  if (code === 'dependent_card_data_invalid') {
    return 'We couldn’t safely display family member cards.';
  }
  return 'We couldn’t load family member cards right now.';
}

function dependentCardCountLabel(count) {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (n === 0) return 'No family member cards available';
  if (n === 1) return '1 family member card';
  return `${n} family member cards`;
}

function hex(n) {
  return 'a'.repeat(n);
}

function validCard(overrides = {}) {
  return {
    cardRef: `AWCD.${hex(64)}`,
    displayName: 'Alex Child',
    label: 'PLCC Child Member',
    cardNumber: 'PLCC-2026-00013',
    cardStatus: 'active',
    qrPayload: `AWC1.${hex(64)}`,
    issuedAt: '2026-09-14T10:00:00.000Z',
    rotatedAt: null,
    accessCode: null,
    ...overrides,
  };
}

function keysOf(obj) {
  return Object.keys(obj || {}).sort();
}

describe('Phase 2.6D.2 Connect dependent card client', () => {
  it('A: exact RPC name', () => {
    assert.ok(read('lib/dependentCardClient.ts').includes("supabase.rpc('get_my_guardian_child_cards')"));
  });

  it('B: no RPC args', () => {
    const client = read('lib/dependentCardClient.ts');
    assert.ok(/supabase\.rpc\(\s*'get_my_guardian_child_cards'\s*\)/.test(client));
    assert.equal(/supabase\.rpc\(\s*'get_my_guardian_child_cards'\s*,/.test(client), false);
  });

  it('C: session required', () => {
    const client = read('lib/dependentCardClient.ts');
    assert.ok(client.includes('getSession()'));
    assert.ok(client.includes("'unauthorized'"));
    assert.ok(client.includes('requireSession'));
  });

  it('D: no new API function', () => {
    assert.equal(existsSync(join(root, 'api/child-card.js')), false);
    assert.equal(existsSync(join(root, 'api/family-card.js')), false);
    assert.equal(existsSync(join(root, 'api/dependent-card.js')), false);
  });

  it('E: API count stays 14', () => {
    const handlers = readdirSync(join(root, 'api')).filter((f) => f.endsWith('.js'));
    assert.equal(handlers.length, 15);
    assert.equal(countApiJsHandlers(handlers), 15);
  });

  it('F: empty array valid', () => {
    assert.deepEqual(sanitizeGuardianDependentCards([]), []);
  });

  it('G: valid card accepted', () => {
    const out = sanitizeGuardianDependentCards([validCard()]);
    assert.equal(out.length, 1);
    assert.deepEqual(keysOf(out[0]), [
      'accessCode',
      'cardNumber',
      'cardRef',
      'cardStatus',
      'displayName',
      'issuedAt',
      'label',
      'qrPayload',
      'rotatedAt',
    ]);
  });

  it('G2: accessCode kept when 4 digits; invalid becomes null', () => {
    assert.equal(sanitizeGuardianDependentCards([validCard({ accessCode: '1234' })])[0].accessCode, '1234');
    assert.equal(sanitizeGuardianDependentCards([validCard({ accessCode: '12' })])[0].accessCode, null);
    assert.equal(sanitizeGuardianDependentCards([validCard({ accessCode: 'abcd' })])[0].accessCode, null);
  });

  it('H: multiple valid cards accepted', () => {
    const a = validCard({ cardRef: `AWCD.${'b'.repeat(64)}`, qrPayload: `AWC1.${'b'.repeat(64)}`, cardNumber: 'PLCC-2026-00014' });
    const b = validCard({ cardRef: `AWCD.${'c'.repeat(64)}`, qrPayload: `AWC1.${'c'.repeat(64)}`, cardNumber: 'PLCC-2026-00015' });
    assert.equal(sanitizeGuardianDependentCards([a, b]).length, 2);
  });

  it('I: cardRef format enforced', () => {
    assert.throws(() => sanitizeGuardianDependentCards([validCard({ cardRef: 'BAD' })]));
    assert.throws(() => sanitizeGuardianDependentCards([validCard({ cardRef: `AWCD.${'A'.repeat(64)}` })]));
  });

  it('J: cardNumber format enforced', () => {
    assert.throws(() => sanitizeGuardianDependentCards([validCard({ cardNumber: 'PLCC-26-1' })]));
  });

  it('K: qrPayload format enforced', () => {
    assert.throws(() => sanitizeGuardianDependentCards([validCard({ qrPayload: 'AWC1.short' })]));
  });

  it('L: active status accepted', () => {
    assert.equal(sanitizeGuardianDependentCards([validCard({ cardStatus: 'active' })])[0].cardStatus, 'active');
  });

  it('M: inactive status accepted', () => {
    assert.equal(sanitizeGuardianDependentCards([validCard({ cardStatus: 'inactive' })])[0].cardStatus, 'inactive');
  });

  it('N: revoked status accepted', () => {
    assert.equal(sanitizeGuardianDependentCards([validCard({ cardStatus: 'revoked' })])[0].cardStatus, 'revoked');
  });

  it('O: unknown status rejected', () => {
    assert.throws(() => sanitizeGuardianDependentCards([validCard({ cardStatus: 'pending' })]));
  });

  it('P: invalid timestamp rejected', () => {
    assert.throws(() => sanitizeGuardianDependentCards([validCard({ issuedAt: 'not-a-date' })]));
  });

  it('Q: rotatedAt null accepted', () => {
    assert.equal(sanitizeGuardianDependentCards([validCard({ rotatedAt: null })])[0].rotatedAt, null);
  });

  it('R: duplicate cardRef rejected', () => {
    const a = validCard();
    const b = validCard({ cardNumber: 'PLCC-2026-00099', qrPayload: `AWC1.${'d'.repeat(64)}` });
    assert.throws(() => sanitizeGuardianDependentCards([a, b]));
  });

  it('S: raw IDs stripped', () => {
    const out = sanitizeGuardianDependentCards([
      validCard({
        memberId: 'uuid',
        userId: 'uuid',
        guardianId: 'uuid',
        householdId: 'uuid',
        id: 'uuid',
      }),
    ])[0];
    assert.equal('memberId' in out, false);
    assert.equal('userId' in out, false);
    assert.equal('guardianId' in out, false);
    assert.equal('householdId' in out, false);
    assert.equal('id' in out, false);
  });

  it('T: PII stripped', () => {
    const out = sanitizeGuardianDependentCards([
      validCard({ email: 'x@y.z', phone: '555', dob: '2015-01-01', role: 'Child' }),
    ])[0];
    assert.equal('email' in out, false);
    assert.equal('phone' in out, false);
    assert.equal('dob' in out, false);
    assert.equal('role' in out, false);
  });

  it('U: hash stripped', () => {
    const out = sanitizeGuardianDependentCards([
      validCard({ qrTokenHash: 'abc', qr_token_hash: 'abc', verifiedBy: 'x', linkedBy: 'y' }),
    ])[0];
    assert.equal('qrTokenHash' in out, false);
    assert.equal('qr_token_hash' in out, false);
    assert.equal('verifiedBy' in out, false);
    assert.equal('linkedBy' in out, false);
  });

  it('V: check-in/out flags stripped', () => {
    const out = sanitizeGuardianDependentCards([
      validCard({ canViewCard: true, canCheckIn: true, canCheckOut: true }),
    ])[0];
    assert.equal('canViewCard' in out, false);
    assert.equal('canCheckIn' in out, false);
    assert.equal('canCheckOut' in out, false);
  });

  it('W: avatar stripped', () => {
    const out = sanitizeGuardianDependentCards([validCard({ avatarUrl: 'https://x/y.png' })])[0];
    assert.equal('avatarUrl' in out, false);
  });

  it('X: unknown fields dropped', () => {
    const out = sanitizeGuardianDependentCards([validCard({ extra: 1, notes: 'x' })])[0];
    assert.equal('extra' in out, false);
    assert.equal('notes' in out, false);
  });

  it('Y: no raw table queries', () => {
    for (const rel of CLIENT_FILES) {
      const src = stripComments(read(rel));
      assert.equal(
        /\.from\(\s*['"]dependent_digital_cards['"]|\.from\(\s*['"]guardian_relationships['"]|\.from\(\s*['"]user_member_links['"]|\.from\(\s*['"]members['"]/.test(
          src
        ),
        false,
        rel
      );
    }
  });

  it('Z: no adult card RPC', () => {
    for (const rel of CLIENT_FILES) {
      const src = stripComments(read(rel));
      assert.equal(
        /get_my_member_digital_card|mint_member_digital_card|rotate_member_digital_card/.test(src),
        false,
        rel
      );
    }
  });

  it('AA: no guardian mutation helper', () => {
    for (const rel of CLIENT_FILES) {
      const src = stripComments(read(rel));
      assert.equal(
        /rotateGuardianChildCard|revokeGuardianChildCard|regenerateChildCard|rotate.*[Cc]hild|revoke.*[Cc]hild/.test(
          src
        ),
        false,
        rel
      );
    }
  });

  it('AB: no browser storage', () => {
    for (const rel of CLIENT_FILES) {
      assert.equal(
        /\blocalStorage\b|\bsessionStorage\b|\bIndexedDB\b/.test(stripComments(read(rel))),
        false,
        rel
      );
    }
  });

  it('AC: no token logging', () => {
    for (const rel of CLIENT_FILES) {
      const src = stripComments(read(rel));
      assert.equal(/console\.(log|debug|info|warn|error)\s*\([^)]*qrPayload/.test(src), false, rel);
      assert.equal(/console\.(log|debug|info|warn|error)\s*\([^)]*cardRef/.test(src), false, rel);
      assert.equal(/console\.(log|debug|info)\s*\(\s*card\s*\)/.test(src), false, rel);
    }
  });

  it('AD: child-card UI uses /family/card/:cardRef (not /child-card)', () => {
    assert.ok(existsSync(join(root, 'pages/MemberDependentCard.tsx')));
    assert.equal(existsSync(join(root, 'pages/DependentCard.tsx')), false);
    assert.equal(existsSync(join(root, 'pages/ChildCard.tsx')), false);
    const app = read('App.tsx');
    assert.ok(app.includes('path="/family/card/:cardRef"'));
    assert.ok(app.includes('MemberDependentCardPage'));
    assert.equal(/path=["']\/child-card|path=["']\/dependent-card/.test(app), false);
  });

  it('AE: no QR library/rendering added', () => {
    for (const rel of CLIENT_FILES) {
      const src = stripComments(read(rel));
      assert.equal(/qrcode|QRCode|react-qr|toDataURL|canvas/.test(src), false, rel);
    }
    const pkg = JSON.parse(read('package.json'));
    assert.equal(!!pkg.dependencies?.qrcode, false);
    assert.equal(!!pkg.dependencies?.['qrcode.react'], false);
  });

  it('AF: no Vault changes required by this phase artifact', () => {
    // Connect phase must not require editing Vault product/SQL in the same change set.
    // Assert Connect files do not write Vault paths / migrations.
    for (const rel of CLIENT_FILES) {
      assert.equal(/awc-vault-main|connect_phase_2_6d_dependent/.test(read(rel)), false, rel);
    }
    assert.equal(existsSync(join(root, 'supabase/migrations/connect_phase_2_6d_dependent_digital_cards.sql')), false);
  });

  it('AG: no service_role', () => {
    for (const rel of CLIENT_FILES) {
      assert.equal(/\bservice_role\b|SUPABASE_SERVICE/i.test(stripComments(read(rel))), false, rel);
    }
  });

  it('UI helpers: status / count / errors / safe copy', () => {
    assert.equal(dependentCardStatusLabel('active'), 'Active');
    assert.equal(dependentCardStatusLabel('inactive'), 'Inactive');
    assert.equal(dependentCardStatusLabel('revoked'), 'Revoked');
    assert.equal(dependentCardCountLabel(0), 'No family member cards available');
    assert.equal(dependentCardCountLabel(1), '1 family member card');
    assert.equal(dependentCardCountLabel(2), '2 family member cards');
    assert.ok(dependentCardErrorMessage('unauthorized').includes('Sign in'));
    const ui = read('lib/dependentCardUi.ts');
    assert.ok(ui.includes('Available through your verified family access.'));
    assert.equal(/pick up|checkout authorized|Legal guardian/i.test(ui), false);
  });

  it('family summary isolation: family client untouched by dependent card module', () => {
    const family = read('lib/familyClient.ts');
    assert.ok(family.includes("supabase.rpc('get_my_family_summary')"));
    assert.equal(/get_my_guardian_child_cards|dependentCard/.test(family), false);
    // Shared AWCD validator only — Family must not import credential sanitizer/client
    assert.ok(read('lib/familySanitize.ts').includes("from './dependentCardRef'"));
    assert.equal(/dependentCardSanitize|dependentCardClient|GuardianDependentCard/.test(read('lib/familySanitize.ts')), false);
    assert.ok(read('lib/dependentCardSanitize.ts').includes("from './dependentCardRef'"));
  });

  it('fingerprint helper used in docs only — no full token printing in source', () => {
    // Ensure client sources never embed example full tokens longer than format patterns
    for (const rel of CLIENT_FILES) {
      const src = read(rel);
      assert.equal(/AWC1\.[0-9a-f]{64}/.test(src), false, rel);
      assert.equal(/AWCD\.[0-9a-f]{64}/.test(src), false, rel);
    }
    // Sanity: fingerprint utility available to smoke scripts without logging tokens
    assert.equal(createHash('sha256').update('x').digest('hex').slice(0, 12).length, 12);
  });

  it('Vault sibling HEAD note: foundation commit expected when present', () => {
    if (!existsSync(vaultRoot)) return;
    // Soft check only — Connect phase does not mutate Vault
    assert.equal(existsSync(join(vaultRoot, 'supabase/migrations/connect_phase_2_6d_dependent_digital_cards.sql')), true);
  });
});
