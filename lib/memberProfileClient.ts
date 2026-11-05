/**
 * Phase 2.8A — My Profile & directory privacy via authenticated Supabase RPCs only.
 * No Vault proxy. No elevated credentials.
 */

import { supabase, isSupabaseConfigured } from './supabase';

export type MemberDirectoryPrivacy = {
  directoryOptIn: boolean;
  showPhoto: boolean;
  showPhone: boolean;
  showEmail: boolean;
  showBirthday: boolean;
  showAnniversary: boolean;
  showHousehold: boolean;
  showMinistries: boolean;
};

export type MemberProfile = {
  preferredName: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  anniversary: string | null;
  avatarUrl: string | null;
  membershipStatus: string | null;
  householdName: string | null;
  householdState: 'none' | 'linked' | 'conflict';
  ministries: string[];
  hasCard: boolean;
  hasFamily: boolean;
};

export type MyMemberProfileResult = {
  linked: boolean;
  profile: MemberProfile | null;
  privacy: MemberDirectoryPrivacy | null;
};

export type MemberProfilePatch = {
  preferredName?: string | null;
  phone?: string | null;
  birthday?: string | null;
  anniversary?: string | null;
  avatarUrl?: string | null;
};

export type MemberPrivacyPatch = Partial<MemberDirectoryPrivacy>;

export class MemberProfileClientError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message || memberProfileErrorMessage(code));
    this.name = 'MemberProfileClientError';
    this.code = code;
  }
}

export function memberProfileErrorMessage(code: string, fallback?: string): string {
  if (fallback && fallback.trim()) return fallback.trim();
  switch (code) {
    case 'unauthorized':
      return 'Please sign in again to continue.';
    case 'not_linked':
      return 'Your member profile is not linked yet. Contact church leadership if this continues.';
    case 'not_configured':
      return 'Profile is not available right now.';
    case 'invalid_avatar':
      return 'That photo could not be used. Please choose a JPG, PNG, or WebP image.';
    case 'forbidden_field':
      return 'That field cannot be updated here.';
    case 'validation':
      return 'Please check the highlighted fields and try again.';
    default:
      return 'We could not load or save your profile. Please try again.';
  }
}

function mapRpcError(error: { code?: string; message?: string; details?: string } | null): never {
  const message = String(error?.message || '');
  const details = String(error?.details || '');
  const combined = `${message} ${details}`.trim();
  const code = String(error?.code || '');
  if (/not_authenticated/i.test(combined)) {
    throw new MemberProfileClientError('unauthorized');
  }
  if (/not_linked/i.test(combined)) {
    throw new MemberProfileClientError('not_linked');
  }
  if (/forbidden_field/i.test(combined)) {
    throw new MemberProfileClientError('forbidden_field');
  }
  if (/invalid_avatar/i.test(combined)) {
    throw new MemberProfileClientError('invalid_avatar');
  }
  if (/invalid_birthday|invalid_anniversary|preferred_name_too_long|phone_too_long/i.test(combined)) {
    throw new MemberProfileClientError(
      'validation',
      /invalid_anniversary/i.test(combined)
        ? 'Please enter a valid anniversary date.'
        : /invalid_birthday/i.test(combined)
          ? 'Please enter a valid birthday.'
          : /preferred_name_too_long/i.test(combined)
            ? 'Preferred name is too long.'
            : 'Phone number is too long.'
    );
  }
  if (code === '42501' || /permission denied|JWT/i.test(combined)) {
    throw new MemberProfileClientError('unauthorized');
  }
  if (code === 'PGRST202' || /could not find.*function|schema cache/i.test(combined)) {
    throw new MemberProfileClientError(
      'profile_unavailable',
      'Profile changes can’t be saved right now. Please try again later.'
    );
  }
  throw new MemberProfileClientError(
    'profile_unavailable',
    combined
      ? `We could not save your profile (${message.slice(0, 120)}). Please try again.`
      : undefined
  );
}

async function requireSession(): Promise<{ userId: string }> {
  if (!isSupabaseConfigured) throw new MemberProfileClientError('not_configured');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user?.id) {
    throw new MemberProfileClientError('unauthorized');
  }
  return { userId: data.session.user.id };
}

function asBool(v: unknown, fallback = false): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function asStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function sanitizePrivacy(raw: unknown): MemberDirectoryPrivacy {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    directoryOptIn: asBool(o.directoryOptIn),
    showPhoto: asBool(o.showPhoto),
    showPhone: asBool(o.showPhone),
    showEmail: asBool(o.showEmail),
    showBirthday: asBool(o.showBirthday),
    showAnniversary: asBool(o.showAnniversary),
    showHousehold: asBool(o.showHousehold),
    showMinistries: asBool(o.showMinistries),
  };
}

