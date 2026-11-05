/**
 * Phase 2.6D.2 — live client smoke for guardian dependent cards.
 * TEMP identities only. Does not commit. Cleans up on exit.
 *
 * Usage (from Connect):
 *   node --env-file=../awc-vault-main/.env.diagnostic.local scripts/smoke-dependent-card-client.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const MARKER = 'TEST — Phase 2.6D.2';
const MARKER_EMAIL = 'phase26d2';

function loadEnvFile(path) {
  try {
    const text = readFileSync(path, 'utf8');
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#') || !t.includes('=')) continue;
      const i = t.indexOf('=');
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!(k in process.env) || !process.env[k]) process.env[k] = v;
    }
  } catch {
    /* optional */
  }
}

function env(...names) {
  for (const n of names) {
    const v = process.env[n];
    if (v && String(v).trim()) return String(v).trim();
  }
  return '';
}

function fp(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 12);
}

// --- sanitizer mirror (matches lib/dependentCardSanitize.ts) ---
class DependentCardSanitizeError extends Error {
  constructor() {
    super('dependent_card_data_invalid');
    this.code = 'dependent_card_data_invalid';
  }
}

const CARD_REF_RE = /^AWCD\.[0-9a-f]{64}$/;
const CARD_NUMBER_RE = /^PLCC-[0-9]{4}-[0-9]{5,}$/;
const QR_PAYLOAD_RE = /^AWC1\.[0-9a-f]{64}$/;
const STATUS_SET = new Set(['active', 'inactive', 'revoked']);

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
  const cardRef = asNullableString(r.cardRef);
  if (!cardRef || !CARD_REF_RE.test(cardRef)) throw new DependentCardSanitizeError();
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
  return {
    cardRef,
    displayName: clampText(displayName, 120),
    label,
    cardNumber,
    cardStatus: parseStatus(r.cardStatus),
    qrPayload,
    issuedAt,
    rotatedAt,
  };
}
function sanitizeGuardianDependentCards(raw) {
  if (!Array.isArray(raw)) throw new DependentCardSanitizeError();
  const out = [];
  const seen = new Set();
  for (const row of raw) {
    const card = sanitizeOne(row);
    if (seen.has(card.cardRef)) throw new DependentCardSanitizeError();
    seen.add(card.cardRef);
    out.push(card);
  }
  return out;
}

/** Mirrors fetchMyGuardianDependentCards auth + RPC + sanitize (Node cannot use Vite import.meta.env). */
async function fetchMyGuardianDependentCardsViaHelper(browser) {
  const { data: sess, error: sErr } = await browser.auth.getSession();
  if (sErr || !sess.session?.user?.id) {
    const err = new Error('unauthorized');
    err.code = 'unauthorized';
    throw err;
  }
  const { data, error } = await browser.rpc('get_my_guardian_child_cards');
  if (error) {
    const err = new Error('dependent_cards_unavailable');
    err.code = 'dependent_cards_unavailable';
    throw err;
  }
  return sanitizeGuardianDependentCards(data);
}

const created = {
  authUsers: [],
  publicUsers: [],
  members: [],
  links: [],
  guardians: [],
};

async function createAuthUser(admin, url, anon, label) {
  const email = `${MARKER_EMAIL}.${label}.${Date.now()}@awc-vault.local`;
  const password = `Verify!${Date.now()}Aa1`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user?.id) throw new Error(`createUser: ${error?.message}`);
  const uid = data.user.id;
  created.authUsers.push(uid);
  const password_hash = createHash('sha256').update(`temp:${uid}`).digest('hex');
  const { error: uErr } = await admin.from('users').insert({
    id: uid,
    email,
    name: `${MARKER} ${label}`,
    role: 'APPROVED',
    password_hash,
    is_temporary_password: true,
  });
  if (uErr) throw new Error(`users: ${uErr.message}`);
  created.publicUsers.push(uid);
  const browser = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signErr } = await browser.auth.signInWithPassword({ email, password });
  if (signErr) throw new Error(`signIn: ${signErr.message}`);
  return { uid, browser, label };
}

