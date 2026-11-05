import React from 'react';
import { Link } from 'react-router-dom';
import type { ServeOpportunity } from '../../lib/serveUi';
import {
  formatRemainingSlots,
  formatServeWhen,
  isActiveSignupStatus,
  signupStatusLabel,
} from '../../lib/serveUi';

type Props = {
  opportunity: ServeOpportunity;
};

export const ServeOpportunityCard: React.FC<Props> = ({ opportunity }) => {
  const remaining = formatRemainingSlots(opportunity.remainingSlots);
  const when = formatServeWhen(opportunity.startsAt, opportunity.endsAt);
  const ministryTeam = [opportunity.ministry?.name, opportunity.team?.name]
    .filter(Boolean)
    .join(' · ');
  const mine = opportunity.mySignupStatus;
  const active = isActiveSignupStatus(mine);
  const full = opportunity.remainingSlots === 0;

  return (
    <li>
      <Link
        to={`/serve/${opportunity.id}`}
        className="block rounded-2xl border border-gray-100 bg-white shadow-sm px-4 py-4 active:scale-[0.99] transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-burgundy"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-[#1A1A1A] leading-snug">{opportunity.title}</h2>
            {opportunity.roleLabel ? (
              <p className="mt-0.5 text-xs font-semibold text-burgundy">{opportunity.roleLabel}</p>
            ) : null}
          </div>
          {opportunity.requiresApproval ? (
            <span className="shrink-0 rounded-lg bg-amber-50 px-2 py-1 text-xs font-black uppercase tracking-widest text-amber-800">
              Approval
            </span>
          ) : null}
        </div>

        {ministryTeam ? (
          <p className="mt-2 text-xs text-gray-500">{ministryTeam}</p>
        ) : null}
        <p className="mt-1 text-xs text-gray-600">{when}</p>
        {opportunity.location ? (
          <p className="mt-0.5 text-xs text-gray-500">{opportunity.location}</p>
        ) : null}

        {opportunity.description ? (
          <p className="mt-2 text-[13px] text-gray-600 leading-relaxed line-clamp-2">
            {opportunity.description}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-lg px-2 py-1 text-xs font-bold ${
              full ? 'bg-gray-100 text-gray-600' : 'bg-burgundy/8 text-burgundy'
            }`}
          >
            {remaining}
          </span>
          {active ? (
            <span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-900">
              {signupStatusLabel(mine)}
            </span>
          ) : null}
        </div>
      </Link>
    </li>
  );
};
