import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { FamilyVoiceHuddle } from '../components/family/FamilyVoiceHuddle';
import { redeemFamilyHuddleInvite } from '../lib/familyHuddleClient';
import {
  FamilyHuddleError,
  type FamilyHuddleJoinToken,
} from '../lib/familyHuddleTypes';

const NAME_MAX = 40;

/**
 * Public guest join — invite link only. No church account required.
 * Soft gate copy: invited by a family on PLCC Connect.
 */
export const FamilyHuddleJoinPage: React.FC = () => {
  const [params] = useSearchParams();
  const code = useMemo(
    () => String(params.get('code') || params.get('token') || '').trim(),
    [params]
  );
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guestToken, setGuestToken] = useState<FamilyHuddleJoinToken | null>(null);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) {
      setError('This invite link is missing a code.');
      return;
    }
    const name = displayName.trim();
    if (!name) {
      setError('Enter your name to join.');
      return;
    }
    if (name.length > NAME_MAX) {
      setError(`Name must be ${NAME_MAX} characters or fewer.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = await redeemFamilyHuddleInvite(code, name);
      setGuestToken(token);
    } catch (err) {
      setError(
        err instanceof FamilyHuddleError
          ? err.message
          : 'Could not join with that invite.'
      );
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <main className="min-h-[100dvh] flex flex-col items-center justify-center px-5 bg-[#faf7f5]">
        <p className="text-sm text-gray-600 text-center">
          You left the Family Huddle. You can close this tab.
        </p>
      </main>
    );
  }

  if (guestToken) {
    return (
      <FamilyVoiceHuddle
        mode="join"
        guestToken={guestToken}
        householdName={guestToken.householdName}
        onClose={() => {
          setGuestToken(null);
          setDone(true);
        }}
      />
    );
  }

  return (
    <main className="min-h-[100dvh] flex flex-col bg-[#faf7f5]">
      <div className="flex-1 flex flex-col justify-center px-5 py-12 max-w-[420px] w-full mx-auto">
        <p className="text-xs font-black uppercase tracking-widest text-burgundy/70 mb-2">
          PLCC Connect
        </p>
        <h1 className="text-2xl font-black text-[#1A1A1A] mb-2">Family Huddle</h1>
        <p className="text-sm text-gray-600 leading-relaxed mb-6">
          You were invited by a family on PLCC Connect. Enter a display name to join
          their private live huddle. This does not create a church account or add you
          to their household.
        </p>

        {!code ? (
          <p className="text-sm text-red-600 font-medium">
            This invite link is incomplete. Ask your family for a new share link.
          </p>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-gray-700">Your name</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={NAME_MAX}
                autoComplete="nickname"
                placeholder="How should they see you?"
                className="w-full min-h-[48px] rounded-2xl border border-gray-200 bg-white px-4 text-sm text-[#1A1A1A] outline-none focus:border-burgundy/40"
              />
            </label>
            {error ? (
              <p className="text-sm text-red-600 font-medium">{error}</p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="w-full min-h-[48px] rounded-2xl bg-burgundy text-white text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
              {busy ? 'Joining…' : 'Join Family Huddle'}
            </button>
          </form>
        )}

        <p className="mt-8 text-xs text-gray-500 leading-relaxed text-center">
          Family only · no recording · adults and invited guests
        </p>
      </div>
    </main>
  );
};
