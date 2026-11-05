import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { buttonClass } from '../components/ui/Button';
import { Link } from 'react-router-dom';
import { MemberPageHeader } from '../components/member/MemberPageHeader';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import {
  fetchMyServing,
  postServeCancel,
  ServeClientError,
} from '../lib/serveClient';
import type { ServeMyItem } from '../lib/serveUi';
import {
  canShowCancelCta,
  formatServeWhen,
  isActiveSignupStatus,
  mapServeMemberError,
  signupStatusLabel,
} from '../lib/serveUi';

function groupItems(items: ServeMyItem[]): {
  upcoming: ServeMyItem[];
  pending: ServeMyItem[];
  past: ServeMyItem[];
} {
  const upcoming: ServeMyItem[] = [];
  const pending: ServeMyItem[] = [];
  const past: ServeMyItem[] = [];
  const now = Date.now();

  for (const item of items) {
    const status = String(item.status || '').toLowerCase();
    if (status === 'pending') {
      pending.push(item);
      continue;
    }
    if (status === 'cancelled' || status === 'declined') {
      past.push(item);
      continue;
    }
    const starts = item.opportunity?.startsAt ? Date.parse(item.opportunity.startsAt) : NaN;
    if (Number.isFinite(starts) && starts < now) {
      past.push(item);
    } else {
      upcoming.push(item);
    }
  }
  return { upcoming, pending, past };
}

const ServeMyCard: React.FC<{
  item: ServeMyItem;
  actingId: string | null;
  onCancel: (opportunityId: string) => void;
}> = ({ item, actingId, onCancel }) => {
  const title = item.opportunity?.title || 'Serve opportunity';
  const ministryTeam = [item.opportunity?.ministry?.name, item.opportunity?.team?.name]
    .filter(Boolean)
    .join(' · ');
  const showCancel = canShowCancelCta(item.status);

  return (
    <li className="rounded-2xl border border-gray-100 bg-white shadow-sm px-4 py-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <Link
          to={`/serve/${item.opportunityId}`}
          className="min-w-0 flex-1 text-base font-bold text-[#1A1A1A] leading-snug focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
        >
          {title}
        </Link>
        <span className="shrink-0 rounded-lg bg-gray-50 px-2 py-1 text-xs font-bold text-gray-700">
          {signupStatusLabel(item.status)}
        </span>
      </div>
      <p className="text-xs text-gray-600">
        {formatServeWhen(item.opportunity?.startsAt, item.opportunity?.endsAt)}
      </p>
      {item.opportunity?.location ? (
        <p className="text-xs text-gray-500">{item.opportunity.location}</p>
      ) : null}
      {ministryTeam ? <p className="text-xs text-gray-500">{ministryTeam}</p> : null}
      {showCancel ? (
        <Button
          type="button"
          variant="secondary"
          className="w-full mt-1"
          disabled={actingId === item.opportunityId}
          onClick={() => onCancel(item.opportunityId)}
        >
          {actingId === item.opportunityId ? 'Cancelling…' : 'Cancel Signup'}
        </Button>
      ) : null}
    </li>
  );
};

export const MemberServeMyPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ServeMyItem[]>([]);
  const [actingId, setActingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMyServing();
      setItems(data.items);
    } catch (err) {
      if (err instanceof ServeClientError) {
        setError(err.message);
      } else {
        setError(mapServeMemberError('serve_unavailable'));
      }
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => groupItems(items), [items]);

  const onCancel = async (opportunityId: string) => {
    const ok = window.confirm('Are you sure you want to cancel this Serve signup?');
    if (!ok) return;
    setActingId(opportunityId);
    setActionError(null);
    try {
      await postServeCancel(opportunityId);
      await load();
    } catch (err) {
      if (err instanceof ServeClientError) {
        setActionError(err.message);
      } else {
        setActionError(mapServeMemberError('serve_unavailable'));
      }
    } finally {
      setActingId(null);
    }
  };

  return (
    <main className="flex-1 px-5 pt-10 pb-28">
      <MemberPageHeader
        title="My Serving"
        eyebrow="Serve"
        subtitle="Your Serve signups and commitments."
        backTo="/serve"
        backLabel="Serve"
      />

      <div className="mb-4">
        <Link
          to="/serve"
          className={buttonClass({ variant: 'secondary' })}
        >
          Browse opportunities
        </Link>
      </div>

      {actionError ? (
        <p className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {actionError}
        </p>
      ) : null}

      {loading ? <LoadingState message="Loading your Serve signups…" /> : null}

      {!loading && error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <EmptyState message="You haven't signed up to serve yet." />
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <div className="space-y-6">
          {groups.pending.length > 0 ? (
            <section aria-labelledby="serve-my-pending">
              <h2 id="serve-my-pending" className="text-xs font-black uppercase tracking-widest text-burgundy mb-3">
                Pending Approval
              </h2>
              <ul className="space-y-3">
                {groups.pending.map((item) => (
                  <ServeMyCard
                    key={item.id}
                    item={item}
                    actingId={actingId}
                    onCancel={(oid) => void onCancel(oid)}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {groups.upcoming.length > 0 ? (
            <section aria-labelledby="serve-my-upcoming">
              <h2 id="serve-my-upcoming" className="text-xs font-black uppercase tracking-widest text-burgundy mb-3">
                Upcoming
              </h2>
              <ul className="space-y-3">
                {groups.upcoming.map((item) => (
                  <ServeMyCard
                    key={item.id}
                    item={item}
                    actingId={actingId}
                    onCancel={(oid) => void onCancel(oid)}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {groups.past.length > 0 ? (
            <section aria-labelledby="serve-my-past">
              <h2 id="serve-my-past" className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">
                Past / Cancelled
              </h2>
              <ul className="space-y-3">
                {groups.past.map((item) => (
                  <ServeMyCard
                    key={item.id}
                    item={item}
                    actingId={actingId}
                    onCancel={(oid) => void onCancel(oid)}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {/* Fallback if grouping left nothing labeled but items exist */}
          {groups.pending.length === 0 &&
          groups.upcoming.length === 0 &&
          groups.past.length === 0 ? (
            <ul className="space-y-3">
              {items.map((item) => (
                <ServeMyCard
                  key={item.id}
                  item={item}
                  actingId={actingId}
                  onCancel={(oid) => void onCancel(oid)}
                />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {/* Keep active commitments visible even when eligibility later changes — list is unfiltered by eligibility */}
      {!loading && !error && items.some((i) => isActiveSignupStatus(i.status)) ? (
        <p className="mt-6 text-xs text-gray-500 text-center leading-relaxed">
          Existing commitments stay listed here even if Serve eligibility changes later.
        </p>
      ) : null}
    </main>
  );
};
