/**
 * Phase 2.8A — My Profile & Privacy Preferences (Connect).
 */
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, CreditCard, Home, Settings, Users } from 'lucide-react';
import { ListGroup, ListRow } from '../components/ui/ListRow';
import { AcknowledgementsSection } from '../components/member/AcknowledgementsSection';
import { MemberPageHeader } from '../components/member/MemberPageHeader';
import { MemberHowToNote } from '../components/member/MemberHowToNote';
import { Button } from '../components/ui/Button';
import { BirthdayMonthDay } from '../components/ui/BirthdayMonthDay';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { useAuth } from '../context/AuthContext';
import { cardInitials } from '../lib/memberCardUi';
import {
  fetchMyMemberProfile,
  MemberProfileClientError,
  memberProfileErrorMessage,
  updateMyDirectoryPrivacy,
  updateMyMemberProfile,
  uploadMyProfileAvatar,
  type MemberDirectoryPrivacy,
  type MemberProfile,
  type MyMemberProfileResult,
} from '../lib/memberProfileClient';
import { prefetchCardChunk, prefetchFamilyChunk } from '../lib/prefetchMemberChunks';
import { AnniversaryKindPicker } from '../components/member/AnniversaryKindPicker';
import {
  CelebrationsUnavailableError,
  getMyAnniversaryKind,
  updateMyAnniversaryKind,
} from '../lib/celebrationsClient';
import type { AnniversaryKind } from '../lib/blessings';

function profileErrorText(err: unknown): string {
  if (err instanceof MemberProfileClientError) {
    return err.message || memberProfileErrorMessage(err.code);
  }
  return memberProfileErrorMessage('profile_unavailable');
}

