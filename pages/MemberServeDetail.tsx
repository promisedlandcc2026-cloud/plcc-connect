import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MemberPageHeader } from '../components/member/MemberPageHeader';
import { Button } from '../components/ui/Button';
import { ShareToAwcChatButton } from '../components/ShareToAwcChatButton';
import { ErrorState, LoadingState } from '../components/ui/States';
import { ServeEligibilityNotice } from '../components/serve/ServeEligibilityNotice';
import {
  fetchServeOpportunity,
  postServeCancel,
  postServeSignup,
  ServeClientError,
} from '../lib/serveClient';
import type { ServeEligibilitySummary, ServeOpportunity } from '../lib/serveUi';
import {
  canShowCancelCta,
  canShowSignupCta,
  eligibilityBlockedCopy,
  formatRemainingSlots,
  formatServeWhen,
  mapServeMemberError,
  signupStatusLabel,
} from '../lib/serveUi';

export const MemberServeDetailPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [opportunity, setOpportunity] = useState<ServeOpportunity | null>(null);
  const [eligibility, setEligibility] = useState<ServeEligibilitySummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchServeOpportunity(id);
      setOpportunity(data.opportunity);
      setEligibility(data.eligibility);
    } catch (err) {
      if (err instanceof ServeClientError) {
        setError(err.message);
      } else {
        setError(mapServeMemberError('serve_unavailable'));
      }
      setOpportunity(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSignup = async () => {
    if (!opportunity || acting) return;
    setActing(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const { result } = await postServeSignup(opportunity.id);
      const status = String(result.status || '').toLowerCase();
      if (status === 'pending') {
        setActionSuccess('Signup submitted');
      } else {
        setActionSuccess('You’re signed up!');
      }
      await load();
    } catch (err) {
      if (err instanceof ServeClientError) {
        setActionError(err.message);
        if (err.eligibility) setEligibility(err.eligibility);
        if (
          err.code === 'opportunity_full' ||
          err.code === 'opportunity_not_open' ||
          err.code === 'serve_not_verified' ||
          err.code === 'serve_ineligible' ||
          err.code === 'serve_suspended'
        ) {
          await load();
        }
      } else {
        setActionError(mapServeMemberError('serve_unavailable'));
      }
    } finally {
      setActing(false);
    }
  };

  const onCancel = async () => {
    if (!opportunity || acting) return;
    const ok = window.confirm('Are you sure you want to cancel this Serve signup?');
    if (!ok) return;
    setActing(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await postServeCancel(opportunity.id);
      setActionSuccess('Signup cancelled');
      await load();
    } catch (err) {
      if (err instanceof ServeClientError) {
        setActionError(err.message);
      } else {
        setActionError(mapServeMemberError('serve_unavailable'));
      }
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <main className="flex-1 px-5 pt-10 pb-28">
        <MemberPageHeader title="Serve opportunity" backTo="/serve" backLabel="Serve" />
        <LoadingState message="Loading Serve opportunity…" />
      </main>
    );
  }

  if (error || !opportunity) {
    return (
      <main className="flex-1 px-5 pt-10 pb-28">
        <MemberPageHeader title="Serve opportunity" backTo="/serve" backLabel="Serve" />
        <ErrorState
          message={error || 'That Serve opportunity was not found.'}
          onRetry={() => void load()}
        />
      </main>
    );
  }

  const showSignup = canShowSignupCta(eligibility, opportunity);
  const showCancel = canShowCancelCta(opportunity.mySignupStatus);
  const full = opportunity.remainingSlots === 0;
  const ministryTeam = [opportunity.ministry?.name, opportunity.team?.name]
    .filter(Boolean)
    .join(' · ');

  return (
    <main className="flex-1 px-5 pt-10 pb-28">
      <MemberPageHeader
        title={opportunity.title}
        eyebrow="Serve"
        backTo="/serve"
        backLabel="Serve"
      />

      {eligibility ? (
        <div className="mb-5">
          <ServeEligibilityNotice eligibility={eligibility} />
        </div>
      ) : null}

      <article className="space-y-4">
        {opportunity.roleLabel ? (
          <p className="text-sm font-semibold text-burgundy">{opportunity.roleLabel}</p>
        ) : null}

        {opportunity.description ? (
          <section aria-labelledby="serve-detail-about">
            <h2 id="serve-detail-about" className="text-xs font-black uppercase tracking-widest text-gray-500">
              About
            </h2>
            <p className="mt-2 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {opportunity.description}
            </p>
          </section>
        ) : null}

        <section aria-labelledby="serve-detail-meta" className="rounded-2xl border border-gray-100 bg-white px-4 py-4 space-y-2">
          <h2 id="serve-detail-meta" className="sr-only">
            Schedule and details
          </h2>
          {ministryTeam ? (
            <p className="text-sm text-gray-700">
              <span className="font-semibold text-gray-500">Ministry · </span>
              {ministryTeam}
            </p>
          ) : null}
          {opportunity.event?.title ? (
            <p className="text-sm text-gray-700">
              <span className="font-semibold text-gray-500">Event · </span>
              {opportunity.event.title}
            </p>
          ) : null}
          <p className="text-sm text-gray-700">
            <span className="font-semibold text-gray-500">When · </span>
            {formatServeWhen(opportunity.startsAt, opportunity.endsAt)}
          </p>
          {opportunity.location ? (
            <p className="text-sm text-gray-700">
              <span className="font-semibold text-gray-500">Where · </span>
              {opportunity.location}
            </p>
          ) : null}
          <p className="text-sm text-gray-700">
            <span className="font-semibold text-gray-500">Availability · </span>
            {formatRemainingSlots(opportunity.remainingSlots)}
          </p>
          {opportunity.requiresApproval ? (
            <p className="text-sm text-amber-800 font-medium">Requires approval</p>
          ) : null}
          <p className="text-sm text-gray-700">
            <span className="font-semibold text-gray-500">Your status · </span>
            {signupStatusLabel(opportunity.mySignupStatus)}
          </p>
        </section>

        {actionSuccess ? (
          <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-950" role="status">
            {actionSuccess}
            {opportunity.mySignupStatus ? (
              <span className="ml-2 font-semibold">· {signupStatusLabel(opportunity.mySignupStatus)}</span>
            ) : null}
          </p>
        ) : null}

        {actionError ? (
          <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
            {actionError}
          </p>
        ) : null}

        <div className="space-y-3 pt-1">
          {showSignup ? (
            <div className="space-y-2">
              <Button type="button" fullWidth disabled={acting} onClick={() => void onSignup()}>
                {acting ? 'Signing up…' : 'Sign Up to Serve'}
              </Button>
              <p className="text-xs text-gray-500 text-center leading-relaxed">
                {opportunity.requiresApproval
                  ? 'Your signup will be sent for approval.'
                  : 'Your spot will be confirmed immediately.'}
              </p>
            </div>
          ) : null}

          {!showSignup && !showCancel && eligibility && !eligibility.signupEnabled ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 space-y-2">
              <p className="text-sm text-gray-700 leading-relaxed">
                {eligibilityBlockedCopy(eligibility)}
              </p>
              {eligibility.status === 'not_verified' ? (
                <p className="text-sm font-semibold text-gray-800">Contact church leadership</p>
              ) : null}
            </div>
          ) : null}

          {!showSignup && full && !showCancel ? (
            <p className="text-sm font-bold text-gray-600 text-center" aria-disabled="true">
              Full — signup is unavailable
            </p>
          ) : null}

          {showCancel ? (
            <Button
              type="button"
              variant="secondary"
              fullWidth
              disabled={acting}
              onClick={() => void onCancel()}
            >
              {acting ? 'Cancelling…' : 'Cancel Signup'}
            </Button>
          ) : null}

          {opportunity.status === 'open' || !opportunity.status ? <ShareToAwcChatButton kind="serve" id={opportunity.id} /> : null}

          <Link
            to="/serve/my"
            className="flex items-center justify-center min-h-[44px] text-sm font-bold text-burgundy"
          >
            View My Serving
          </Link>
        </div>
      </article>
    </main>
  );
};
