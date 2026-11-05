/**
 * Phase 2.6C.4B — Family status / household panels (read-only).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import type { FamilySummary, FamilySummaryState } from '../../lib/familyTypes';
import {
  familyEmptyCopy,
  familyHouseholdConflictCopy,
  familyUnlinkedCopy,
} from '../../lib/familyUi';

type Props = {
  state: FamilySummaryState;
  summary: FamilySummary | null;
};

export const FamilyStatusPanel: React.FC<Props> = ({ state, summary }) => {
  if (state === 'unlinked') {
    return (
      <section
        className="rounded-3xl border border-gold/25 bg-gold/10 p-5 space-y-3"
        aria-labelledby="family-unlinked-title"
      >
        <h2 id="family-unlinked-title" className="text-base font-black text-[#1A1A1A]">
          Your family profile isn’t linked yet.
        </h2>
        <p className="text-sm text-gray-700 leading-relaxed">{familyUnlinkedCopy()}</p>
        <a
          href="mailto:info@sanctum-live-nine.vercel.app"
          className="inline-flex w-full min-h-[48px] items-center justify-center rounded-2xl bg-burgundy text-white text-sm font-bold"
        >
          Contact PLCC
        </a>
        <Link
          to="/prayer"
          className="inline-flex w-full min-h-[44px] items-center justify-center rounded-2xl bg-white border border-burgundy/15 text-burgundy text-sm font-bold"
        >
          Ask for help in Prayer
        </Link>
      </section>
    );
  }

  if (state === 'household_conflict') {
    return (
      <section
        className="rounded-3xl border border-gold/30 bg-gold/10 p-5 space-y-3"
        aria-labelledby="family-conflict-title"
        role="status"
      >
        <h2 id="family-conflict-title" className="text-base font-black text-[#1A1A1A]">
          We found more than one active household connection.
        </h2>
        <p className="text-sm text-gray-700 leading-relaxed">{familyHouseholdConflictCopy()}</p>
        <a
          href="mailto:info@sanctum-live-nine.vercel.app"
          className="inline-flex w-full min-h-[48px] items-center justify-center rounded-2xl bg-burgundy text-white text-sm font-bold"
        >
          Ask PLCC staff for help
        </a>
      </section>
    );
  }

  if (state === 'empty_family') {
    return (
      <section
        className="rounded-3xl border border-gray-100 bg-white p-5 space-y-2"
        aria-labelledby="family-empty-title"
      >
        <h2 id="family-empty-title" className="text-base font-black text-[#1A1A1A]">
          Your member profile is connected
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          Your member profile is connected, but no family members are linked yet.
        </p>
        <p className="text-xs text-gray-500 leading-relaxed">{familyEmptyCopy()}</p>
      </section>
    );
  }

  const householdName = summary?.household?.name?.trim() || 'My Household';
  const adults = summary?.adults.length ?? 0;
  const dependents = summary?.dependents.length ?? 0;

  return (
    <section
      className="rounded-3xl border border-burgundy/10 bg-burgundy/[0.03] p-5 space-y-3"
      aria-labelledby="family-household-title"
    >
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-burgundy">
          Family / Household
        </p>
        <h2 id="family-household-title" className="text-lg font-black text-[#1A1A1A] mt-1">
          {householdName}
        </h2>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-white border border-gray-100 px-3 py-2.5">
          <dt className="text-xs font-black uppercase tracking-widest text-gray-500">Adults</dt>
          <dd className="text-base font-bold text-[#1A1A1A] mt-0.5">{adults}</dd>
        </div>
        <div className="rounded-2xl bg-white border border-gray-100 px-3 py-2.5">
          <dt className="text-xs font-black uppercase tracking-widest text-gray-500">
            Children / Dependents
          </dt>
          <dd className="text-base font-bold text-[#1A1A1A] mt-0.5">{dependents}</dd>
        </div>
      </dl>
    </section>
  );
};