function PrivacyToggle({
  id,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex items-start justify-between gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3.5 ${
        disabled ? 'opacity-60' : ''
      }`}
    >
      <span className="min-w-0">
        <span className="block text-sm font-bold text-[#1A1A1A]">{label}</span>
        {hint ? <span className="block text-xs text-gray-500 mt-0.5 leading-relaxed">{hint}</span> : null}
      </span>
      <input
        id={id}
        type="checkbox"
        className="mt-1 h-5 w-5 accent-[#0d1a14] shrink-0"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export const MemberProfilePage: React.FC = () => {
  const fileInputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const { identity } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [privacySaving, setPrivacySaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [linked, setLinked] = useState(false);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [privacy, setPrivacy] = useState<MemberDirectoryPrivacy | null>(null);

  const [preferredName, setPreferredName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthday, setBirthday] = useState('');
  const [anniversary, setAnniversary] = useState('');
  const [anniversaryKind, setAnniversaryKind] = useState<AnniversaryKind | null>(null);
  const [anniversaryLabel, setAnniversaryLabel] = useState('');

  const applyResult = useCallback((result: MyMemberProfileResult) => {
    setLinked(result.linked);
    setProfile(result.profile);
    setPrivacy(result.privacy);
    setPreferredName(result.profile?.preferredName || '');
    setPhone(result.profile?.phone || '');
    setBirthday(result.profile?.birthday || '');
    setAnniversary(result.profile?.anniversary || '');
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      applyResult(await fetchMyMemberProfile());
      const mine = await getMyAnniversaryKind().catch(() => null);
      setAnniversaryKind(mine?.kind ?? null);
      setAnniversaryLabel(mine?.label ?? '');
    } catch (err) {
      setError(profileErrorText(err));
      setLinked(false);
      setProfile(null);
      setPrivacy(null);
    } finally {
      setLoading(false);
    }
  }, [applyResult]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaveMessage(null);
    setError(null);
    try {
      const result = await updateMyMemberProfile({
        preferredName: preferredName.trim() || null,
        phone: phone.trim() || null,
        birthday: birthday.trim() || null,
        anniversary: anniversary.trim() || null,
      });
      applyResult(result);
      let note = '';
      try {
        const hasDate = Boolean(anniversary.trim());
        await updateMyAnniversaryKind(hasDate ? anniversaryKind : null, hasDate ? anniversaryLabel : null);
        if (!hasDate) {
          setAnniversaryKind(null);
          setAnniversaryLabel('');
        }
      } catch (kindErr) {
        note =
          kindErr instanceof CelebrationsUnavailableError
            ? ' (Anniversary type will be saved once church setup is finished.)'
            : ` ${(kindErr as Error).message}`;
      }
      setSaveMessage(`Profile saved.${note}`);
    } catch (err) {
      setError(profileErrorText(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarPick = async (file: File | null) => {
    if (!file || saving) return;
    setSaving(true);
    setSaveMessage(null);
    setError(null);
    try {
      applyResult(await uploadMyProfileAvatar(file));
      setSaveMessage('Photo updated.');
    } catch (err) {
      setError(profileErrorText(err));
    } finally {
      setSaving(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handlePrivacyChange = async (patch: Partial<MemberDirectoryPrivacy>) => {
    if (!privacy || privacySaving) return;
    const optimistic = { ...privacy, ...patch };
    setPrivacy(optimistic);
    setPrivacySaving(true);
    setError(null);
    try {
      setPrivacy(await updateMyDirectoryPrivacy(patch));
    } catch (err) {
      setError(profileErrorText(err));
      await load();
    } finally {
      setPrivacySaving(false);
    }
  };

  return (
    <main className="flex-1 px-5 pt-10 pb-28 max-w-[500px] w-full mx-auto">
      <MemberPageHeader
        title="My Profile"
        subtitle="Your photo, preferred name, contact details, and directory privacy."
        backTo="/me"
        backLabel="Me"
      />

      {loading ? <LoadingState message="Loading your profile…" /> : null}

      {!loading && error && !profile ? (
        <ErrorState message={error} onRetry={() => void load()} retryLabel="Retry" />
      ) : null}

      {!loading && !error && !linked ? (
        <div className="rounded-2xl border border-gray-100 bg-white px-4 py-2 shadow-sm">
          <EmptyState
            message="Profile not linked yet"
            hint="Church leadership still needs to connect your sign-in to your member record."
          />
        </div>
      ) : null}

      {!loading && linked && profile ? (
        <div className="space-y-8">
          {error ? (
            <div className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-900">
              {error}
            </div>
          ) : null}
          {saveMessage ? (
            <p className="text-sm font-semibold text-emerald-800" role="status">
              {saveMessage}
            </p>
          ) : null}

          <section aria-labelledby="profile-photo-heading" className="space-y-3">
            <h2 id="profile-photo-heading" className="text-sm font-black text-[#1A1A1A]">
              Photo & name
            </h2>
            <div className="rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-sm space-y-4">
              <div className="flex items-center gap-4">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt=""
                    className="h-16 w-16 rounded-2xl object-cover border border-burgundy/15"
                  />
                ) : (
                  <div
                    className="h-16 w-16 rounded-2xl bg-gold-cream text-burgundy border border-gold/30 flex items-center justify-center text-lg font-black"
                    aria-hidden
                  >
                    {cardInitials(profile.displayName)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-burgundy truncate">{profile.displayName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {[profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Legal name on file'}
                  </p>
                  <input
                    ref={fileRef}
                    id={fileInputId}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => void handleAvatarPick(e.target.files?.[0] || null)}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="mt-2 min-h-[40px] text-sm"
                    disabled={saving}
                    onClick={() => fileRef.current?.click()}
                  >
                    <Camera size={16} aria-hidden />
                    Change photo
                  </Button>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-3">
                <label className="block space-y-1">
                  <span className="text-xs font-black uppercase tracking-widest text-gold-ink">
                    Preferred name
                  </span>
                  <input
                    type="text"
                    value={preferredName}
                    onChange={(e) => setPreferredName(e.target.value)}
                    maxLength={80}
                    className="w-full min-h-[44px] rounded-xl bg-gray-50 px-3 text-sm font-semibold text-[#1A1A1A] outline-none focus:ring-2 focus:ring-gold/40"
                    placeholder="What should people call you?"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-black uppercase tracking-widest text-gold-ink">
                    Phone
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={40}
                    className="w-full min-h-[44px] rounded-xl bg-gray-50 px-3 text-sm font-semibold text-[#1A1A1A] outline-none focus:ring-2 focus:ring-gold/40"
                    placeholder="Mobile number"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-black uppercase tracking-widest text-gold-ink">
                    Email
                  </span>
                  <input
                    type="email"
                    value={profile.email || ''}
                    readOnly
                    className="w-full min-h-[44px] rounded-xl bg-gray-50/80 px-3 text-sm text-gray-600 outline-none"
                  />
                  <span className="block text-xs text-gray-500">
                    Contact email is managed with your church record. Sign-in email is not changed here.
                  </span>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <div className="block space-y-1 col-span-2">
                    <span className="text-xs font-black uppercase tracking-widest text-gold-ink">
                      Birthday
                    </span>
                    <BirthdayMonthDay
                      value={birthday}
                      onChange={setBirthday}
                      selectClassName="w-full min-h-[48px] rounded-xl bg-gray-50 px-3 text-base font-semibold text-[#1A1A1A] outline-none focus:ring-2 focus:ring-gold/40"
                    />
                    <span className="block text-xs text-gray-500">Month and day are enough. Your birth year is optional.</span>
                  </div>
                  <label className="block space-y-1">
                    <span className="text-xs font-black uppercase tracking-widest text-gold-ink">
                      Anniversary
                    </span>
                    <input
                      type="date"
                      value={anniversary}
                      onChange={(e) => setAnniversary(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl bg-gray-50 px-3 text-sm font-semibold text-[#1A1A1A] outline-none focus:ring-2 focus:ring-gold/40"
                    />
                  </label>
                  {anniversary ? (
                    <div className="col-span-2">
                      <AnniversaryKindPicker
                        kind={anniversaryKind}
                        label={anniversaryLabel}
                        onKind={setAnniversaryKind}
                        onLabel={setAnniversaryLabel}
                      />
                    </div>
                  ) : null}
                </div>

                <Button type="submit" fullWidth disabled={saving}>
                  {saving ? 'Saving…' : 'Save profile'}
                </Button>
              </form>
            </div>
          </section>

          <section aria-labelledby="profile-status-heading" className="space-y-3">
            <h2 id="profile-status-heading" className="text-sm font-black text-[#1A1A1A]">
              Membership
            </h2>
            <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm space-y-2">
              <p className="text-xs text-gray-500">Status</p>
              <p className="font-bold text-burgundy">{profile.membershipStatus || 'On file'}</p>
              {profile.householdState === 'linked' && profile.householdName ? (
                <p className="text-sm text-gray-600 flex items-center gap-2">
                  <Home size={14} className="text-gold shrink-0" aria-hidden />
                  {profile.householdName}
                </p>
              ) : profile.householdState === 'conflict' ? (
                <p className="text-xs text-gray-500">Household needs staff review.</p>
              ) : (
                <p className="text-xs text-gray-500">No structured household on file.</p>
              )}
            </div>
          </section>

          {profile.ministries.length > 0 ? (
            <section aria-labelledby="profile-ministries-heading" className="space-y-3">
              <h2 id="profile-ministries-heading" className="text-sm font-black text-[#1A1A1A]">
                Ministries
              </h2>
              <div className="flex flex-wrap gap-2">
                {profile.ministries.map((m) => (
                  <span
                    key={m}
                    className="inline-flex items-center gap-1 rounded-lg bg-white border border-gray-100 px-2.5 py-1.5 text-xs font-bold text-burgundy shadow-sm"
                  >
                    <Users size={12} aria-hidden />
                    {m}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-500">Ministry membership is managed by leadership for now.</p>
            </section>
          ) : null}

          <ListGroup label="Your PLCC tools">
            <ListRow to="/card" title="My PLCC Card" subtitle="Membership card and QR" icon={CreditCard} emoji="🪪" onPrefetch={prefetchCardChunk} />
            <ListRow to="/family" title="My Family" subtitle="Household and kids cards" icon={Home} emoji="👨‍👩‍👧‍👦" onPrefetch={prefetchFamilyChunk} />
            <ListRow to="/account" title="Account" subtitle="Security and sign out" icon={Settings} emoji="⚙️" />
          </ListGroup>

          {privacy ? (
            <section aria-labelledby="profile-privacy-heading" className="space-y-3">
              <div className="space-y-1">
                <h2 id="profile-privacy-heading" className="text-sm font-black text-[#1A1A1A]">
                  Privacy & directory
                </h2>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Everything starts private. The Member Directory only shows people who opt in,
                  and only the fields you allow. Children are never listed automatically.
                </p>
              </div>

              <MemberHowToNote focus="privacy" />

              <Link
                to="/directory"
                className="inline-flex text-xs font-bold text-burgundy min-h-[44px] items-center"
              >
                Open Member Directory
              </Link>

              <PrivacyToggle
                id="dir-opt-in"
                label="Show me in the Member Directory"
                hint="When this is on, approved members can find you in More → Directory."
                checked={privacy.directoryOptIn}
                disabled={privacySaving}
                onChange={(next) => void handlePrivacyChange({ directoryOptIn: next })}
              />

              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-widest text-gold-ink px-1">
                  What others may see
                </p>
                <PrivacyToggle
                  id="show-photo"
                  label="Photo"
                  checked={privacy.showPhoto}
                  disabled={privacySaving || !privacy.directoryOptIn}
                  onChange={(next) => void handlePrivacyChange({ showPhoto: next })}
                />
                <PrivacyToggle
                  id="show-phone"
                  label="Phone"
                  checked={privacy.showPhone}
                  disabled={privacySaving || !privacy.directoryOptIn}
                  onChange={(next) => void handlePrivacyChange({ showPhone: next })}
                />
                <PrivacyToggle
                  id="show-email"
                  label="Email"
                  checked={privacy.showEmail}
                  disabled={privacySaving || !privacy.directoryOptIn}
                  onChange={(next) => void handlePrivacyChange({ showEmail: next })}
                />
                <PrivacyToggle
                  id="show-birthday"
                  label="Birthday (month & day)"
                  hint="Never shares your birth year in the directory."
                  checked={privacy.showBirthday}
                  disabled={privacySaving || !privacy.directoryOptIn}
                  onChange={(next) => void handlePrivacyChange({ showBirthday: next })}
                />
                <PrivacyToggle
                  id="show-anniversary"
                  label="Anniversary (month & day)"
                  checked={privacy.showAnniversary}
                  disabled={privacySaving || !privacy.directoryOptIn}
                  onChange={(next) => void handlePrivacyChange({ showAnniversary: next })}
                />
                <PrivacyToggle
                  id="show-household"
                  label="Household / family name"
                  checked={privacy.showHousehold}
                  disabled={privacySaving || !privacy.directoryOptIn}
                  onChange={(next) => void handlePrivacyChange({ showHousehold: next })}
                />
                <PrivacyToggle
                  id="show-ministries"
                  label="Ministries"
                  checked={privacy.showMinistries}
                  disabled={privacySaving || !privacy.directoryOptIn}
                  onChange={(next) => void handlePrivacyChange({ showMinistries: next })}
                />
              </div>
            </section>
          ) : null}

          <AcknowledgementsSection mediaNotice={identity?.mediaNotice ?? null} />
        </div>
      ) : null}
    </main>
  );
};

export default MemberProfilePage;