async function createMember(admin, label) {
  const id = randomUUID();
  const { data, error } = await admin
    .from('members')
    .insert({
      id,
      first_name: MARKER,
      last_name: label,
      email: `${MARKER_EMAIL}.m.${label}.${Date.now()}@awc-vault.local`,
      status: 'Active',
      role: label.startsWith('Child') ? 'Child' : 'Member',
    })
    .select('*')
    .single();
  if (error) throw new Error(`member: ${error.message}`);
  created.members.push(data.id);
  return data;
}

async function upsertLink(admin, userId, memberId, status) {
  const { error } = await admin.from('user_member_links').upsert(
    {
      user_id: userId,
      member_id: memberId,
      status,
      link_method: 'staff_verified',
      linked_by: status === 'verified' ? userId : null,
      linked_at: status === 'verified' ? new Date().toISOString() : null,
    },
    { onConflict: 'user_id' }
  );
  if (error) throw new Error(`link: ${error.message}`);
  if (!created.links.includes(userId)) created.links.push(userId);
}

async function upsertGuardian(admin, guardianUserId, childMemberId, flags) {
  const { data, error } = await admin
    .from('guardian_relationships')
    .upsert(
      {
        guardian_user_id: guardianUserId,
        guardian_member_id: flags.guardian_member_id ?? null,
        child_member_id: childMemberId,
        relationship_type: 'parent',
        can_view_card: !!flags.can_view_card,
        can_check_in: false,
        can_check_out: false,
        status: flags.status || 'active',
        verified_by: guardianUserId,
        verified_at: new Date().toISOString(),
      },
      { onConflict: 'guardian_user_id,child_member_id' }
    )
    .select('*')
    .single();
  if (error) throw new Error(`guardian: ${error.message}`);
  if (!created.guardians.includes(data.id)) created.guardians.push(data.id);
  return data;
}

async function cleanup(admin) {
  for (const mid of created.members) {
    await admin.from('dependent_digital_cards').delete().eq('member_id', mid);
  }
  for (const uid of created.publicUsers) {
    await admin.from('guardian_relationships').delete().eq('guardian_user_id', uid);
    await admin.from('user_member_links').delete().eq('user_id', uid);
  }
  for (const mid of created.members) {
    await admin.from('guardian_relationships').delete().eq('child_member_id', mid);
    await admin.from('user_member_links').delete().eq('member_id', mid);
    await admin.from('members').delete().eq('id', mid);
  }
  const { data: markerMembers } = await admin
    .from('members')
    .select('id')
    .ilike('first_name', `${MARKER}%`);
  for (const m of markerMembers || []) {
    await admin.from('dependent_digital_cards').delete().eq('member_id', m.id);
    await admin.from('guardian_relationships').delete().eq('child_member_id', m.id);
    await admin.from('user_member_links').delete().eq('member_id', m.id);
    await admin.from('members').delete().eq('id', m.id);
  }
  for (const uid of created.publicUsers) {
    await admin.from('users').delete().eq('id', uid);
  }
  for (const uid of created.authUsers) {
    await admin.auth.admin.deleteUser(uid);
  }
}

