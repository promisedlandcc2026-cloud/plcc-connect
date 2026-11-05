import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Church, Loader2, Users } from 'lucide-react';
import { MemberPageHeader } from '../components/member/MemberPageHeader';
import { MemberHowToNote } from '../components/member/MemberHowToNote';
import {
  fetchMinistryDirectory,
  type MinistryHub,
} from '../lib/ministryHubData';

type MinistryCardProps = {
  ministry: MinistryHub;
};

const MinistryCard: React.FC<MinistryCardProps> = ({ ministry }) => {
  const teamHint =
    ministry.teams.length === 0
      ? null
      : ministry.teams.length === 1
        ? ministry.teams[0].name
        : `${ministry.teams.length} teams`;

  return (
    <li>
      <Link
        to={`/ministries/${ministry.slug}`}
        className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3.5 min-h-[72px] shadow-sm active:scale-[0.99] transition-transform"
      >
        <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-burgundy/10 text-burgundy">
          <Church size={20} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-[#1A1A1A]">{ministry.name}</p>
            {ministry.isMember ? (
              <span className="text-xs font-black uppercase tracking-widest text-burgundy bg-burgundy/10 px-2 py-0.5 rounded-full">
                My ministry
              </span>
            ) : null}
          </div>
          {ministry.description ? (
            <p className="mt-1 text-xs text-gray-500 leading-relaxed line-clamp-2">
              {ministry.description}
            </p>
          ) : teamHint ? (
            <p className="mt-1 text-xs text-gray-500">{teamHint}</p>
          ) : (
            <p className="mt-1 text-xs text-gray-500">Open to learn more</p>
          )}
          <p className="mt-2 text-xs font-black uppercase tracking-widest text-burgundy">
            Open Ministry
          </p>
        </div>
      </Link>
    </li>
  );
};

/** Approved-member ministry directory — live Vault ministries catalog. */
export const MemberMinistriesPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myMinistries, setMyMinistries] = useState<MinistryHub[]>([]);
  const [explore, setExplore] = useState<MinistryHub[]>([]);
  const [membershipAvailable, setMembershipAvailable] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMinistryDirectory();
      setMyMinistries(data.myMinistries);
      setExplore(data.exploreMinistries);
      setMembershipAvailable(data.membershipAvailable);
    } catch {
      setError('Could not load ministries right now.');
      setMyMinistries([]);
      setExplore([]);
      setMembershipAvailable(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="flex-1 px-5 pt-10 pb-28">
      <MemberPageHeader
        title="Ministries"
        subtitle="Enter a ministry hub to stay connected with church life."
        backTo="/"
        backLabel="Home"
      />

      <div className="mb-6">
        <MemberHowToNote focus="ministries" />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
          <Loader2 size={16} className="animate-spin" aria-hidden />
          Loading ministries…
        </div>
      ) : null}

      {!loading && error ? (
        <div className="rounded-2xl border border-burgundy/15 bg-white p-4 space-y-3">
          <p className="text-sm text-gray-600">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="text-xs font-black uppercase tracking-widest text-burgundy min-h-[44px]"
          >
            Try again
          </button>
        </div>
      ) : null}

      {!loading && !error && explore.length === 0 && myMinistries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white/70 px-4 py-8 text-center">
          <Users size={22} className="mx-auto text-gray-500 mb-2" aria-hidden />
          <p className="text-sm text-gray-500">No ministries are listed yet.</p>
        </div>
      ) : null}

      {!loading && !error && membershipAvailable && myMinistries.length > 0 ? (
        <section className="mb-8" aria-labelledby="my-ministries-heading">
          <h2
            id="my-ministries-heading"
            className="text-xs font-black uppercase tracking-[0.18em] text-burgundy mb-3 px-0.5"
          >
            My Ministries
          </h2>
          <ul className="space-y-2">
            {myMinistries.map((m) => (
              <MinistryCard key={m.id} ministry={m} />
            ))}
          </ul>
        </section>
      ) : null}

      {!loading && !error && explore.length > 0 ? (
        <section aria-labelledby="explore-ministries-heading">
          <h2
            id="explore-ministries-heading"
            className="text-xs font-black uppercase tracking-[0.18em] text-burgundy mb-3 px-0.5"
          >
            {membershipAvailable && myMinistries.length > 0
              ? 'Explore Ministries'
              : 'All Ministries'}
          </h2>
          <ul className="space-y-2">
            {explore.map((m) => (
              <MinistryCard key={m.id} ministry={m} />
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
};
