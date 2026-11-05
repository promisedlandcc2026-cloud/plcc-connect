import { isSupabaseConfigured, supabase } from './supabase';

export type MfaFactor = {
  id: string;
  friendly_name?: string | null;
  factor_type?: string;
  status: string;
};

export type MfaEnrollStart = {
  factorId: string;
  /** otpauth:// URI — render as QR (do not rely on Supabase SVG) */
  uri: string;
  secret: string;
  /** Secret grouped for easier typing into authenticator apps */
  secretFormatted: string;
};

function requireClient() {
  if (!isSupabaseConfigured) {
    throw new Error('Sign-in is not ready. Refresh the page and try again.');
  }
  return supabase;
}

/** List verified TOTP (authenticator app) factors. */
export async function listMfaFactors(): Promise<MfaFactor[]> {
  const client = requireClient();
  const { data, error } = await client.auth.mfa.listFactors();
  if (error) throw new Error(error.message || 'Could not load 2-step status');
  const totp = (data?.totp || []) as MfaFactor[];
  return totp.filter((f) => f.status === 'verified');
}

function formatTotpSecret(secret: string): string {
  const clean = String(secret || '')
    .replace(/\s+/g, '')
    .toUpperCase();
  return clean.replace(/(.{4})/g, '$1 ').trim();
}

/**
 * Build a Google Authenticator–friendly otpauth URI.
 * Issuer is AWCConnect so apps distinguish Connect vs Vault enrollments.
 */
function buildTotpUri(secret: string, email: string): string {
  const cleanSecret = String(secret || '').replace(/\s+/g, '').toUpperCase();
  const account = (email || 'member').replace(/\s+/g, '');
  const label = encodeURIComponent(`AWCConnect:${account}`);
  const issuer = encodeURIComponent('AWCConnect');
  return `otpauth://totp/${label}?secret=${cleanSecret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

/** Start authenticator-app enrollment; show QR then call confirmMfaEnroll. */
export async function startMfaEnroll(friendlyName = 'PLCC-Connect'): Promise<MfaEnrollStart> {
  const client = requireClient();

  try {
    const { data: listed } = await client.auth.mfa.listFactors();
    const pending =
      (listed as { all?: Array<{ factor_type?: string; status?: string; id?: string }> })?.all ||
      [];
    for (const f of pending) {
      if (f?.factor_type === 'totp' && f?.status === 'unverified' && f?.id) {
        await client.auth.mfa.unenroll({ factorId: f.id });
      }
    }
  } catch {
    /* Non-fatal — continue with enroll */
  }

  const { data: userData } = await client.auth.getUser();
  const email = userData?.user?.email || 'member';

  const { data, error } = await client.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: String(friendlyName || 'PLCC-Connect').replace(/\s+/g, '-'),
  } as { factorType: 'totp'; friendlyName: string });

  if (error) throw new Error(error.message || 'Could not start 2-step setup');
  if (!data?.id || !data?.totp?.secret) {
    throw new Error('Could not start 2-step setup. Try again in a moment.');
  }

  const secret = String(data.totp.secret).replace(/\s+/g, '').toUpperCase();

  return {
    factorId: data.id,
    uri: buildTotpUri(secret, email),
    secret,
    secretFormatted: formatTotpSecret(secret),
  };
}

/** Confirm authenticator setup with the 6-digit code from the app. */
export async function confirmMfaEnroll(factorId: string, code: string): Promise<void> {
  const client = requireClient();
  const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({
    factorId,
  });
  if (challengeError) throw new Error(challengeError.message || 'Could not verify code');
  const { error } = await client.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: code.trim(),
  });
  if (error) throw new Error(error.message || 'That code did not work. Try again.');
}

/** Turn off 2-step for a factor. */
export async function removeMfaFactor(factorId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.auth.mfa.unenroll({ factorId });
  if (error) throw new Error(error.message || 'Could not turn off 2-step');
}