async function main() {
  loadEnvFile(join(root, '.env.local'));
  loadEnvFile(join(root, '..', 'awc-vault-main', '.env.diagnostic.local'));
  loadEnvFile(join(root, '..', 'awc-vault-main', '.env.local'));

  const url = env('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const service = env('SUPABASE_SERVICE_ROLE_KEY');
  const anon = env('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY');
  if (!url || !service || !anon) throw new Error('Missing Supabase env');
  const ref = new URL(url).hostname.split('.')[0];
  if (ref !== 'yrpwdrioomdihjlmcfnu') throw new Error(`Wrong project ${ref}`);

  // Prove Connect client source wires the helper path
  const clientSrc = readFileSync(join(root, 'lib/dependentCardClient.ts'), 'utf8');
  if (!/fetchMyGuardianDependentCards/.test(clientSrc)) throw new Error('missing fetch helper');
  if (!/supabase\.rpc\(\s*'get_my_guardian_child_cards'\s*\)/.test(clientSrc)) {
    throw new Error('client RPC mismatch');
  }

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const report = { projectRef: ref, defects: [], multi: null, revoke: null, smoke: null };

  try {
    const gA = await createAuthUser(admin, url, anon, 'GuardianA');
    const gB = await createAuthUser(admin, url, anon, 'GuardianB');
    const memA = await createMember(admin, 'GuardianA');
    const memB = await createMember(admin, 'GuardianB');
    const child = await createMember(admin, 'ChildA');

    await upsertLink(admin, gA.uid, memA.id, 'verified');
    await upsertLink(admin, gB.uid, memB.id, 'verified');
    await upsertGuardian(admin, gA.uid, child.id, {
      guardian_member_id: memA.id,
      can_view_card: true,
    });
    await upsertGuardian(admin, gB.uid, child.id, {
      guardian_member_id: memB.id,
      can_view_card: true,
    });

    const cardsA = await fetchMyGuardianDependentCardsViaHelper(gA.browser);
    if (cardsA.length !== 1) throw new Error(`expected 1 card, got ${cardsA.length}`);
    const keys = Object.keys(cardsA[0]).sort();
    const expected = [
      'cardNumber',
      'cardRef',
      'cardStatus',
      'displayName',
      'issuedAt',
      'label',
      'qrPayload',
      'rotatedAt',
    ];
    if (JSON.stringify(keys) !== JSON.stringify(expected)) {
      throw new Error(`bad keys ${keys.join(',')}`);
    }
    report.smoke = {
      count: 1,
      cardNumber: cardsA[0].cardNumber,
      cardRefFp: fp(cardsA[0].cardRef),
      qrFp: fp(cardsA[0].qrPayload),
      cardStatus: cardsA[0].cardStatus,
      label: cardsA[0].label,
    };

    const cardsB = await fetchMyGuardianDependentCardsViaHelper(gB.browser);
    if (cardsB.length !== 1) throw new Error(`B expected 1, got ${cardsB.length}`);
    if (
      cardsB[0].cardRef !== cardsA[0].cardRef ||
      cardsB[0].cardNumber !== cardsA[0].cardNumber ||
      cardsB[0].qrPayload !== cardsA[0].qrPayload
    ) {
      throw new Error('multi-guardian credential mismatch');
    }
    report.multi = {
      sameCardRefFp: fp(cardsB[0].cardRef),
      sameQrFp: fp(cardsB[0].qrPayload),
      sameCardNumber: cardsB[0].cardNumber,
    };

    await upsertGuardian(admin, gA.uid, child.id, {
      guardian_member_id: memA.id,
      can_view_card: false,
    });
    const afterRevoke = await fetchMyGuardianDependentCardsViaHelper(gA.browser);
    if (afterRevoke.length !== 0) throw new Error('revoke expected []');
    const stillB = await fetchMyGuardianDependentCardsViaHelper(gB.browser);
    if (stillB.length !== 1 || stillB[0].qrPayload !== cardsA[0].qrPayload) {
      throw new Error('B should remain authorized');
    }
    report.revoke = { a: afterRevoke.length, b: stillB.length };
  } catch (e) {
    report.defects.push(String(e?.message || e));
  } finally {
    try {
      await cleanup(admin);
      report.cleanup = 'ok';
    } catch (e) {
      report.cleanup = String(e?.message || e);
      report.defects.push(`cleanup: ${e?.message || e}`);
    }
  }

  console.log(JSON.stringify(report, null, 2));
  if (report.defects.length || report.cleanup !== 'ok') process.exitCode = 1;
  else console.log('SMOKE_PASS');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
