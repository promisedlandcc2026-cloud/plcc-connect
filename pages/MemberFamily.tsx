import React, { useCallback, useEffect, useState } from 'react';
import { buttonClass } from '../components/ui/Button';
import { Loader2, Radio, Share2, Users } from 'lucide-react';
import { MemberPageHeader } from '../components/member/MemberPageHeader';
import { ErrorState, LoadingState } from '../components/ui/States';
import { FamilyMemberCard } from '../components/family/FamilyMemberCard';
import { FamilyStatusPanel } from '../components/family/FamilyStatusPanel';
import { FamilyVoiceHuddle } from '../components/family/FamilyVoiceHuddle';
import {
  createFamilyHuddleInvite,
  fetchFamilyHuddleStatus,
} from '../lib/familyHuddleClient';
import { FamilyHuddleError } from '../lib/familyHuddleTypes';
import {
  FamilyClientError,
  fetchMyFamilySummary,
} from '../lib/familyClient';
import type { FamilySummary } from '../lib/familyTypes';
import {
  familyErrorMessage,
  familySummaryState,
} from '../lib/familyUi';

type HuddleMode = 'start' | 'join' | null;

function inviteExpiryLabel(expiresAt: string | null): string {
  if (!expiresAt) return 'Expires in 2 hours';
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return 'Expired';
  const mins = Math.max(1, Math.round(ms / 60000));
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `Expires in ${h}h ${m}m` : `Expires in ${h}h`;
  }
  return `Expires in ${mins}m`;
}

