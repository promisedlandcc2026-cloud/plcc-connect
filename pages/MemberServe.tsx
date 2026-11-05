import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MemberPageHeader } from '../components/member/MemberPageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { ServeEligibilityNotice } from '../components/serve/ServeEligibilityNotice';
import { ServeOpportunityCard } from '../components/serve/ServeOpportunityCard';
import { fetchServeOpportunities } from '../lib/serveClient';
import type { ServeEligibilitySummary, ServeOpportunity } from '../lib/serveUi';
import { asServeUuid } from '../lib/serveUi';

export const MemberServePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const ministryId = asServeUuid(searchParams.get('ministryId'));
  const teamId = asServeUuid(searchParams.get('teamId'));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opportunities, setOpportunities] = useState<ServeOpportunity[]>([]);
  const [eligibility, setEligibility] = useState<ServeEligibilitySummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchServeOpportunities({ ministryId, teamId });
      setOpportunities(data.opportunities);
      setEligibility(data.eligibility);
    } catch {
      setError("We couldn't load Serve opportunities.");
      setOpportunities([]);
    } finally {
      setLoading(false);
    }
  }, [ministryId, teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filterLabel =
    ministryId || teamId
      ? 'Showing filtered Serve opportunities for this ministry or team.'
      : 'Open Serve opportunities for approved members.';

  return (
    <main className="flex-1 px-5 pt-10 pb-28">
      <MemberPageHeader
        title="Serve"
        subtitle={filterLabel}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          to="/serve/my"
          className="inline-flex items-center min-h-[44px] rounded-2xl border border-burgundy/20 bg-white px-4 text-sm font-bold text-burgundy"
        >
          My Serving
        </Link>
        {ministryId || teamId ? (
          <Link
            to="/serve"
            className="inline-flex items-center min-h-[44px] rounded-2xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-600"
          >
            Clear filter
          </Link>
        ) : null}
      </div>

      {eligibility ? (
        <div className="mb-5">
          <ServeEligibilityNotice eligibility={eligibility} />
        </div>
      ) : null}

      {loading ? <LoadingState message="Loading Serve opportunities…" /> : null}

      {!loading && error ? (
        <ErrorState message={error || "We couldn't load Serve opportunities."} onRetry={() => void load()} />
      ) : null}

      {!loading && !error && opportunities.length === 0 ? (
        <EmptyState message="No Serve opportunities are open right now." />
      ) : null}

      {!loading && !error && opportunities.length > 0 ? (
        <section aria-labelledby="serve-directory-heading">
          <h2 id="serve-directory-heading" className="sr-only">
            Open opportunities
          </h2>
          <ul className="space-y-3">
            {opportunities.map((opp) => (
              <ServeOpportunityCard key={opp.id} opportunity={opp} />
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
};
