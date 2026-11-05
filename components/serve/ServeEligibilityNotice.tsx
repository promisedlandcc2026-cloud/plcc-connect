import React from 'react';
import type { ServeEligibilitySummary } from '../../lib/serveUi';
import { eligibilityNoticeCopy } from '../../lib/serveUi';

type Props = {
  eligibility: ServeEligibilitySummary;
};

/** Compact top-of-directory eligibility status — page stays browsable. */
export const ServeEligibilityNotice: React.FC<Props> = ({ eligibility }) => {
  const copy = eligibilityNoticeCopy(eligibility);
  const toneClass =
    copy.tone === 'ok'
      ? 'border-emerald-100 bg-emerald-50/80 text-emerald-950'
      : copy.tone === 'warn'
        ? 'border-amber-100 bg-amber-50/80 text-amber-950'
        : 'border-gray-200 bg-gray-50 text-gray-800';

  return (
    <aside
      className={`rounded-2xl border px-4 py-3 ${toneClass}`}
      aria-live="polite"
      data-serve-eligibility={eligibility.status}
    >
      <p className="text-sm font-bold leading-snug">{copy.title}</p>
      <p className="mt-1 text-xs leading-relaxed opacity-90">{copy.body}</p>
      {eligibility.status === 'not_verified' ? (
        <p className="mt-2 text-xs font-semibold">Contact church leadership</p>
      ) : null}
    </aside>
  );
};
