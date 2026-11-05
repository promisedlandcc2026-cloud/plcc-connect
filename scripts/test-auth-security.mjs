/**
 * Auth security contracts — 2-Step Auth on Connect (no passkeys).
 * Run: node --test scripts/test-auth-security.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildVaultAuthPhoneUrl,
  VAULT_AUTH_PHONE_PATH,
} from '../api/_utils/vaultOrigin.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

/** Mirror of lib/authPhoneClient helpers for contract tests (no TS import). */
function isPhoneNumber(value) {
  const v = String(value || '').trim();
  return /^[+\d]/.test(v) && v.replace(/\D/g, '').length >= 7;
}

function normalisePhone(value) {
  const trimmed = String(value || '').trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (trimmed.startsWith('+') && digits.length >= 10) return `+${digits}`;
  if (digits.length >= 10) return `+${digits}`;
  return trimmed.startsWith('+') ? `+${digits}` : `+1${digits}`;
}

describe('auth security helpers', () => {
  it('exports MFA helpers with AWCConnect issuer (no passkeys)', () => {
    const src = read('lib/authSecurity.ts');
    assert.ok(src.includes('export async function listMfaFactors'));
    assert.ok(src.includes('export async function startMfaEnroll'));
    assert.ok(src.includes('export async function confirmMfaEnroll'));
    assert.ok(src.includes('export async function removeMfaFactor'));
    assert.ok(src.includes("encodeURIComponent('AWCConnect')"));
    assert.ok(src.includes('AWCConnect:'));
    assert.equal(src.includes('AWCVault'), false);
    assert.equal(src.includes('listPasskeys'), false);
    assert.equal(src.includes('signInWithPasskey'), false);
    assert.equal(src.includes('registerPasskey'), false);
  });

  it('does not enable experimental passkey on the Connect client', () => {
    const src = read('lib/supabase.ts');
    assert.equal(src.includes('passkey: true'), false);
    assert.equal(/experimental:\s*\{\s*passkey/.test(src), false);
  });
});

describe('Account + Sign-in wiring', () => {
  it('wires 2-Step Auth on MemberAccount only', () => {
    const account = read('pages/MemberAccount.tsx');
    const section = read('components/auth/AccountSecuritySection.tsx');
    assert.ok(account.includes('AccountSecuritySection'));
    assert.ok(section.includes('data-account-security="mfa"'));
    assert.ok(section.includes('startMfaEnroll'));
    assert.equal(section.includes('data-account-security="passkey"'), false);
    assert.equal(section.includes('registerPasskey'), false);
  });

  it('keeps MemberSignIn on email OTP + phone password (no passkey button)', () => {
    const signIn = read('pages/MemberSignIn.tsx');
    const ctx = read('context/AuthContext.tsx');
    assert.equal(signIn.includes('data-signin-passkey'), false);
    assert.equal(signIn.includes('signInWithPasskey'), false);
    assert.equal(ctx.includes('signInWithPasskey'), false);
    assert.ok(signIn.includes('data-signin-email-otp') || signIn.includes('verifyOtp'));
    assert.ok(signIn.includes('data-signin-phone-password'));
    assert.ok(signIn.includes('signInWithPhone'));
    assert.ok(ctx.includes('signInWithPhone'));
    assert.ok(ctx.includes('signUpWithPhonePassword'));
  });

  it('does not add a Vault security API bridge', () => {
    const apiFiles = readdirSync(join(root, 'api')).filter((f) => f.endsWith('.js'));
    assert.equal(apiFiles.includes('auth-security.js'), false);
    assert.equal(apiFiles.includes('passkeys.js'), false);
    assert.equal(apiFiles.includes('mfa.js'), false);
    assert.ok(apiFiles.includes('auth-phone.js'));
    const security = read('lib/authSecurity.ts');
    assert.equal(security.includes('/api/'), false);
    assert.equal(security.includes('VAULT_API'), false);
  });
});

describe('session recovery + wake lock', () => {
  it('recovers auth on visibility without hard sign-out on transient errors', () => {
    const ctx = read('context/AuthContext.tsx');
    assert.ok(ctx.includes('visibilitychange'));
    assert.ok(ctx.includes('isFatalRefreshError'));
    assert.ok(ctx.includes('recoverSession'));
    assert.ok(read('lib/authAccessToken.ts').includes('getValidAccessToken'));
  });

  it('uses screen wake lock in both huddle components', () => {
    const hook = read('lib/useScreenWakeLock.ts');
    assert.ok(hook.includes('wakeLock'));
    assert.ok(read('components/community/ConnectVoiceHuddle.tsx').includes('useScreenWakeLock'));
    assert.ok(read('components/family/FamilyVoiceHuddle.tsx').includes('useScreenWakeLock'));
    assert.ok(read('components/community/ConnectVoiceHuddle.tsx').includes('reconnecting'));
    assert.ok(read('components/family/FamilyVoiceHuddle.tsx').includes('reconnecting'));
  });
});

describe('phone auth helpers', () => {
  it('normalises US phones and detects phone identifiers', () => {
    assert.equal(isPhoneNumber('5551234567'), true);
    assert.equal(isPhoneNumber('you@example.com'), false);
    assert.equal(normalisePhone('(555) 123-4567'), '+15551234567');
    assert.equal(normalisePhone('+1 555 123 4567'), '+15551234567');
    const client = read('lib/authPhoneClient.ts');
    assert.ok(client.includes('export function normalisePhone'));
    assert.ok(client.includes('signInWithPhonePassword'));
    assert.ok(client.includes('/api/auth-phone'));
  });

  it('uses fixed Vault auth-phone path', () => {
    assert.ok(VAULT_AUTH_PHONE_PATH.includes('resource=auth-phone'));
    assert.equal(
      buildVaultAuthPhoneUrl('https://example.com'),
      `https://example.com${VAULT_AUTH_PHONE_PATH}`
    );
    assert.ok(read('api/auth-phone.js').includes('buildVaultAuthPhoneUrl'));
  });
});

describe('ECOSYSTEM auth security notes', () => {
  it('documents 2-Step Auth, phone auth, and session stickiness without Connect passkeys', () => {
    const docs = read('docs/ECOSYSTEM.md');
    assert.ok(docs.includes('2-Step Auth'));
    assert.ok(/Passkeys are not offered on Connect/i.test(docs));
    assert.ok(docs.includes('AAL2'));
    assert.ok(docs.includes('Phone + password'));
    assert.ok(docs.includes('auth-phone'));
    assert.ok(docs.includes('Session stickiness'));
  });
});
