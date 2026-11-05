import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  CalendarHeart,
  ClipboardList,
  CreditCard,
  LogOut,
  RefreshCcw,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AWCLogo } from '../components/ui/AWCLogo';
import { Button } from '../components/ui/Button';
import { AccountSecuritySection } from '../components/auth/AccountSecuritySection';
import { TextSignInSection } from '../components/auth/TextSignInSection';
import { SMS_SIGNIN_ENABLED } from '../lib/authPhoneClient';
import { completeMemberOnboarding, MemberSelfError } from '../lib/memberSelfClient';
import {
  prefetchCardChunk,
  prefetchFamilyChunk,
  prefetchKidsPlansChunk,
} from '../lib/prefetchMemberChunks';

function MemberAvatar({
  name,
  email,
  avatarUrl,
}: {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const initials = (name || email || 'M').trim().charAt(0).toUpperCase();

  if (avatarUrl && !failed) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className="w-14 h-14 rounded-2xl object-cover border border-gray-100"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className="w-14 h-14 rounded-2xl bg-burgundy/10 text-burgundy flex items-center justify-center text-lg font-bold"
      aria-hidden
    >
      {initials || <UserRound size={22} />}
    </div>
  );
}

/**
 * Account / session area — not a completed member dashboard.
 * Shows Auth session + sanitized Vault identity when available.
 */