export const MemberFamilyPage: React.FC = () => {
  const [summary, setSummary] = useState<FamilySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [huddleLive, setHuddleLive] = useState(false);
  const [huddleCount, setHuddleCount] = useState(0);
  const [huddleConfigured, setHuddleConfigured] = useState(true);
  const [huddleMode, setHuddleMode] = useState<HuddleMode>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMyFamilySummary();
      setSummary(data);
    } catch (err) {
      const code = err instanceof FamilyClientError ? err.code : 'family_unavailable';
      setError(familyErrorMessage(code));
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const state = summary ? familySummaryState(summary) : null;
  const huddleEligible = state === 'ready';

  const refreshHuddleStatus = useCallback(async () => {
    if (!huddleEligible) {
      setHuddleLive(false);
      setHuddleCount(0);
      return;
    }
    try {
      const status = await fetchFamilyHuddleStatus();
      setHuddleConfigured(status.configured);
      setHuddleLive(status.live);
      setHuddleCount(status.participantCount);
    } catch {
      /* soft — keep last known */
    }
  }, [huddleEligible]);

  useEffect(() => {
    if (!huddleEligible) return;
    void refreshHuddleStatus();
    const id = window.setInterval(() => void refreshHuddleStatus(), 10_000);
    return () => window.clearInterval(id);
  }, [huddleEligible, refreshHuddleStatus]);

  const shareInvite = useCallback(async () => {
    setShareBusy(true);
    setShareError(null);
    setShareMsg(null);
    try {
      const invite = await createFamilyHuddleInvite();
      const url = `${window.location.origin}${invite.path}`;
      const text = `Join our Family Huddle on PLCC Connect (${inviteExpiryLabel(invite.expiresAt)})`;
      if (navigator.share) {
        try {
          await navigator.share({ title: 'Family Huddle', text, url });
          setShareMsg('Invite shared.');
          return;
        } catch {
          /* fall through */
        }
      }
      await navigator.clipboard.writeText(url);
      setShareMsg(`Link copied · ${inviteExpiryLabel(invite.expiresAt)}`);
    } catch (err) {
      setShareError(
        err instanceof FamilyHuddleError
          ? err.message
          : 'Could not create invite link.'
      );
    } finally {
      setShareBusy(false);
    }
  }, []);

  return (
    <main className="flex-1 px-5 pt-10 pb-28 max-w-[500px] w-full mx-auto">
      <MemberPageHeader
        title="My Family"
        subtitle="View the family connections PLCC has on file for your account."
      />

      <p className="mb-5 text-xs text-gray-500 leading-relaxed">
        Family information is shown only from PLCC’s verified household and guardian records.
      </p>

      {loading ? <LoadingState message="Loading your family…" /> : null}

      {!loading && error ? (
        <ErrorState message={error} onRetry={() => void load()} retryLabel="Retry" />
      ) : null}

      {!loading && !error && summary && state ? (
        <div className="space-y-6">
          <FamilyStatusPanel state={state} summary={summary} />

          {huddleEligible ? (
            <section
              aria-labelledby="family-huddle-heading"
              className="rounded-3xl border border-burgundy/15 bg-white p-5 space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <h2 id="family-huddle-heading" className="text-sm font-black text-[#1A1A1A]">
                    Family Huddle
                  </h2>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Private live video for household adults. Guests can join with a share link.
                    Children & dependents are not on camera in this version. No recording.
                  </p>
                </div>
                {huddleLive ? (
                  <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-red-600 text-white text-xs font-black uppercase tracking-wider px-2.5 py-1">
                    <Radio size={12} aria-hidden />
                    LIVE
                    {huddleCount > 0 ? (
                      <span className="font-bold normal-case tracking-normal">
                        · {huddleCount}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </div>

              {!huddleConfigured ? (
                <p className="text-sm text-gray-500">
                  Family Huddle is not configured yet. Check back soon.
                </p>
              ) : (
                <div className="space-y-2">
                  {huddleLive ? (
                    <button
                      type="button"
                      onClick={() => setHuddleMode('join')}
                      className={buttonClass({ fullWidth: true })}
                    >
                      <Users size={16} aria-hidden />
                      Join Family Huddle
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setHuddleMode('start')}
                      className={buttonClass({ fullWidth: true })}
                    >
                      <Radio size={16} aria-hidden />
                      Start Family Huddle
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void shareInvite()}
                    disabled={shareBusy}
                    className={buttonClass({ variant: 'secondary', fullWidth: true })}
                  >
                    {shareBusy ? (
                      <Loader2 size={16} className="animate-spin" aria-hidden />
                    ) : (
                      <Share2 size={16} aria-hidden />
                    )}
                    Share invite link
                  </button>
                  {shareMsg ? (
                    <p className="text-xs text-emerald-700 font-medium">{shareMsg}</p>
                  ) : null}
                  {shareError ? (
                    <p className="text-xs text-red-600 font-medium">{shareError}</p>
                  ) : null}
                </div>
              )}
            </section>
          ) : null}

          {summary.linked && summary.self ? (
            <section aria-labelledby="family-self-heading" className="space-y-3">
              <h2 id="family-self-heading" className="text-sm font-black text-[#1A1A1A]">
                Your Profile
              </h2>
              <FamilyMemberCard
                variant="self"
                displayName={summary.self.displayName}
                avatarUrl={summary.self.avatarUrl}
              />
            </section>
          ) : null}

          {summary.linked && state !== 'unlinked' && state !== 'household_conflict' ? (
            <>
              {summary.adults.length > 0 ? (
                <section aria-labelledby="family-adults-heading" className="space-y-3">
                  <div className="space-y-1">
                    <h2 id="family-adults-heading" className="text-sm font-black text-[#1A1A1A]">
                      Adults in Your Household
                    </h2>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Adult membership cards are private to each person’s account.
                    </p>
                  </div>
                  <ul className="space-y-2">
                    {summary.adults.map((adult, idx) => (
                      <li key={`adult-${idx}-${adult.displayName}`}>
                        <FamilyMemberCard
                          variant="adult"
                          displayName={adult.displayName}
                          avatarUrl={adult.avatarUrl}
                          relationship={adult.relationship}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          ) : null}

          {summary.linked && summary.dependents.length > 0 && state !== 'unlinked' ? (
            <section aria-labelledby="family-dependents-heading" className="space-y-3">
              <div className="space-y-1">
                <h2 id="family-dependents-heading" className="text-sm font-black text-[#1A1A1A]">
                  Children & Dependents
                </h2>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Kids check-in cards: open <span className="font-semibold">View Child Card &amp; Code</span>{' '}
                  for the QR and desk check-in code when Family card access is enabled.
                </p>
              </div>
              <ul className="space-y-2">
                {summary.dependents.map((dep, idx) => (
                  <li key={`dep-${idx}-${dep.displayName}`}>
                    <FamilyMemberCard
                      variant="dependent"
                      displayName={dep.displayName}
                      relationship={dep.relationship}
                      cardAccess={dep.cardAccess}
                      cardRef={dep.cardRef}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section
            className="rounded-3xl border border-dashed border-gray-200 bg-white/70 p-5 space-y-3"
            aria-labelledby="family-help-heading"
          >
            <h2 id="family-help-heading" className="text-sm font-black text-[#1A1A1A]">
              Something doesn’t look right?
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              PLCC staff can help update household or guardian information.
            </p>
            <a
              href="mailto:info@sanctum-live-nine.vercel.app"
              className="inline-flex w-full min-h-[48px] items-center justify-center rounded-2xl bg-white border border-burgundy/15 text-burgundy text-sm font-bold"
            >
              Contact PLCC
            </a>
          </section>
        </div>
      ) : null}

      {huddleMode ? (
        <FamilyVoiceHuddle
          mode={huddleMode}
          householdName={summary?.household?.name || null}
          onClose={() => {
            setHuddleMode(null);
            void refreshHuddleStatus();
          }}
        />
      ) : null}
    </main>
  );
};