function sanitizeProfile(raw: unknown): MemberProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const ministries = Array.isArray(o.ministries)
    ? o.ministries.map((m) => String(m || '').trim()).filter(Boolean)
    : [];
  const householdStateRaw = String(o.householdState || 'none');
  const householdState: MemberProfile['householdState'] =
    householdStateRaw === 'linked' || householdStateRaw === 'conflict'
      ? householdStateRaw
      : 'none';

  return {
    preferredName: asStr(o.preferredName),
    firstName: asStr(o.firstName),
    lastName: asStr(o.lastName),
    displayName: asStr(o.displayName) || 'PLCC Member',
    phone: asStr(o.phone),
    email: asStr(o.email),
    birthday: asStr(o.birthday),
    anniversary: asStr(o.anniversary),
    avatarUrl: asStr(o.avatarUrl),
    membershipStatus: asStr(o.membershipStatus),
    householdName: asStr(o.householdName),
    householdState,
    ministries,
    hasCard: asBool(o.hasCard),
    hasFamily: asBool(o.hasFamily),
  };
}

function sanitizeResult(data: unknown): MyMemberProfileResult {
  const o = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const linked = Boolean(o.linked);
  return {
    linked,
    profile: linked ? sanitizeProfile(o.profile) : null,
    privacy: linked ? sanitizePrivacy(o.privacy) : null,
  };
}

export async function fetchMyMemberProfile(): Promise<MyMemberProfileResult> {
  await requireSession();
  const { data, error } = await supabase.rpc('get_my_member_profile');
  if (error) mapRpcError(error);
  return sanitizeResult(data);
}

export async function updateMyMemberProfile(
  patch: MemberProfilePatch
): Promise<MyMemberProfileResult> {
  await requireSession();
  const body: Record<string, string | null> = {};
  if ('preferredName' in patch) body.preferredName = patch.preferredName ?? null;
  if ('phone' in patch) body.phone = patch.phone ?? null;
  if ('birthday' in patch) body.birthday = patch.birthday ?? null;
  if ('anniversary' in patch) body.anniversary = patch.anniversary ?? null;
  if ('avatarUrl' in patch) body.avatarUrl = patch.avatarUrl ?? null;

  const { data, error } = await supabase.rpc('update_my_member_profile', {
    p_patch: body,
  });
  if (error) mapRpcError(error);
  return sanitizeResult(data);
}

export async function updateMyDirectoryPrivacy(
  prefs: MemberPrivacyPatch
): Promise<MemberDirectoryPrivacy> {
  await requireSession();
  const body: Record<string, boolean> = {};
  if (typeof prefs.directoryOptIn === 'boolean') body.directoryOptIn = prefs.directoryOptIn;
  if (typeof prefs.showPhoto === 'boolean') body.showPhoto = prefs.showPhoto;
  if (typeof prefs.showPhone === 'boolean') body.showPhone = prefs.showPhone;
  if (typeof prefs.showEmail === 'boolean') body.showEmail = prefs.showEmail;
  if (typeof prefs.showBirthday === 'boolean') body.showBirthday = prefs.showBirthday;
  if (typeof prefs.showAnniversary === 'boolean') body.showAnniversary = prefs.showAnniversary;
  if (typeof prefs.showHousehold === 'boolean') body.showHousehold = prefs.showHousehold;
  if (typeof prefs.showMinistries === 'boolean') body.showMinistries = prefs.showMinistries;

  const { data, error } = await supabase.rpc('update_my_directory_privacy', {
    p_prefs: body,
  });
  if (error) mapRpcError(error);
  const o = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  return sanitizePrivacy(o.privacy);
}

const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_AVATAR_BYTES = 2.5 * 1024 * 1024;

/**
 * Upload avatar to avatars/{userId}/… then persist public URL via profile RPC.
 */
export async function uploadMyProfileAvatar(file: File): Promise<MyMemberProfileResult> {
  const { userId } = await requireSession();

  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
    throw new MemberProfileClientError('invalid_avatar');
  }
  if (file.size <= 0 || file.size > MAX_AVATAR_BYTES) {
    throw new MemberProfileClientError('invalid_avatar');
  }

  const ext =
    file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${userId}/profile-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, {
    upsert: true,
    contentType: file.type,
    cacheControl: '3600',
  });
  if (uploadError) {
    throw new MemberProfileClientError('invalid_avatar', uploadError.message);
  }

  const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
  const url = pub?.publicUrl;
  if (!url || !/^https:\/\//i.test(url)) {
    throw new MemberProfileClientError('invalid_avatar');
  }

  return updateMyMemberProfile({ avatarUrl: url });
}
