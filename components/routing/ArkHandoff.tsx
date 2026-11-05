import React, { useEffect, useState } from 'react';

/**
 * PLCC Ark is its own site, served by Connect's Vercel project at /ark (a rewrite),
 * so members stay signed in. Inside the Connect app, /ark only needs a full page
 * load to reach it. If we land here again after that load (local dev, or the Ark
 * isn't deployed yet), show a short note instead of looping.
 */
export const ArkHandoff: React.FC = () => {
  const alreadyTried = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('ark') === '1';
  const [stuck, setStuck] = useState(alreadyTried);

  useEffect(() => {
    if (alreadyTried) return;
    const t = window.setTimeout(() => setStuck(true), 6000);
    window.location.assign(`/ark/?ark=1${window.location.hash || ''}`);
    return () => window.clearTimeout(t);
  }, [alreadyTried]);

  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
      {stuck ? (
        <>
          <h1 className="text-xl font-bold text-ink">PLCC Ark isn’t available yet</h1>
          <p className="max-w-sm text-sm text-ink-soft">Please try again in a little while.</p>
          <a href="/" className="mt-2 inline-flex min-h-[44px] items-center rounded-xl bg-burgundy px-5 text-sm font-bold text-white">
            Back to Home
          </a>
        </>
      ) : (
        <p className="text-sm text-ink-soft" role="status">Opening PLCC Ark…</p>
      )}
    </main>
  );
};