export const MemberAccount: React.FC = () => {
  const {
    user,
    identity,
    identityLoading,
    identityError,
    memberAccessState,
    signOut,
    refreshIdentity,
    applyIdentity,
  } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [completingSetup, setCompletingSetup] = useState(false);
  const [error, setError] = useState('');

  const email = identity?.email || user?.email || 'Signed in';
  const displayName = identity?.name;

  const handleCompleteSetup = async () => {
    if (completingSetup) return;
    setError('');
    setCompletingSetup(true);
    try {
      const member = await completeMemberOnboarding();
      applyIdentity(member);
    } catch (err) {
      if (err instanceof MemberSelfError) {
        setError(err.message);
      } else {
        setError('We could not finish setup right now. Please try again.');
      }
    } finally {
      setCompletingSetup(false);
    }
  };

  const handleSignOut = async () => {
    if (signingOut) return;
    setError('');
    setSigningOut(true);
    try {
      await signOut();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-out failed. Please try again.');
      setSigningOut(false);
    }
  };

  return (
    <main className="flex-1 px-5 pt-10 pb-28">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-burgundy text-sm font-bold min-h-[44px]"
      >
        <ArrowLeft size={18} aria-hidden />
        Back to Connect
      </Link>

      <div className="flex flex-col items-center text-center mt-4 mb-8">
        <AWCLogo size={72} className="mb-3" />
        <p className="text-xs font-black uppercase tracking-widest text-gold-ink mb-1">
          Account / Session
        </p>
        <h1 className="text-2xl font-bold text-[#1A1A1A]">
          {memberAccessState === 'approved_member' ? 'Member account' : 'You are signed in'}
        </h1>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 space-y-5">
        <div className="flex items-center gap-3">
          <MemberAvatar
            name={displayName}
            email={email}
            avatarUrl={identity?.avatarUrl ?? null}
          />
          <div className="text-left min-w-0">
            {displayName && (
              <>
                <p className="text-xs font-black uppercase tracking-widest text-gray-500">Name</p>
                <p className="text-sm font-bold text-[#1A1A1A] truncate mb-1">{displayName}</p>
              </>
            )}
            <p className="text-xs font-black uppercase tracking-widest text-gray-500">Email</p>
            <p className="text-sm font-bold text-[#1A1A1A] truncate">{email}</p>
          </div>
        </div>

        {identityLoading && (
          <p className="text-sm text-gray-500" role="status">
            Verifying your PLCC member profile…
          </p>
        )}

        {memberAccessState === 'approved_member' && (
          <div className="rounded-2xl bg-eggshell border border-gray-100 p-4 text-left space-y-3">
            <p className="text-xs font-black uppercase tracking-widest text-burgundy">
              Approved member
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">
              You can use Community feed, comments, reactions, Chat (including direct
              messages), and start or join Live Huddles from Connect when you have
              access. Church leaders create group channels and run huddle host tools.
            </p>
            <Link
              to="/community"
              className="inline-flex items-center justify-center gap-2 w-full min-h-[48px] rounded-2xl bg-burgundy text-white text-sm font-bold"
            >
              <Users size={18} aria-hidden />
              Open Community
            </Link>
            <Link
              to="/profile"
              className="inline-flex items-center justify-center gap-2 w-full min-h-[48px] rounded-2xl bg-burgundy text-white text-sm font-bold"
            >
              <UserRound size={18} aria-hidden />
              Edit My Profile
            </Link>
            <Link
              to="/card"
              onFocus={() => prefetchCardChunk()}
              onMouseEnter={() => prefetchCardChunk()}
              onTouchStart={() => prefetchCardChunk()}
              className="inline-flex items-center justify-center gap-2 w-full min-h-[48px] rounded-2xl bg-white border border-burgundy/15 text-burgundy text-sm font-bold"
            >
              <CreditCard size={18} aria-hidden />
              My PLCC Card
            </Link>
            <Link
              to="/family"
              onFocus={() => prefetchFamilyChunk()}
              onMouseEnter={() => prefetchFamilyChunk()}
              onTouchStart={() => prefetchFamilyChunk()}
              className="inline-flex items-center justify-center gap-2 w-full min-h-[48px] rounded-2xl bg-white border border-burgundy/15 text-burgundy text-sm font-bold"
            >
              <CalendarHeart size={18} aria-hidden />
              My Family &amp; Kids Cards
            </Link>
            <Link
              to="/kids-plans"
              onFocus={() => prefetchKidsPlansChunk()}
              onMouseEnter={() => prefetchKidsPlansChunk()}
              onTouchStart={() => prefetchKidsPlansChunk()}
              className="inline-flex items-center justify-center gap-2 w-full min-h-[48px] rounded-2xl bg-white border border-burgundy/15 text-burgundy text-sm font-bold"
            >
              <ClipboardList size={18} aria-hidden />
              Kids Plans
            </Link>
            <Link
              to="/my-attendance"
              className="inline-flex items-center justify-center gap-2 w-full min-h-[48px] rounded-2xl bg-white border border-burgundy/15 text-burgundy text-sm font-bold"
            >
              My Attendance
            </Link>
            <Link
              to="/community/chat"
              className="inline-flex items-center justify-center gap-2 w-full min-h-[48px] rounded-2xl bg-white border border-burgundy/15 text-burgundy text-sm font-bold"
            >
              Open Chat
            </Link>
            <Link
              to="/notifications"
              className="inline-flex items-center justify-center gap-2 w-full min-h-[48px] rounded-2xl bg-white border border-gray-200 text-burgundy text-sm font-bold"
            >
              <Bell size={18} aria-hidden />
              Notifications
            </Link>
          </div>
        )}

        {memberAccessState === 'pending' && (
          <div className="rounded-2xl bg-gold/10 border border-gold/20 p-4 text-left space-y-3">
            <p className="text-xs font-black uppercase tracking-widest text-burgundy">
              Welcome to PLCC Connect
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">
              Thank you for joining us. Finish setup to unlock Community, your profile, Chat, and
              other member features. You can keep using public Connect pages anytime.
            </p>
            <Button
              type="button"
              fullWidth
              className="min-h-[48px]"
              onClick={() => void handleCompleteSetup()}
              disabled={completingSetup}
            >
              <ShieldCheck size={18} aria-hidden />
              {completingSetup ? (
                <span role="status">Finishing setup…</span>
              ) : (
                'Complete setup'
              )}
            </Button>
          </div>
        )}

        {memberAccessState === 'identity_missing' && (
          <div className="rounded-2xl bg-red-50 border border-red-100 p-4 text-left space-y-3">
            <p className="text-sm text-red-900 leading-relaxed">
              We could not find a connected PLCC member profile for this sign-in.
            </p>
            <p className="text-xs text-red-800/80 leading-relaxed">
              If this continues, please contact church leadership so they can connect your account.
            </p>
            <Button
              type="button"
              variant="secondary"
              className="min-h-[44px]"
              onClick={() => void refreshIdentity()}
            >
              <RefreshCcw size={16} aria-hidden />
              Retry
            </Button>
          </div>
        )}

        {memberAccessState === 'identity_unavailable' && (
          <div className="rounded-2xl bg-eggshell border border-gray-100 p-4 text-left space-y-3">
            <p className="text-sm text-gray-700 leading-relaxed">
              We could not verify your member access right now. Your sign-in is still active. Please
              try again.
            </p>
            {identityError && (
              <p className="text-xs text-gray-500">{identityError}</p>
            )}
            <Button
              type="button"
              variant="secondary"
              className="min-h-[44px]"
              onClick={() => void refreshIdentity()}
            >
              <RefreshCcw size={16} aria-hidden />
              Try again
            </Button>
          </div>
        )}

        {memberAccessState === 'authenticated_unverified' && !identityLoading && (
          <div className="rounded-2xl bg-eggshell border border-gray-100 p-4 text-left">
            <p className="text-sm text-gray-700 leading-relaxed">
              Your sign-in is active. We still need to verify your PLCC member profile.
            </p>
            <Button
              type="button"
              variant="secondary"
              className="min-h-[44px] mt-3"
              onClick={() => void refreshIdentity()}
            >
              <RefreshCcw size={16} aria-hidden />
              Verify now
            </Button>
          </div>
        )}

        {SMS_SIGNIN_ENABLED ? <TextSignInSection /> : null}

        <AccountSecuritySection />

        {error && (
          <p
            className="text-sm text-red-800 bg-red-50 border border-red-100 rounded-2xl px-4 py-3"
            role="alert"
          >
            {error}
          </p>
        )}

        <Button
          type="button"
          variant="secondary"
          fullWidth
          className="min-h-[52px]"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          <LogOut size={18} aria-hidden />
          {signingOut ? <span role="status">Signing out…</span> : 'Sign out'}
        </Button>
      </div>
    </main>
  );
};
